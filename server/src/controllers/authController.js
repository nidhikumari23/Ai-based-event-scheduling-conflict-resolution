import crypto from 'crypto';
import { User } from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, interests } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password required' });
  }
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ message: 'Email already registered' });

  const userRole = role === 'admin' && !(await User.findOne({ role: 'admin' })) ? 'admin' : 'user';
  const user = await User.create({
    name,
    email,
    password,
    role: userRole,
    phone,
    interests: interests || [],
  });

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user._id, user.role),
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  if (!user.isActive) return res.status(403).json({ message: 'Account deactivated' });

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user._id, user.role),
  });
});

export const getMe = asyncHandler(async (req, res) => {
  res.json(req.user);
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.name = req.body.name ?? user.name;
  user.phone = req.body.phone ?? user.phone;
  user.interests = req.body.interests ?? user.interests;
  if (req.body.avatar) user.avatar = req.body.avatar;
  await user.save();
  res.json(user);
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);
  if (!(await user.matchPassword(currentPassword))) {
    return res.status(400).json({ message: 'Current password incorrect' });
  }
  user.password = newPassword;
  await user.save();
  res.json({ message: 'Password updated' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.json({ message: 'If account exists, reset link sent' });

  user.resetToken = crypto.randomBytes(20).toString('hex');
  user.resetExpires = Date.now() + 3600000;
  await user.save();

  res.json({
    message: 'Reset token generated',
    resetToken: user.resetToken,
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    resetToken: req.body.token,
    resetExpires: { $gt: Date.now() },
  });
  if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

  user.password = req.body.password;
  user.resetToken = undefined;
  user.resetExpires = undefined;
  await user.save();
  res.json({ message: 'Password reset successful' });
});
