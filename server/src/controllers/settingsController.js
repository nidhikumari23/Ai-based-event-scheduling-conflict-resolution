import { Settings } from '../models/Settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const toSafeSettings = (settings) => {
  const data = settings.toObject();
  if (data.openaiApiKey) data.openaiApiKey = `••••••••${data.openaiApiKey.slice(-4)}`;
  return data;
};

export const getSettings = asyncHandler(async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  res.json(toSafeSettings(settings));
});

export const updateSettings = asyncHandler(async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = new Settings();
  const data = { ...req.body };
  if (data.openaiApiKey?.startsWith('••••')) delete data.openaiApiKey;
  Object.assign(settings, data);
  await settings.save();
  res.json(toSafeSettings(settings));
});

export const getPublicSettings = asyncHandler(async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  res.json({
    festivalName: settings.festivalName,
    festivalStartDate: settings.festivalStartDate,
    festivalEndDate: settings.festivalEndDate,
    contactEmail: settings.contactEmail,
  });
});
