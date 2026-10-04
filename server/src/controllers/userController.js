import { User } from '../models/User.js';
import { Registration } from '../models/Registration.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ role: 'user' }).select('-password').sort({ createdAt: -1 });
  res.json(users);
});

export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
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
  user.isActive = !user.isActive;
  await user.save();
  res.json(user);
});
