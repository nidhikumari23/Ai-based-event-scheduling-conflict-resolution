import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Brand } from '../models/Brand.js';
import { Venue } from '../models/Venue.js';
import { Resource } from '../models/Resource.js';
import { Staff } from '../models/Staff.js';
import { Event } from '../models/Event.js';
import { Registration } from '../models/Registration.js';
import { Schedule } from '../models/Schedule.js';
import { Conflict } from '../models/Conflict.js';
import { Notification } from '../models/Notification.js';
import { Settings } from '../models/Settings.js';
import { Feedback } from '../models/Feedback.js';
import { detectAllConflicts } from '../utils/conflictDetector.js';

const seed = async () => {
  await connectDB();

  await Promise.all([
    User.deleteMany(),
    Category.deleteMany(),
    Brand.deleteMany(),
    Venue.deleteMany(),
    Resource.deleteMany(),
    Staff.deleteMany(),
    Event.deleteMany(),
    Registration.deleteMany(),
    Schedule.deleteMany(),
    Conflict.deleteMany(),
    Notification.deleteMany(),
    Settings.deleteMany(),
    Feedback.deleteMany(),
  ]);

  console.log('Database cleared');

  const admin = await User.create({
    name: 'Festival Admin',
    email: 'admin@metronexus.com',
    password: 'admin123',
    role: 'admin',
    phone: '+1-555-0100',
  });

  const users = await User.create([
    { name: 'Sarah Chen', email: 'sarah@example.com', password: 'user123', interests: ['Music', 'Cultural'] },
    { name: 'James Wilson', email: 'james@example.com', password: 'user123', interests: ['Technical', 'Sports'] },
    { name: 'Priya Sharma', email: 'priya@example.com', password: 'user123', interests: ['Dance', 'Food'] },
    { name: 'Marcus Lee', email: 'marcus@example.com', password: 'user123', interests: ['Music', 'Drama'] },
    { name: 'Emma Davis', email: 'emma@example.com', password: 'user123', interests: ['Cultural', 'Food'] },
    { name: 'Alex Rivera', email: 'alex@example.com', password: 'user123', interests: ['Sports', 'Technical'] },
    { name: 'Nina Patel', email: 'nina@example.com', password: 'user123', interests: ['Dance', 'Music'] },
  ]);

  const categories = await Category.create([
    { name: 'Music', description: 'Live concerts and performances', color: '#8b5cf6' },
    { name: 'Dance', description: 'Dance showcases and workshops', color: '#ec4899' },
    { name: 'Drama', description: 'Theatre and stage plays', color: '#f59e0b' },
    { name: 'Technical', description: 'Tech talks and hackathons', color: '#06b6d4' },
    { name: 'Sports', description: 'Sports tournaments and fitness', color: '#22c55e' },
    { name: 'Food', description: 'Culinary events and tastings', color: '#ef4444' },
    { name: 'Cultural', description: 'Heritage and cultural exhibitions', color: '#6366f1' },
    { name: 'Art', description: 'Visual arts and installations', color: '#a855f7' },
  ]);

  const brands = await Brand.create([
    { name: 'SoundWave Audio', sponsorshipType: 'platinum', description: 'Premium audio equipment sponsor' },
    { name: 'LumiTech Lighting', sponsorshipType: 'gold', description: 'Stage lighting solutions' },
    { name: 'FreshBite Foods', sponsorshipType: 'gold', description: 'Official food partner' },
    { name: 'TechNova', sponsorshipType: 'silver', description: 'Technology partner' },
    { name: 'UrbanWear', sponsorshipType: 'silver', description: 'Fashion and merchandise' },
    { name: 'GreenEarth', sponsorshipType: 'bronze', description: 'Sustainability partner' },
    { name: 'PulseEnergy', sponsorshipType: 'bronze', description: 'Energy drinks sponsor' },
    { name: 'CityBank', sponsorshipType: 'partner', description: 'Financial services partner' },
  ]);

  const venues = await Venue.create([
    { name: 'Grand Main Stage', location: 'Central Plaza', capacity: 5000, facilities: ['Sound system', 'LED screens', 'Backstage'] },
    { name: 'Harmony Hall', location: 'East Wing', capacity: 800, facilities: ['AC', 'Projector', 'Stage'] },
    { name: 'Innovation Arena', location: 'Tech Block', capacity: 1200, facilities: ['WiFi', 'Projector', 'Labs'] },
    { name: 'Sports Ground', location: 'North Field', capacity: 3000, facilities: ['Scoreboard', 'Bleachers'] },
    { name: 'Cultural Pavilion', location: 'Heritage Zone', capacity: 600, facilities: ['Gallery space', 'Stage'] },
    { name: 'Food Court Stage', location: 'Market Square', capacity: 400, facilities: ['Kitchen access', 'Seating'] },
    { name: 'Open Air Amphitheater', location: 'Lake View', capacity: 2000, facilities: ['Natural acoustics', 'Lighting'] },
    { name: 'Studio Black Box', location: 'Arts Building', capacity: 250, facilities: ['Flexible seating', 'Lighting rig'] },
  ]);

  const resources = await Resource.create([
    { name: 'Professional Sound System', type: 'Audio', quantity: 8, available: 6 },
    { name: 'LED Stage Lighting', type: 'Lighting', quantity: 12, available: 10 },
    { name: 'Modular Stage Platform', type: 'Stage', quantity: 6, available: 4 },
    { name: '4K Projector', type: 'AV', quantity: 10, available: 8 },
    { name: 'Folding Chairs', type: 'Furniture', quantity: 2000, available: 1500 },
    { name: 'Volunteer Team', type: 'Personnel', quantity: 100, available: 75 },
    { name: 'Security Staff', type: 'Personnel', quantity: 50, available: 40 },
    { name: 'Decoration Kit', type: 'Decor', quantity: 30, available: 25 },
  ]);

  const staff = await Staff.create([
    { name: 'David Cooper', email: 'david@staff.com', role: 'manager', phone: '+1-555-0201' },
    { name: 'Lisa Park', email: 'lisa@staff.com', role: 'coordinator', phone: '+1-555-0202' },
    { name: 'Tom Bradley', email: 'tom@staff.com', role: 'technician', phone: '+1-555-0203' },
    { name: 'Rachel Green', email: 'rachel@staff.com', role: 'host', phone: '+1-555-0204' },
    { name: 'Mike Johnson', email: 'mike@staff.com', role: 'security', phone: '+1-555-0205' },
    { name: 'Anna Kowalski', email: 'anna@staff.com', role: 'volunteer', phone: '+1-555-0206' },
    { name: 'Chris Evans', email: 'chris@staff.com', role: 'technician', phone: '+1-555-0207' },
    { name: 'Sophie Turner', email: 'sophie@staff.com', role: 'coordinator', phone: '+1-555-0208' },
  ]);

  const festivalStart = new Date();
  festivalStart.setDate(festivalStart.getDate() + 7);
  const day = (offset) => {
    const d = new Date(festivalStart);
    d.setDate(d.getDate() + offset);
    return d;
  };

  const events = await Event.create([
    {
      title: 'Opening Night Concert',
      description: 'Grand opening with headline artists and fireworks display.',
      category: categories[0]._id,
      venue: venues[0]._id,
      organizer: staff[0]._id,
      brands: [brands[0]._id, brands[1]._id],
      resources: [{ resource: resources[0]._id, quantity: 2 }, { resource: resources[1]._id, quantity: 4 }],
      staff: [staff[0]._id, staff[2]._id, staff[4]._id],
      date: day(0),
      startTime: '18:00',
      endTime: '22:00',
      expectedAudience: 4500,
      priority: 10,
      status: 'published',
      isFeatured: true,
      rules: 'No outside food. Valid ID required.',
    },
    {
      title: 'Classical Dance Showcase',
      description: 'Traditional and contemporary dance performances from renowned troupes.',
      category: categories[1]._id,
      venue: venues[1]._id,
      organizer: staff[1]._id,
      brands: [brands[5]._id],
      resources: [{ resource: resources[1]._id, quantity: 2 }, { resource: resources[3]._id, quantity: 1 }],
      staff: [staff[1]._id, staff[3]._id],
      date: day(0),
      startTime: '14:00',
      endTime: '17:00',
      expectedAudience: 650,
      priority: 7,
      status: 'published',
      isFeatured: true,
    },
    {
      title: 'Shakespeare in the Park',
      description: 'Outdoor drama performance of A Midsummer Night\'s Dream.',
      category: categories[2]._id,
      venue: venues[6]._id,
      organizer: staff[3]._id,
      brands: [brands[7]._id],
      resources: [{ resource: resources[2]._id, quantity: 1 }, { resource: resources[7]._id, quantity: 2 }],
      staff: [staff[3]._id, staff[5]._id],
      date: day(1),
      startTime: '19:00',
      endTime: '21:30',
      expectedAudience: 1800,
      priority: 8,
      status: 'published',
    },
    {
      title: 'AI & Future Tech Summit',
      description: 'Keynotes on AI, robotics, and smart city innovations.',
      category: categories[3]._id,
      venue: venues[2]._id,
      organizer: staff[0]._id,
      brands: [brands[3]._id],
      resources: [{ resource: resources[3]._id, quantity: 3 }, { resource: resources[4]._id, quantity: 200 }],
      staff: [staff[0]._id, staff[2]._id, staff[6]._id],
      date: day(1),
      startTime: '10:00',
      endTime: '16:00',
      expectedAudience: 1000,
      priority: 9,
      status: 'published',
      isFeatured: true,
    },
    {
      title: 'Inter-College Football Finals',
      description: 'Championship match with live commentary and halftime show.',
      category: categories[4]._id,
      venue: venues[3]._id,
      organizer: staff[4]._id,
      brands: [brands[6]._id],
      resources: [{ resource: resources[4]._id, quantity: 500 }, { resource: resources[6]._id, quantity: 10 }],
      staff: [staff[4]._id, staff[5]._id],
      date: day(2),
      startTime: '15:00',
      endTime: '18:00',
      expectedAudience: 2500,
      priority: 8,
      status: 'scheduled',
    },
    {
      title: 'Global Street Food Festival',
      description: 'Taste cuisines from 20 countries with live cooking demos.',
      category: categories[5]._id,
      venue: venues[5]._id,
      organizer: staff[1]._id,
      brands: [brands[2]._id],
      resources: [{ resource: resources[4]._id, quantity: 300 }, { resource: resources[5]._id, quantity: 15 }],
      staff: [staff[1]._id, staff[5]._id],
      date: day(2),
      startTime: '11:00',
      endTime: '20:00',
      expectedAudience: 380,
      priority: 6,
      status: 'published',
    },
    {
      title: 'Heritage & Craft Exhibition',
      description: 'Showcase of traditional crafts, textiles, and cultural artifacts.',
      category: categories[6]._id,
      venue: venues[4]._id,
      organizer: staff[7]._id,
      brands: [brands[5]._id, brands[7]._id],
      resources: [{ resource: resources[7]._id, quantity: 5 }, { resource: resources[4]._id, quantity: 100 }],
      staff: [staff[7]._id],
      date: day(3),
      startTime: '09:00',
      endTime: '18:00',
      expectedAudience: 500,
      priority: 5,
      status: 'published',
    },
    {
      title: 'Indie Art & Installation Night',
      description: 'Interactive art installations and live painting sessions.',
      category: categories[7]._id,
      venue: venues[7]._id,
      organizer: staff[3]._id,
      brands: [brands[4]._id],
      resources: [{ resource: resources[1]._id, quantity: 2 }, { resource: resources[2]._id, quantity: 1 }],
      staff: [staff[3]._id, staff[6]._id],
      date: day(3),
      startTime: '17:00',
      endTime: '22:00',
      expectedAudience: 220,
      priority: 6,
      status: 'scheduled',
    },
  ]);

  const registrations = await Registration.create([
    { user: users[0]._id, event: events[0]._id, status: 'approved' },
    { user: users[0]._id, event: events[1]._id, status: 'approved' },
    { user: users[1]._id, event: events[3]._id, status: 'approved' },
    { user: users[1]._id, event: events[4]._id, status: 'pending' },
    { user: users[2]._id, event: events[5]._id, status: 'approved' },
    { user: users[3]._id, event: events[0]._id, status: 'approved' },
    { user: users[4]._id, event: events[6]._id, status: 'approved' },
    { user: users[5]._id, event: events[3]._id, status: 'approved' },
  ]);

  events[0].registrationCount = 2;
  events[1].registrationCount = 1;
  events[3].registrationCount = 2;
  events[4].registrationCount = 1;
  events[5].registrationCount = 1;
  events[6].registrationCount = 1;
  await Promise.all(events.map((e) => e.save()));

  const populatedEvents = await Event.find().populate(['venue', 'resources.resource', 'staff']);
  const detectedConflicts = detectAllConflicts(populatedEvents);
  const conflicts = await Conflict.insertMany(detectedConflicts.map((c) => ({ ...c, status: 'open' })));

  await Schedule.create({
    festivalName: 'Metro Nexus Festival 2026',
    entries: events.filter((e) => e.status === 'published').map((e) => ({
      event: e._id,
      date: e.date,
      startTime: e.startTime,
      endTime: e.endTime,
      venue: e.venue,
    })),
    aiSummary: 'AI-optimized schedule prioritizing high-audience events on main stages with staggered timings to reduce venue conflicts.',
    generatedBy: 'ai',
    isPublished: true,
  });

  await Settings.create({
    festivalName: 'Metro Nexus Festival 2026',
    festivalStartDate: day(0),
    festivalEndDate: day(3),
    contactEmail: 'admin@metronexus.com',
    contactPhone: '+1-555-0100',
    schedulingRules: { minGapMinutes: 30, maxEventsPerVenuePerDay: 3, allowOverlapHighPriority: false },
  });

  await Notification.insertMany([
    { user: users[0]._id, title: 'Registration Confirmed', message: 'You are registered for Opening Night Concert!', type: 'registration' },
    { user: users[1]._id, title: 'Event Reminder', message: 'AI & Future Tech Summit starts tomorrow at 10:00 AM', type: 'reminder' },
    { user: users[2]._id, title: 'AI Recommendation', message: 'Based on your interests, check out Global Street Food Festival', type: 'ai_recommendation' },
  ]);

  await Feedback.create([
    { user: users[0]._id, event: events[0]._id, rating: 5, comment: 'Amazing opening night! World-class production.' },
    { user: users[3]._id, event: events[0]._id, rating: 4, comment: 'Great energy, slightly crowded near stage.' },
    { user: users[1]._id, event: events[3]._id, rating: 5, comment: 'Excellent speakers and networking opportunities.' },
    { user: users[2]._id, event: events[5]._id, rating: 4, comment: 'Delicious food variety, long queues at popular stalls.' },
  ]);

  console.log('\n✅ Seed completed successfully!\n');
  console.log('Admin Login: admin@metronexus.com / admin123');
  console.log('User Login:  sarah@example.com / user123');
  console.log(`Created: ${categories.length} categories, ${brands.length} brands, ${venues.length} venues`);
  console.log(`         ${resources.length} resources, ${staff.length} staff, ${events.length} events`);
  console.log(`         ${users.length} users, ${registrations.length} registrations, ${conflicts.length} conflicts\n`);

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
