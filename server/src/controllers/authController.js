import crypto from 'crypto';
import { User } from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { isAccountActive } from '../utils/accountStatus.js';
import { isStrongPassword } from '../utils/passwordPolicy.js';
import { isEmailConfigured, sendPasswordResetEmail } from '../services/emailService.js';

const resetResponseMessage =
  'If an account exists, we will email a reset link. If no email arrives, the administrator must configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, and CLIENT_URL.';
const resetTokenLifetimeMs = 15 * 60 * 1000;

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, interests } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password required' });
  }
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ message: 'Email already registered' });

  const user = await User.create({
    name,
    email,
    password,
    role: 'user',
    phone,
    interests: interests || [],
  });

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    interests: user.interests,
    skills: user.skills,
    token: generateToken(user._id, user.role),
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  if (!isAccountActive(user)) return res.status(403).json({ message: 'Account deactivated or blocked' });

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    interests: user.interests,
    skills: user.skills,
    token: generateToken(user._id, user.role),
  });
});

export const getMe = asyncHandler(async (req, res) => {
  res.json(req.user);
});

export const updateProfile = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const user = await User.findById(req.user._id);
  for (const field of ['interests', 'skills']) {
    if (body[field] !== undefined &&
      (!Array.isArray(body[field]) || body[field].length > 25 ||
        body[field].some((value) => typeof value !== 'string' || value.trim().length > 60))) {
      return res.status(400).json({ message: `${field} must be a list of up to 25 text values (60 characters maximum each).` });
    }
  }
  user.name = body.name ?? user.name;
  user.phone = body.phone ?? user.phone;
  if (body.interests !== undefined) {
    user.interests = body.interests.reduce((values, value) => {
      const normalized = value.trim().toLowerCase();
      if (normalized && !values.some((existing) => existing.toLowerCase() === normalized)) {
        values.push(value.trim());
      }
      return values;
    }, []);
  }
  if (body.skills !== undefined) {
    user.skills = body.skills.reduce((values, value) => {
      const normalized = value.trim().toLowerCase();
      if (normalized && !values.some((existing) => existing.toLowerCase() === normalized)) {
        values.push(value.trim());
      }
      return values;
    }, []);
  }
  if (body.avatar) user.avatar = body.avatar;
  await user.save();
  const profile = user.toObject();
  delete profile.password;
  delete profile.resetToken;
  delete profile.resetExpires;
  res.json(profile);
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || !currentPassword ||
      typeof newPassword !== 'string' || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required.' });
  }
  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({
      message: 'New password must be 12–128 characters and include lowercase, uppercase, a number, and a symbol.',
    });
  }
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (!(await user.matchPassword(currentPassword))) {
    return res.status(400).json({ message: 'Current password incorrect' });
  }
  if (await user.matchPassword(newPassword)) {
    return res.status(400).json({ message: 'New password must be different from the current password.' });
  }
  user.password = newPassword;
  await user.save();
  res.json({ message: 'Password updated successfully.' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const normalizedEmail = typeof req.body?.email === 'string'
    ? req.body.email.trim().toLowerCase()
    : '';
  const user = normalizedEmail ? await User.findOne({ email: normalizedEmail }) : null;
  const sendResetEmail = req.app.locals.sendPasswordResetEmail || sendPasswordResetEmail;
  if (!user || (!req.app.locals.sendPasswordResetEmail && !isEmailConfigured())) {
    return res.json({ message: resetResponseMessage });
  }

  const token = crypto.randomBytes(32).toString('base64url');
  user.resetToken = undefined;
  user.resetTokenHash = hashResetToken(token);
  user.resetExpires = new Date(Date.now() + resetTokenLifetimeMs);
  await user.save();

  const resetUrlWithToken = new URL('/forgot-password', process.env.CLIENT_URL || 'http://localhost:5173');
  resetUrlWithToken.searchParams.set('token', token);
  try {
    await sendResetEmail({ to: user.email, resetUrl: resetUrlWithToken.toString() });
  } catch {
    await User.updateOne(
      { _id: user._id, resetTokenHash: hashResetToken(token) },
      { $unset: { resetTokenHash: 1, resetExpires: 1, resetToken: 1 } }
    );
    console.error('Password reset email delivery failed; verify SMTP configuration.');
  }
  res.json({ message: resetResponseMessage });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body || {};
  if (typeof token !== 'string' || !token || !isStrongPassword(password)) {
    return res.status(400).json({
      message: 'A valid reset token and a strong password are required.',
    });
  }
  const user = await User.findOneAndUpdate({
    resetTokenHash: hashResetToken(token),
    resetExpires: { $gt: Date.now() },
  }, {
    $unset: { resetTokenHash: 1, resetExpires: 1, resetToken: 1 },
  }, {
    new: false,
  }).select('+password');
  if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

  user.password = password;
  await user.save();
  res.json({ message: 'Password reset successful' });
});
