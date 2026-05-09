const express = require('express');
const metrics = require('./metrics');

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ totalOptimizations: metrics.getCount() });
});

module.exports = router;