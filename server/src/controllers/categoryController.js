import { Category } from '../models/Category.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getCategories = asyncHandler(async (req, res) => {
  const filter = req.query.all ? {} : { isActive: true };
  const categories = await Category.find(filter).sort({ name: 1 });
  res.json(categories);
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create(req.body);
  res.status(201).json(category);
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(category);
});

export const deleteCategory = asyncHandler(async (req, res) => {
  await Category.findByIdAndDelete(req.params.id);
  res.json({ message: 'Category deleted' });
});

export const toggleCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  category.isActive = !category.isActive;
  await category.save();
  res.json(category);
});
