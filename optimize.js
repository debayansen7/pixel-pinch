const express = require('express');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const upload = require('./upload');
const metrics = require('./metrics');

const router = express.Router();

router.post('/', upload.single('image'), async (req, res) => {
    try {
        // 1. Check if the user actually uploaded a file
        if (!req.file) {
            return res.status(400).json({ error: 'Please upload an image file.' });
        }

        // Increment the usage counter 
        metrics.increment();

        // 2. Get the desired format and quality from the request body
        let format = String(req.body.format || 'webp').toLowerCase();
        if (format === 'jpg') format = 'jpeg'; // Handle common abbreviation

        const quality = parseInt(req.body.quality) || 80;
        const width = req.body.width ? parseInt(req.body.width) : null;
        const height = req.body.height ? parseInt(req.body.height) : null;

        if (req.body.width && (isNaN(width) || width <= 0)) {
            return res.status(400).json({ error: 'Width must be a positive integer.' });
        }
        if (req.body.height && (isNaN(height) || height <= 0)) {
            return res.status(400).json({ error: 'Height must be a positive integer.' });
        }

        // 3. Validate the format to ensure Sharp supports it
        const allowedFormats = ['jpeg', 'png', 'webp', 'avif'];
        if (!allowedFormats.includes(format)) {
            return res.status(400).json({ error: `Unsupported format. Choose from: ${allowedFormats.join(', ')}` });
        }

        // 4. Validate the quality number
        if (quality < 1 || quality > 100) {
            return res.status(400).json({ error: 'Quality must be a number between 1 and 100.' });
        }

        let imagePipeline = sharp(req.file.path);

        if (width || height) {
            imagePipeline = imagePipeline.resize({ width: width, height: height, fit: 'inside' });
        }

        // 5. THE MAGIC: Process the image using Sharp
        const optimizedImageBuffer = await imagePipeline
            .toFormat(format, { quality: quality })
            .toBuffer();

        const originalName = path.parse(req.file.originalname).name;
        const newFilename = `${originalName}-converted.${format}`;

        // 6. Send the newly processed image back to the user
        res.set('Content-Type', `image/${format}`);
        res.set('Content-Disposition', `attachment; filename="${newFilename}"`);
        res.set('X-Original-Size', req.file.size.toString());
        res.set('X-Optimized-Size', optimizedImageBuffer.length.toString());
        res.send(optimizedImageBuffer);

        // 7. Clean up the temporary file from the disk to free up space
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Failed to delete temp file:', err);
        });
    } catch (error) {
        console.error('Error processing image:', error);
        if (req.file && req.file.path) fs.unlink(req.file.path, () => { });
        res.status(500).json({ error: 'Failed to process the image.' });
    }
});

module.exports = router;