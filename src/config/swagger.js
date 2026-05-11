const swaggerJsdoc = require('swagger-jsdoc');

const PORT = process.env.PORT || 3001;

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'PixelSqueez Image Optimizer API',
            version: '1.1.0',
            description: 'A fast and efficient RESTful API to format, compress, resize, and generate thumbnails for images on the fly.',
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
                description: 'Local server',
            },
        ],
    },
    apis: [__filename], // Read definitions from comments in this file
};

/**
 * @swagger
 * /optimize:
 *   post:
 *     summary: Optimize an uploaded image
 *     description: Upload an image to format, compress, and resize it on the fly.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: The image file to optimize (Max size 10MB).
 *               format:
 *                 type: string
 *                 enum: [jpeg, png, webp, avif]
 *                 default: webp
 *                 description: The target output format.
 *               quality:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 80
 *                 description: The compression quality level.
 *               width:
 *                 type: integer
 *                 description: The desired max width of the output image in pixels.
 *               height:
 *                 type: integer
 *                 description: The desired max height of the output image in pixels.
 *     responses:
 *       200:
 *         description: The optimized image
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Bad request (missing file, unsupported format, or invalid parameters)
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /thumbnail:
 *   post:
 *     summary: Generate a thumbnail from an uploaded image
 *     description: |
 *       Upload an image to generate a thumbnail. Uses centre-crop (`fit: cover`) to produce
 *       uniformly-sized thumbnails. Supports size presets (`small`, `medium`, `large`) or
 *       custom `width`/`height` values. SVGs are accepted but will be rasterized.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: The image file to thumbnail (Max 10MB).
 *               size:
 *                 type: string
 *                 enum: [small, medium, large]
 *                 default: medium
 *                 description: "Size preset: small (150×150), medium (300×300), large (600×600)."
 *               width:
 *                 type: integer
 *                 description: Custom width in pixels (overrides size preset).
 *               height:
 *                 type: integer
 *                 description: Custom height in pixels (overrides size preset).
 *               format:
 *                 type: string
 *                 enum: [jpeg, png, webp, avif]
 *                 default: webp
 *                 description: The output format for the thumbnail.
 *               quality:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 80
 *                 description: The compression quality level.
 *     responses:
 *       200:
 *         description: The generated thumbnail image
 *         headers:
 *           X-Original-Size:
 *             description: Original file size in bytes
 *             schema:
 *               type: integer
 *           X-Thumbnail-Size:
 *             description: Thumbnail file size in bytes
 *             schema:
 *               type: integer
 *           X-Thumbnail-Width:
 *             description: Thumbnail width in pixels
 *             schema:
 *               type: integer
 *           X-Thumbnail-Height:
 *             description: Thumbnail height in pixels
 *             schema:
 *               type: integer
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Bad request (missing file, unsupported format/size, or invalid parameters)
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /thumbnails:
 *   post:
 *     summary: Generate thumbnails for up to 5 images (ZIP download)
 *     description: |
 *       Upload up to 5 images to generate thumbnails in bulk. All images share the same
 *       size/format/quality settings. Returns a ZIP archive named `thumbnails.zip` containing
 *       the generated thumbnails. Images are processed sequentially to keep memory usage low.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Up to 5 image files (Max 10MB each).
 *               size:
 *                 type: string
 *                 enum: [small, medium, large]
 *                 default: medium
 *                 description: "Size preset: small (150×150), medium (300×300), large (600×600)."
 *               width:
 *                 type: integer
 *                 description: Custom width in pixels (overrides size preset).
 *               height:
 *                 type: integer
 *                 description: Custom height in pixels (overrides size preset).
 *               format:
 *                 type: string
 *                 enum: [jpeg, png, webp, avif]
 *                 default: webp
 *                 description: The output format for all thumbnails.
 *               quality:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 80
 *                 description: The compression quality level.
 *     responses:
 *       200:
 *         description: A ZIP archive containing the generated thumbnails
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Bad request (no files, unsupported format/size, or invalid parameters)
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /usage:
 *   get:
 *     summary: Retrieve API usage metrics
 *     description: Returns the total number of times the `/optimize` endpoint has been used successfully.
 *     responses:
 *       200:
 *         description: Total optimizations count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalOptimizations:
 *                   type: integer
 *                   example: 5
 */

module.exports = swaggerJsdoc(swaggerOptions);
