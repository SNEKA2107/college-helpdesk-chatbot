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
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Token is invalid — user not found.' });
    }

    // Session revocation. The token carries the tokenVersion current when it was
    // issued; logout, a password change and admin deactivation all increment the
    // stored value, so every token handed out before that moment stops working.
    // Tokens minted before this field existed carry no `v` and are treated as
    // version 0, which matches the default — existing sessions keep working.
    if ((decoded.v || 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({ success: false, message: 'Session has expired. Please sign in again.' });
    }

    // Account state is re-checked on EVERY request, not just at login. Tokens live
    // for 30 days, so without this an admin who deactivated or rejected an account
    // did not actually cut off access — the holder's existing token kept working
    // until it expired. These are the same rules routes/auth.js applies at login.
    // 401 (not 403) is deliberate: the client's API layer clears the session and
    // redirects to /login on 401, so a revoked user is signed out immediately.
    if (user.isActive === false) {
      return res.status(401).json({ success: false, message: 'Account is deactivated. Contact the admin.' });
    }
    if (user.approvalStatus === 'pending') {
      return res.status(401).json({ success: false, message: 'Your registration is pending admin approval.' });
    }
    if (user.approvalStatus === 'rejected') {
      return res.status(401).json({ success: false, message: 'Your registration was not approved.' });
    }

    req.user = user;
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
