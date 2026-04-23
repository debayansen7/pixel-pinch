const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const os = require('os');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

// Disable Sharp's internal cache to heavily reduce RAM usage on low-memory instances (like Render Free Tier)
sharp.cache(false);

// Initialize the Express application
const app = express();
// Use the port provided by the host environment, or default to 3000 locally
const PORT = process.env.PORT || 3001;

// Configure CORS to only allow requests from your specific frontend domain
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'https://your-frontend-domain.com', // Replace with your actual domain
    exposedHeaders: ['X-Original-Size', 'X-Optimized-Size'], // Allow frontend to read these custom headers
    optionsSuccessStatus: 200 // For legacy browser compatibility
};
// Apply CORS middleware globally
app.use(cors(corsOptions));

// Trust the first proxy. Essential for Render or other environments behind a load balancer
// so the rate limiter tracks the actual user's IP instead of the load balancer's IP.
app.set('trust proxy', 1);

// Configure rate limiting to protect against spam/abuse
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute window
    max: 10, // Limit each IP to 10 requests per `window`
    message: { error: 'Too many requests from this IP, please try again after a minute.' },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiter globally to all requests
app.use(limiter);

// Configure Multer to store uploaded files on the disk temporarily.
// This prevents Out of Memory (OOM) errors when handling multiple or large uploads.
const upload = multer({
    dest: os.tmpdir(), // Use the operating system's default temporary directory
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB maximum file size
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true); // Accept the file
        } else {
            cb(new Error('Only image files are allowed!')); // Reject the file
        }
    }
});

// Track the number of successful image optimizations
let apiUsageCount = 0;
const logFilePath = path.join(__dirname, 'api-requests.log');

// Request & Response Logging Middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();

    // res.on('finish') allows us to wait until the request is fully processed so we can log the final status code
    res.on('finish', () => {
        const logEntry = `[${timestamp}] Request: ${req.method} ${req.originalUrl} | Status: ${res.statusCode}\n`;
        fs.appendFile(logFilePath, logEntry, (err) => {
            if (err) console.error('Failed to write to log file:', err);
        });
    });

    next(); // Pass control to the next middleware or route
});

/**
 * Our API Endpoint
 * It listens for POST requests at "http://localhost:3000/optimize"
 * "upload.single('image')" tells Multer to look for a file attached with the name 'image'
 */
app.post('/optimize', upload.single('image'), async (req, res) => {
    try {
        // 1. Check if the user actually uploaded a file
        if (!req.file) {
            return res.status(400).json({ error: 'Please upload an image file.' });
        }

        // Increment the usage counter 
        apiUsageCount++;

        // 2. Get the desired format and quality from the request body
        // If the user doesn't provide them, we use default values (webp, quality 80)
        const format = req.body.format || 'webp';
        const quality = parseInt(req.body.quality) || 80;
        const width = req.body.width ? parseInt(req.body.width) : null;
        const height = req.body.height ? parseInt(req.body.height) : null;

        // 3. Validate the format to ensure Sharp supports it
        const allowedFormats = ['jpeg', 'png', 'webp', 'avif'];
        if (!allowedFormats.includes(format.toLowerCase())) {
            return res.status(400).json({ error: `Unsupported format. Choose from: ${allowedFormats.join(', ')}` });
        }

        // 4. Validate the quality number
        if (quality < 1 || quality > 100) {
            return res.status(400).json({ error: 'Quality must be a number between 1 and 100.' });
        }

        // Start the Sharp image pipeline
        // We now pass the file path instead of the memory buffer
        let imagePipeline = sharp(req.file.path);

        // If the user provided a width or height, resize the image
        if (width || height) {
            // fit: 'inside' ensures the image retains its aspect ratio while fitting within the dimensions
            imagePipeline = imagePipeline.resize({ width: width, height: height, fit: 'inside' });
        }

        // 5. THE MAGIC: Process the image using Sharp
        // We take the file from memory (req.file.buffer), change its format, compress it, 
        // and output it back into a new memory buffer.
        const optimizedImageBuffer = await imagePipeline
            .toFormat(format, { quality: quality })
            .toBuffer();

        // Calculate file sizes to see the difference
        const originalSize = req.file.size;
        const optimizedSize = optimizedImageBuffer.length;
        const savings = ((1 - (optimizedSize / originalSize)) * 100).toFixed(2);

        // Log the results to the terminal so we can see what changed
        console.log(`\n--- Optimization Results ---`);
        console.log(`Original Size: ${(originalSize / 1024).toFixed(2)} KB`);
        console.log(`Optimized Size: ${(optimizedSize / 1024).toFixed(2)} KB`);
        console.log(`Space Saved: ${savings}%`);
        console.log(`----------------------------\n`);

        // 6. Send the newly processed image back to the user
        res.set('Content-Type', `image/${format}`);
        res.set('X-Original-Size', originalSize);
        res.set('X-Optimized-Size', optimizedSize);
        res.send(optimizedImageBuffer);

        // 7. Clean up the temporary file from the disk to free up space
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Failed to delete temp file:', err);
        });

    } catch (error) {
        // If anything goes wrong (e.g., corrupt image file), we catch the error here
        console.error('Error processing image:', error);

        // Ensure we still clean up the temp file even if Sharp fails
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, () => { });
        }
        res.status(500).json({ error: 'Failed to process the image.' });
    }
});

// Endpoint to check API usage statistics
app.get('/usage', (req, res) => {
    res.json({ totalOptimizations: apiUsageCount });
});

// Global Error Handling Middleware
// This is crucial for catching errors from multer and other middleware cleanly.
// It must be defined after all other app.use() and routes.
app.use((err, req, res, next) => {
    console.error("An error occurred:", err.message);

    // Handle Multer-specific errors
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
    }

    // Handle our custom fileFilter error
    if (err.message === 'Only image files are allowed!') {
        return res.status(400).json({ error: err.message });
    }

    // Default to a 500 server error for any other issues
    res.status(500).json({ error: 'An internal server error occurred.' });
});

// Start the server and listen for incoming requests
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Image Optimizer API is running at http://localhost:${PORT}`);
    });
}

module.exports = app; // Export the app for testing purposes
