import { User } from '../models/User.js';

export const clearLegacyPasswordResetTokens = async () => {
  await User.updateMany(
    { resetToken: { $exists: true } },
    { $unset: { resetToken: 1, resetExpires: 1 } }
  );
};
