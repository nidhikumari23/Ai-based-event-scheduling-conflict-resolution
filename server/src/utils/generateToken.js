import jwt from 'jsonwebtoken';

export const generateToken = (userId, role) =>
  jwt.sign({ id: userId, role }, process.env.JWT_SECRET || 'dev_secret', {
    expiresIn: '30d',
  });
