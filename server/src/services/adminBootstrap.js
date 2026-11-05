import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { isStrongPassword } from '../utils/passwordPolicy.js';

const bootstrapMarkerId = 'initial-admin-bootstrap-v1';

export const bootstrapInitialAdmin = async ({ name, email, password }) => {
  if (typeof name !== 'string' || !name.trim() ||
      typeof email !== 'string' || !email.trim() ||
      !isStrongPassword(password)) {
    throw new Error('A name, email, and strong password are required for initial admin setup.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const setupMarkers = mongoose.connection.collection('setupmarkers');
      if (await setupMarkers.findOne({ _id: bootstrapMarkerId }, { session })) {
        throw new Error('Initial admin bootstrap has already been completed.');
      }
      if (await User.exists({ role: 'admin' }).session(session)) {
        throw new Error('An admin already exists; initial admin bootstrap is unavailable.');
      }
      if (await User.exists({ email: normalizedEmail }).session(session)) {
        throw new Error('The configured admin email already belongs to an account.');
      }

      await setupMarkers.insertOne({
        _id: bootstrapMarkerId,
        completedAt: new Date(),
      }, { session });
      await User.create([{
        name: name.trim(),
        email: normalizedEmail,
        password,
        role: 'admin',
        isActive: true,
      }], { session });
    });
    return { created: true };
  } finally {
    await session.endSession();
  }
};
