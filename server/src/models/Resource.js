import mongoose from 'mongoose';

const resourceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    available: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    isAvailable: { type: Boolean, default: true },
    costPerUnit: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Resource = mongoose.model('Resource', resourceSchema);
