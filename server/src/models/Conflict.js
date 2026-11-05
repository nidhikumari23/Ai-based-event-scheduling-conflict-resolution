import mongoose from 'mongoose';

const conflictEventDetailSchema = new mongoose.Schema(
  {
    id: String,
    title: String,
    date: String,
    startTime: String,
    endTime: String,
    venue: String,
  },
  { _id: false }
);

const proposedEventSchema = new mongoose.Schema(
  {
    eventId: mongoose.Schema.Types.ObjectId,
    isNewEvent: { type: Boolean, default: true },
    title: String,
    description: String,
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    venue: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue' },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    staff: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }],
    resources: [{
      resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource' },
      quantity: Number,
    }],
    date: Date,
    startTime: String,
    endTime: String,
    expectedAudience: Number,
    setupMinutes: Number,
    cleanupMinutes: Number,
    requiredFacilities: [String],
    status: String,
  },
  { _id: false }
);

const conflictSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['timing', 'venue', 'resource', 'staff', 'capacity', 'buffer'],
      required: true,
    },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    events: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
    eventDetails: [conflictEventDetailSchema],
    proposedEvent: proposedEventSchema,
    venue: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue' },
    resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource' },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    description: { type: String, required: true },
    fingerprint: { type: String, unique: true, sparse: true },
    proposalFingerprint: { type: String, index: true, sparse: true },
    detectedAt: { type: Date, default: Date.now },
    detectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
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
