import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: '' },
    adminReply: { type: String, default: '' },
  },
  { timestamps: true }
);

feedbackSchema.index({ user: 1, event: 1 }, { unique: true });

export const Feedback = mongoose.model('Feedback', feedbackSchema);
