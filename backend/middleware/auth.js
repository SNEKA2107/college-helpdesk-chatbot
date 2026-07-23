const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Token is invalid — user not found.' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token is invalid or expired.' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Admin access only.' });
};

const facultyOnly = (req, res, next) => {
  if (req.user && req.user.role === 'faculty') return next();
  return res.status(403).json({ success: false, message: 'Faculty access only.' });
};

// Admin may view/act on faculty data (e.g. admin viewing faculty info).
const facultyOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'faculty' || req.user.role === 'admin')) return next();
  return res.status(403).json({ success: false, message: 'Faculty or admin access only.' });
};

module.exports = { protect, adminOnly, facultyOnly, facultyOrAdmin };
