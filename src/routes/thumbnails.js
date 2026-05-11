const express = require('express');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const upload = require('../middleware/upload');
const metrics = require('../utils/metrics');
const { THUMBNAIL_SIZES } = require('../config/constants');

const router = express.Router();

router.post('/', upload.array('images', 5), async (req, res) => {
    const uploadedFiles = req.files || [];

    try {
        if (uploadedFiles.length === 0) {
            return res.status(400).json({ error: 'Please upload at least one image file (max 5).' });
        }

        metrics.increment(uploadedFiles.length);

        let format = String(req.body.format || 'webp').toLowerCase();
        if (format === 'jpg') format = 'jpeg';

        const quality = parseInt(req.body.quality) || 80;
        const sizePreset = String(req.body.size || 'medium').toLowerCase();

        const allowedFormats = ['jpeg', 'png', 'webp', 'avif'];
        if (!allowedFormats.includes(format)) {
            for (const file of uploadedFiles) fs.unlink(file.path, () => { });
            return res.status(400).json({ error: `Unsupported format. Choose from: ${allowedFormats.join(', ')}` });
        }

        if (quality < 1 || quality > 100) {
            for (const file of uploadedFiles) fs.unlink(file.path, () => { });
            return res.status(400).json({ error: 'Quality must be a number between 1 and 100.' });
        }

        let width = req.body.width ? parseInt(req.body.width) : null;
        let height = req.body.height ? parseInt(req.body.height) : null;

        if (req.body.width && (isNaN(width) || width <= 0)) {
            for (const file of uploadedFiles) fs.unlink(file.path, () => { });
            return res.status(400).json({ error: 'Width must be a positive integer.' });
        }
        if (req.body.height && (isNaN(height) || height <= 0)) {
            for (const file of uploadedFiles) fs.unlink(file.path, () => { });
            return res.status(400).json({ error: 'Height must be a positive integer.' });
        }

        if (width && !height) height = width;
        if (height && !width) width = height;

        if (!width && !height) {
            if (!THUMBNAIL_SIZES[sizePreset]) {
                for (const file of uploadedFiles) fs.unlink(file.path, () => { });
                return res.status(400).json({ error: `Invalid size preset. Choose from: ${Object.keys(THUMBNAIL_SIZES).join(', ')}` });
            }
            width = THUMBNAIL_SIZES[sizePreset].width;
            height = THUMBNAIL_SIZES[sizePreset].height;
        }

        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', 'attachment; filename="thumbnails.zip"');

        const archive = archiver('zip', { zlib: { level: 1 } });

        archive.on('warning', (err) => {
            if (err.code === 'ENOENT') {
                console.warn('Archive warning:', err);
            } else {
                console.error('Archive warning:', err);
            }
        });

        archive.on('error', (err) => { 
            console.error('Archiver error:', err);
            if (!res.headersSent) res.status(500).json({ error: 'Failed to generate archive.' });
        });

        archive.pipe(res);

        for (let i = 0; i < uploadedFiles.length; i++) {
            const file = uploadedFiles[i];

            let pipeline = sharp(file.path).resize({
                width: width,
                height: height,
                fit: 'cover',
                position: 'centre',
            });

            if (format === 'jpeg') {
                pipeline = pipeline.flatten({ background: '#ffffff' });
            }

            const thumbnailBuffer = await pipeline.toFormat(format, { quality: quality }).toBuffer();

            const originalName = path.parse(file.originalname).name;
            const thumbFilename = `${originalName}_thumb.${format}`;

            archive.append(thumbnailBuffer, { name: thumbFilename });

            fs.unlink(file.path, (err) => {
                if (err) console.error(`Failed to delete temp file for ${file.originalname}:`, err);
            });
        }

        await archive.finalize();
    } catch (error) {
        console.error('Error generating batch thumbnails:', error);

        for (const file of uploadedFiles) if (file.path) fs.unlink(file.path, () => { });

        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate thumbnails.' });
        }
    }
});

module.exports = router;
