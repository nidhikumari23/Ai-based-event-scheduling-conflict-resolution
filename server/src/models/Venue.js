import mongoose from 'mongoose';

const venueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true },
    capacity: { type: Number, required: true, min: 1 },
    facilities: [{ type: String }],
    isAvailable: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
    blockReason: { type: String, default: '' },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Venue = mongoose.model('Venue', venueSchema);
