import { Staff } from '../models/Staff.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getStaff = asyncHandler(async (req, res) => {
  const staff = await Staff.find().populate('assignedEvents assignedVenues').sort({ name: 1 });
  res.json(staff);
});

export const createStaff = asyncHandler(async (req, res) => {
  const member = await Staff.create(req.body);
  res.status(201).json(member);
});

export const updateStaff = asyncHandler(async (req, res) => {
  const member = await Staff.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(member);
});

export const deleteStaff = asyncHandler(async (req, res) => {
  await Staff.findByIdAndDelete(req.params.id);
  res.json({ message: 'Staff deleted' });
});

export const assignStaffToEvent = asyncHandler(async (req, res) => {
  const member = await Staff.findById(req.params.id);
  if (!member.assignedEvents.includes(req.body.eventId)) {
    member.assignedEvents.push(req.body.eventId);
  }
  await member.save();
  res.json(member);
});

export const toggleStaffAvailability = asyncHandler(async (req, res) => {
  const member = await Staff.findById(req.params.id);
  member.isAvailable = !member.isAvailable;
  await member.save();
  res.json(member);
});
