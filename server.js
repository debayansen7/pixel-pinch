const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerDocs = require('./swagger');

const optimizeRoute = require('./optimize');
const thumbnailRoute = require('./thumbnail');
const thumbnailsRoute = require('./thumbnails');
const usageRoute = require('./usage');

// Disable Sharp's internal cache to heavily reduce RAM usage on low-memory instances (like Render Free Tier)
sharp.cache(false);

// Initialize the Express application
const app = express();
// Use the port provided by the host environment, or default to 3000 locally
const PORT = process.env.PORT || 7187;

// Configure Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Configure CORS to only allow requests from your specific frontend domain
const corsOptions = {
    origin: process.env.FRONTEND_URL || '*', // Allow all by default to let Swagger UI work without blocking
    exposedHeaders: ['X-Original-Size', 'X-Optimized-Size', 'X-Thumbnail-Size', 'X-Thumbnail-Width', 'X-Thumbnail-Height', 'Content-Disposition'], // Allow frontend to read these custom headers
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
    limit: 10, // Limit each IP to 10 requests per `window` (updated property for v7)
    message: { error: 'Too many requests from this IP, please try again after a minute.' },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiter globally to all requests
app.use(limiter);

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

// Mount external routes
app.use('/optimize', optimizeRoute);
app.use('/thumbnail', thumbnailRoute);
app.use('/thumbnails', thumbnailsRoute);
app.use('/usage', usageRoute);

// 404 Not Found Handler for unknown routes
app.use((req, res, next) => {
    res.status(404).json({ error: 'Route not found.' });
});

// Global Error Handling Middleware
// This is crucial for catching errors from multer and other middleware cleanly.
// It must be defined after all other app.use() and routes.
app.use((err, req, res, next) => {
    console.error("An error occurred:", err.message);

    // Handle Multer-specific errors
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'file size cannot be greater than 10 MB' });
        }
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
