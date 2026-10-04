import mongoose from 'mongoose';

const conflictSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['timing', 'venue', 'resource', 'staff', 'capacity'],
      required: true,
    },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    events: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
    venue: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue' },
    resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource' },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    description: { type: String, required: true },
    aiSuggestion: { type: String, default: '' },
    status: {
      type: String,
      enum: ['open', 'resolved', 'ignored', 'accepted'],
      default: 'open',
    },
    resolution: { type: String, default: '' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
  },
  { timestamps: true }
);

export const Conflict = mongoose.model('Conflict', conflictSchema);
