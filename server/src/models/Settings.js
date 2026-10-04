import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    festivalName: { type: String, default: 'Metro Nexus Festival' },
    festivalStartDate: { type: Date },
    festivalEndDate: { type: Date },
    openaiApiKey: { type: String, default: '' },
    notificationEmail: { type: Boolean, default: true },
    notificationPush: { type: Boolean, default: true },
    schedulingRules: {
      minGapMinutes: { type: Number, default: 30 },
      maxEventsPerVenuePerDay: { type: Number, default: 5 },
      allowOverlapHighPriority: { type: Boolean, default: false },
    },
    priorityRules: {
      featuredBoost: { type: Number, default: 2 },
      audienceWeight: { type: Number, default: 0.3 },
      categoryWeights: { type: Map, of: Number },
    },
    contactEmail: { type: String, default: 'admin@metronexus.com' },
    contactPhone: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Settings = mongoose.model('Settings', settingsSchema);
