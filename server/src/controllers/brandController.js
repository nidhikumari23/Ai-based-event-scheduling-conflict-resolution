import { Brand } from '../models/Brand.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getBrands = asyncHandler(async (req, res) => {
  const filter = req.query.all ? {} : { isActive: true };
  const brands = await Brand.find(filter).sort({ name: 1 });
  res.json(brands);
});

export const createBrand = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.logo = `/uploads/${req.file.filename}`;
  const brand = await Brand.create(data);
  res.status(201).json(brand);
});

export const updateBrand = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.logo = `/uploads/${req.file.filename}`;
  const brand = await Brand.findByIdAndUpdate(req.params.id, data, { new: true });
  res.json(brand);
});

export const deleteBrand = asyncHandler(async (req, res) => {
  await Brand.findByIdAndDelete(req.params.id);
  res.json({ message: 'Brand deleted' });
});

export const toggleBrand = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  brand.isActive = !brand.isActive;
  await brand.save();
  res.json(brand);
});
