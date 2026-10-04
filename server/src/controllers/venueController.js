import { Venue } from '../models/Venue.js';
import { Event } from '../models/Event.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getVenues = asyncHandler(async (req, res) => {
  const venues = await Venue.find().sort({ name: 1 });
  res.json(venues);
});

export const createVenue = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (typeof data.facilities === 'string') {
    data.facilities = data.facilities.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const venue = await Venue.create(data);
  res.status(201).json(venue);
});

export const updateVenue = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (typeof data.facilities === 'string') {
    data.facilities = data.facilities.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const venue = await Venue.findByIdAndUpdate(req.params.id, data, { new: true });
  res.json(venue);
});

export const deleteVenue = asyncHandler(async (req, res) => {
  await Venue.findByIdAndDelete(req.params.id);
  res.json({ message: 'Venue deleted' });
});

export const getVenueBookingStatus = asyncHandler(async (req, res) => {
  const events = await Event.find({ venue: req.params.id, status: { $ne: 'cancelled' } })
    .populate('category')
    .sort({ date: 1 });
  res.json({ venue: await Venue.findById(req.params.id), bookings: events });
});

export const blockVenue = asyncHandler(async (req, res) => {
  const venue = await Venue.findById(req.params.id);
  venue.isBlocked = req.body.isBlocked ?? true;
  venue.blockReason = req.body.reason || '';
  venue.isAvailable = !venue.isBlocked;
  await venue.save();
  res.json(venue);
});
