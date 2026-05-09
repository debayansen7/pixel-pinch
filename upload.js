const multer = require('multer');
const os = require('os');

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

module.exports = upload;