import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    venue: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue' },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    brands: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Brand' }],
    resources: [
      {
        resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource' },
        quantity: { type: Number, default: 1 },
      },
    ],
    staff: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }],
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    expectedAudience: { type: Number, default: 100 },
    priority: { type: Number, default: 5, min: 1, max: 10 },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'published', 'cancelled', 'completed'],
      default: 'draft',
    },
    poster: { type: String, default: '' },
    isFeatured: { type: Boolean, default: false },
    rules: { type: String, default: '' },
    registrationCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Event = mongoose.model('Event', eventSchema);
