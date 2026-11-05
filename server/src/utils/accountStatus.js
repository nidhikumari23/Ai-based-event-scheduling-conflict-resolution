export const isAccountActive = (user) =>
  Boolean(user) && user.isActive !== false && user.isBlocked !== true;
