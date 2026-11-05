import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { isAccountActive } from '../utils/accountStatus.js';

export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }

  try {
    req.user = await User.findById(decoded.id).select('-password -resetToken -resetTokenHash -resetExpires');
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    if (!isAccountActive(req.user)) {
      return res.status(403).json({ message: 'Account is inactive or blocked' });
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

export const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

export const adminOrOrganizer = (req, res, next) => {
  if (!['admin', 'organizer'].includes(req.user?.role)) {
    return res.status(403).json({ message: 'Admin or organizer access required' });
  }
  next();
};

export const optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (token) {
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      req.user = null;
      return next();
    }

    try {
      req.user = await User.findById(decoded.id).select('-password -resetToken -resetTokenHash -resetExpires');
      if (!isAccountActive(req.user)) req.user = null;
    } catch (error) {
      return next(error);
    }
  }
  return next();
};
