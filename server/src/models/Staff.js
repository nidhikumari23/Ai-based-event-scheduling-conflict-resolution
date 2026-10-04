import mongoose from 'mongoose';

const staffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true },
    phone: { type: String, default: '' },
    role: {
      type: String,
      enum: ['coordinator', 'technician', 'security', 'volunteer', 'manager', 'host'],
      default: 'volunteer',
    },
    assignedEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
    assignedVenues: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Venue' }],
    isAvailable: { type: Boolean, default: true },
    availabilityNotes: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Staff = mongoose.model('Staff', staffSchema);
