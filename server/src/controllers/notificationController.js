import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getMyNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({
    $or: [{ user: req.user._id }, { broadcast: true }],
  }).sort({ createdAt: -1 }).limit(50);
  res.json(notifications);
});

export const markRead = asyncHandler(async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
  res.json({ message: 'Marked as read' });
});

export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id }, { isRead: true });
  res.json({ message: 'All marked read' });
});

export const sendNotification = asyncHandler(async (req, res) => {
  const { title, message, type, userIds, broadcast, link } = req.body;

  if (broadcast) {
    const users = await User.find({ role: 'user', isActive: true });
    const notifications = await Notification.insertMany(
      users.map((u) => ({ user: u._id, title, message, type: type || 'general', link, broadcast: true }))
    );
    return res.status(201).json({ count: notifications.length });
  }

  const ids = userIds || [];
  const notifications = await Notification.insertMany(
    ids.map((id) => ({ user: id, title, message, type: type || 'general', link }))
  );
  res.status(201).json({ count: notifications.length });
});

export const deleteNotification = asyncHandler(async (req, res) => {
  await Notification.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});
