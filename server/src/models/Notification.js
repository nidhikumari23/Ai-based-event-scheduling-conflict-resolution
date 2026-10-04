import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'event_update',
        'schedule_change',
        'cancellation',
        'reminder',
        'conflict_alert',
        'registration',
        'ai_recommendation',
        'general',
      ],
      default: 'general',
    },
    isRead: { type: Boolean, default: false },
    link: { type: String, default: '' },
    broadcast: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Notification = mongoose.model('Notification', notificationSchema);
