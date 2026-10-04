import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema(
  {
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
    isPublished: { type: Boolean, default: false },
    generatedBy: { type: String, enum: ['manual', 'ai', 'hybrid'], default: 'manual' },
  },
  { timestamps: true }
);

export const Schedule = mongoose.model('Schedule', scheduleSchema);
