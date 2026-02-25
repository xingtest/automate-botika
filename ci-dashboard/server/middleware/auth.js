const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key';

const authenticateToken = (req, res, next) => {
    // Get token from header or query parameter (for window.open usage)
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

/**
 * Special middleware for GitHub Runners that might not have a user token
 * but provide a USER_ID in the payload.
 */
const authenticateRunner = (req, res, next) => {
    // This is more relaxed for the POST /api/test-runs endpoint
    // if it's coming from a trusted source (like an internal network or specific secret)
    // For now, we'll just allow it if USER_ID is in the body, OR if auth token is present.

    const authHeader = req.headers['authorization'];
    if (authHeader) {
        return authenticateToken(req, res, next);
    }

    // If no token, check if it's a push from runner (simplified)
    if (req.body.summary && req.body.summary.user_id) {
        req.user = { id: req.body.summary.user_id };
        return next();
    }

    if (req.body.user_id) {
        req.user = { id: req.body.user_id };
        return next();
    }

    next(); // Fallback to let the route handle missing user
};

module.exports = { authenticateToken, authenticateRunner };
