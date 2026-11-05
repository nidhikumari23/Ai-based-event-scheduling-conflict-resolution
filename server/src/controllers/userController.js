import { User } from '../models/User.js';
import { Registration } from '../models/Registration.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ role: { $in: ['user', 'organizer'] } })
    .select('-password -resetToken -resetTokenHash -resetExpires')
    .sort({ createdAt: -1 });
  res.json(users);
});

export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password -resetToken -resetTokenHash -resetExpires');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

export const updateUser = asyncHandler(async (req, res) => {
  const requestedRole = req.body?.role;
  if (requestedRole && !['user', 'organizer'].includes(requestedRole)) {
    return res.status(400).json({ message: 'User role must be user or organizer.' });
  }
  const currentUser = await User.findById(req.params.id);
  if (!currentUser) return res.status(404).json({ message: 'User not found' });
  if (requestedRole && currentUser.role === 'admin') {
    return res.status(409).json({ message: 'Administrator roles cannot be changed through participant management.' });
  }
  const allowedFields = ['name', 'email', 'phone', 'avatar', 'interests', 'skills', 'role', 'isActive', 'isBlocked'];
  const updates = Object.fromEntries(
    allowedFields.filter((field) => Object.hasOwn(req.body || {}, field))
      .map((field) => [field, req.body[field]])
  );
  const user = await User.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  }).select('-password -resetToken -resetTokenHash -resetExpires');
  res.json(user);
});

export const deleteUser = asyncHandler(async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: 'User removed' });
});

export const getParticipantPreferences = asyncHandler(async (req, res) => {
  const users = await User.find({ role: 'user' }).select('name email interests');
  res.json(users);
});

export const getUserRegistrations = asyncHandler(async (req, res) => {
  const regs = await Registration.find({ user: req.params.id })
    .populate('event')
    .sort({ createdAt: -1 });
  res.json(regs);
});

export const toggleUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  user.isActive = !user.isActive;
  await user.save();
  const safeUser = user.toObject();
  delete safeUser.password;
  delete safeUser.resetToken;
  delete safeUser.resetTokenHash;
  delete safeUser.resetExpires;
  res.json(safeUser);
});
