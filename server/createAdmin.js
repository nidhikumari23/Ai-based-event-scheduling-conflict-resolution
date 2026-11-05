
dns.setServers(['8.8.8.8', '8.8.4.4']);
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { connectDB } from './src/config/db.js';
import { bootstrapInitialAdmin } from './src/services/adminBootstrap.js';

dotenv.config({ path: resolve(fileURLToPath(new URL('.', import.meta.url)), '.env') });

const run = async () => {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be configured for admin setup.');
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured for admin setup.');
    }

    await connectDB();
    await bootstrapInitialAdmin({
      name: process.env.ADMIN_NAME || 'Festival Admin',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    console.log('Initial admin account created. Remove the bootstrap credentials from the environment.');
  } catch (error) {
    console.error(`Admin setup failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}