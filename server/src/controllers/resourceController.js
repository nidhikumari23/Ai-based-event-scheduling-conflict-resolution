import { Resource } from '../models/Resource.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getResources = asyncHandler(async (req, res) => {
  const resources = await Resource.find().sort({ name: 1 });
  res.json(resources);
});

export const createResource = asyncHandler(async (req, res) => {
  const data = { ...req.body, available: req.body.quantity ?? req.body.available };
  const resource = await Resource.create(data);
  res.status(201).json(resource);
});

export const updateResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(resource);
});

export const deleteResource = asyncHandler(async (req, res) => {
  await Resource.findByIdAndDelete(req.params.id);
  res.json({ message: 'Resource deleted' });
});

export const toggleResourceAvailability = asyncHandler(async (req, res) => {
  const resource = await Resource.findById(req.params.id);
  resource.isAvailable = !resource.isAvailable;
  await resource.save();
  res.json(resource);
});

export const checkOverbooking = asyncHandler(async (req, res) => {
  const resources = await Resource.find();
  const overbooked = resources.filter((r) => r.available > r.quantity || r.available < 0);
  res.json({ overbooked, all: resources });
});
