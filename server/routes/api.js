const express = require('express');
const router = express.Router();

router.use('/users', require('./users'));
router.use('/rooms', require('./rooms'));
router.use('/messages', require('./messages'));
router.use('/search', require('./search'));
router.use('/upload', require('./upload'));
router.use('/config', require('./config_route'));

module.exports = router;
