import mongoose from 'mongoose';

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    logo: { type: String, default: '' },
    sponsorshipType: {
      type: String,
      enum: ['platinum', 'gold', 'silver', 'bronze', 'partner'],
      default: 'partner',
    },
    website: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Brand = mongoose.model('Brand', brandSchema);
