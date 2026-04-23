const request = require('supertest');
const app = require('./server'); // Import your express app
const path = require('path');
const fs = require('fs');
const { error } = require('console');

// The path to your test image. Make sure 'test-image.jpeg' exists in your project root.
const testImagePath = path.join(__dirname, 'test-image.jpeg');

describe('Image Optimizer API', () => {

    // Test the "happy path" - a successful optimization
    it('should successfully optimize a valid image', async () => {
        const response = await request(app)
            .post('/optimize')
            .attach('image', testImagePath)
            .field('format', 'webp')
            .field('quality', '70');

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('image/webp');
        expect(parseInt(response.headers['x-original-size'])).toBeGreaterThan(0);
        expect(parseInt(response.headers['x-optimized-size'])).toBeGreaterThan(0);
    });

    // Test for missing file upload
    it('should return a 400 error if no file is uploaded', async () => {
        const response = await request(app)
            .post('/optimize')
            .field('format', 'jpeg'); // Sending fields without a file

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Please upload an image file.' });
    });

    // Test for invalid file type (e.g., a text file)
    it('should return a 400 error for non-image file types', async () => {
        const nonImagePath = path.join(__dirname, 'test.txt');
        fs.writeFileSync(nonImagePath, 'this is not an image');

        const response = await request(app)
            .post('/optimize')
            .attach('image', nonImagePath);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Only image files are allowed!' });

        fs.unlinkSync(nonImagePath); // Clean up the dummy file
    });

    // Test for file size limit
    it('should return a 400 error if the uploaded file exceeds the size limit', async () => {
        const largeFilePath = path.join(__dirname, 'test2_image.jpeg');
        // Create a dummy buffer that is > 10MB
        const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
        fs.writeFileSync(largeFilePath, largeBuffer);

        const response = await request(app)
            .post('/optimize')
            .attach('image', largeFilePath);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ message: 'file size cannot be greater than 10 MB' });

        fs.unlinkSync(largeFilePath); // Clean up the dummy file
    }, 10000); // Increase timeout for this test as it handles a large file
});
