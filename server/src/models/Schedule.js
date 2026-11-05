import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, unique: true, sparse: true, select: false },
    revision: { type: Number, default: 0 },
    festivalName: { type: String, default: 'Metro Nexus Festival' },
    entries: [
      {
        event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
        date: Date,
        startTime: String,
        endTime: String,
        venue: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue' },
        notes: String,
      },
    ],
    aiSummary: { type: String, default: '' },
    isLocked: { type: Boolean, default: false },
    lockReason: { type: String, default: '' },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isPublished: { type: Boolean, default: false },
    generatedBy: { type: String, enum: ['manual', 'ai', 'hybrid'], default: 'manual' },
  },
  { timestamps: true }
);

export const Schedule = mongoose.model('Schedule', scheduleSchema);
