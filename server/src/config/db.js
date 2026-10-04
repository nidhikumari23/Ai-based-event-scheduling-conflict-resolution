import mongoose from 'mongoose';

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/festival_scheduler';
  await mongoose.connect(uri);
  console.log('MongoDB connected');
};
