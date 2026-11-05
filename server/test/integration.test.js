import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const originalEnvironment = {
  JWT_SECRET: process.env.JWT_SECRET,
  MONGODB_URI: process.env.MONGODB_URI,
  NODE_ENV: process.env.NODE_ENV,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};

let replSet;
let mongoose;
let app;
let appInstance;
let server;
let baseUrl;
let User;
let Category;
let Venue;
let Staff;
let Resource;
let Event;
let Registration;
let Schedule;
let Conflict;
let Settings;
let Notification;
let Feedback;
let fixture;

const date = '2030-06-15';
const testPassword = 'integration-test-password';
const uniqueEmail = (prefix) => `${prefix}-${randomUUID()}@example.test`;

const api = async (path, { method = 'GET', token, body } = {}) => {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  const isPdf = response.headers.get('content-type')?.includes('application/pdf');
  return {
    status: response.status,
    data: text ? (isPdf ? text : JSON.parse(text)) : null,
  };
};

const login = async (email, password = testPassword) => {
  const response = await api('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(response.status, 200);
  return response.data.token;
};

const createUser = async (prefix = 'user') => User.create({
  name: `${prefix} Fixture`,
  email: uniqueEmail(prefix),
  password: testPassword,
  role: 'user',
});

const createEvent = (overrides = {}) => Event.create({
  title: `Fixture ${randomUUID()}`,
  category: fixture.category._id,
  date: new Date(`${date}T00:00:00.000Z`),
  startTime: '10:00',
  endTime: '11:00',
  expectedAudience: 25,
  status: 'scheduled',
  venue: fixture.venue._id,
  ...overrides,
});

const eventBody = (overrides = {}) => ({
  title: `API Fixture ${randomUUID()}`,
  category: String(fixture.category._id),
  date,
  startTime: '10:00',
  endTime: '11:00',
  expectedAudience: 25,
  status: 'draft',
  ...overrides,
});

describe('isolated backend integration tests', { concurrency: false }, () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = randomBytes(48).toString('hex');
    process.env.OPENAI_API_KEY = '';

    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    const databaseName = `scheduling_integration_${randomUUID().replaceAll('-', '')}`;
    const memoryUri = replSet.getUri(databaseName);
    if (!/^mongodb:\/\/(127\.0\.0\.1|localhost):/.test(memoryUri) || !memoryUri.includes(databaseName)) {
      throw new Error('Integration tests refused a database URI that is not the generated disposable MongoDB instance.');
    }

    process.env.MONGODB_URI = memoryUri;
    ({ default: mongoose } = await import('mongoose'));
    await mongoose.connect(memoryUri, { serverSelectionTimeoutMS: 10000 });

    const models = await Promise.all([
      import('../src/models/User.js'),
      import('../src/models/Category.js'),
      import('../src/models/Venue.js'),
      import('../src/models/Staff.js'),
      import('../src/models/Resource.js'),
      import('../src/models/Event.js'),
      import('../src/models/Registration.js'),
      import('../src/models/Schedule.js'),
      import('../src/models/Conflict.js'),
      import('../src/models/Settings.js'),
      import('../src/models/Notification.js'),
      import('../src/models/Feedback.js'),
    ]);
    [
      ({ User } = models[0]),
      ({ Category } = models[1]),
      ({ Venue } = models[2]),
      ({ Staff } = models[3]),
      ({ Resource } = models[4]),
      ({ Event } = models[5]),
      ({ Registration } = models[6]),
      ({ Schedule } = models[7]),
      ({ Conflict } = models[8]),
      ({ Settings } = models[9]),
      ({ Notification } = models[10]),
      ({ Feedback } = models[11]),
    ];

    await Promise.all(models.map((modelModule) => Object.values(modelModule).find((value) => value?.init)?.init()));
    ({ createApp: app } = await import('../src/index.js'));
    appInstance = app();
    server = appInstance.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server?.listening) {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    if (mongoose?.connection.readyState) await mongoose.disconnect();
    if (replSet) await replSet.stop();
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(async () => {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((collection) => collection.deleteMany({})));

    fixture = {
      category: await Category.create({ name: `Category ${randomUUID()}` }),
      venue: await Venue.create({
        name: `Venue ${randomUUID()}`,
        location: 'Test-only location',
        capacity: 100,
        facilities: ['stage'],
      }),
      settings: await Settings.create({}),
    };
    const admin = await User.create({
      name: 'Integration Admin',
      email: uniqueEmail('admin'),
      password: testPassword,
      role: 'admin',
    });
    fixture.adminEmail = admin.email;
    fixture.adminId = admin._id;
    fixture.adminToken = await login(admin.email);
  });

  afterEach(async () => {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((collection) => collection.deleteMany({})));
  });

  it('registers a regular user, logs them in, and returns their authenticated identity', async () => {
    await User.deleteMany({ role: 'admin' });
    const email = uniqueEmail('register');
    const registered = await api('/auth/register', {
      method: 'POST',
      body: { name: 'Registered Fixture', email, password: testPassword, role: 'admin' },
    });
    assert.equal(registered.status, 201);
    assert.equal(registered.data.role, 'user');
    assert.equal(await User.countDocuments({ role: 'admin' }), 0);
    assert.ok(registered.data.token);

    const token = await login(email);
    const identity = await api('/auth/me', { token });
    assert.equal(identity.status, 200);
    assert.equal(identity.data.email, email);
    assert.equal(await User.countDocuments({ email }), 1);
  });

  it('sends single-use hashed password reset tokens without revealing account existence', async () => {
    const user = await createUser('reset-password');
    user.resetToken = 'legacy-plaintext-reset-token';
    await user.save();
    const deliveries = [];
    appInstance.locals.sendPasswordResetEmail = async (message) => deliveries.push(message);
    try {
      const unknown = await api('/auth/forgot-password', {
        method: 'POST',
        body: { email: uniqueEmail('unknown-reset') },
      });
      const requested = await api('/auth/forgot-password', {
        method: 'POST',
        body: { email: user.email.toUpperCase() },
      });
      assert.equal(unknown.status, 200);
      assert.deepEqual(requested.data, unknown.data);
      assert.equal(Object.hasOwn(requested.data, 'token'), false);
      assert.equal(Object.hasOwn(requested.data, 'resetToken'), false);
      assert.equal(deliveries.length, 1);
      assert.equal(deliveries[0].to, user.email);

      const resetLink = new URL(deliveries[0].resetUrl);
      const token = resetLink.searchParams.get('token');
      assert.ok(token);
      const storedDocument = await User.collection.findOne({ _id: user._id });
      assert.ok(storedDocument.resetTokenHash);
      assert.notEqual(storedDocument.resetTokenHash, token);
      assert.equal(Object.hasOwn(storedDocument, 'resetToken'), false);
      assert.ok(storedDocument.resetExpires > new Date());
      assert.ok(storedDocument.resetExpires <= new Date(Date.now() + 15 * 60 * 1000));

      const reset = await api('/auth/reset-password', {
        method: 'POST',
        body: { token, password: 'Reset-Password-2026!' },
      });
      assert.equal(reset.status, 200);
      assert.equal((await api('/auth/reset-password', {
        method: 'POST',
        body: { token, password: 'Another-Password-2026!' },
      })).status, 400);
      assert.equal((await api('/auth/login', {
        method: 'POST',
        body: { email: user.email, password: 'Reset-Password-2026!' },
      })).status, 200);

      const expiredRequest = await api('/auth/forgot-password', {
        method: 'POST',
        body: { email: user.email },
      });
      assert.equal(expiredRequest.status, 200);
      const expiredToken = new URL(deliveries[1].resetUrl).searchParams.get('token');
      await User.updateOne({ _id: user._id }, { resetExpires: new Date(Date.now() - 1) });
      assert.equal((await api('/auth/reset-password', {
        method: 'POST',
        body: { token: expiredToken, password: 'Expired-Password-2026!' },
      })).status, 400);
    } finally {
      delete appInstance.locals.sendPasswordResetEmail;
    }
  });

  it('does not expose reset tokens when email delivery fails', async () => {
    const user = await createUser('reset-email-failure');
    appInstance.locals.sendPasswordResetEmail = async () => {
      throw new Error('test-only delivery failure');
    };
    try {
      const response = await api('/auth/forgot-password', {
        method: 'POST',
        body: { email: user.email },
      });
      assert.equal(response.status, 200);
      assert.equal(Object.hasOwn(response.data, 'resetToken'), false);
      assert.equal(Object.hasOwn(response.data, 'token'), false);
      const storedDocument = await User.collection.findOne({ _id: user._id });
      assert.equal(Object.hasOwn(storedDocument, 'resetTokenHash'), false);
      assert.equal(Object.hasOwn(storedDocument, 'resetToken'), false);
    } finally {
      delete appInstance.locals.sendPasswordResetEmail;
    }
  });

  it('does not create or disclose reset tokens when SMTP is not configured', async () => {
    const user = await createUser('reset-no-smtp');
    const envKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'CLIENT_URL'];
    const originalValues = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    for (const key of envKeys) delete process.env[key];
    try {
      const missing = await api('/auth/forgot-password', {
        method: 'POST',
        body: { email: uniqueEmail('unknown-no-smtp') },
      });
      const existing = await api('/auth/forgot-password', {
        method: 'POST',
        body: { email: user.email },
      });
      assert.equal(missing.status, 200);
      assert.deepEqual(existing.data, missing.data);
      assert.match(existing.data.message, /configure SMTP_HOST/i);
      assert.equal(Object.hasOwn(existing.data, 'token'), false);
      const storedDocument = await User.collection.findOne({ _id: user._id });
      assert.equal(Object.hasOwn(storedDocument, 'resetTokenHash'), false);
      assert.equal(Object.hasOwn(storedDocument, 'resetToken'), false);
    } finally {
      for (const key of envKeys) {
        if (originalValues[key] === undefined) delete process.env[key];
        else process.env[key] = originalValues[key];
      }
    }
  });

  it('clears legacy plaintext reset tokens when the backend starts', async () => {
    const user = await createUser('legacy-reset-cleanup');
    await User.collection.updateOne(
      { _id: user._id },
      { $set: { resetToken: 'legacy-plaintext-token', resetExpires: new Date(Date.now() + 60_000) } }
    );
    const { clearLegacyPasswordResetTokens } = await import('../src/services/passwordResetService.js');

    await clearLegacyPasswordResetTokens();
    const storedDocument = await User.collection.findOne({ _id: user._id });
    assert.equal(Object.hasOwn(storedDocument, 'resetToken'), false);
    assert.equal(Object.hasOwn(storedDocument, 'resetExpires'), false);
  });

  it('creates the initial admin through bootstrap once and refuses duplicate bootstrap', async () => {
    const { bootstrapInitialAdmin } = await import('../src/services/adminBootstrap.js');
    await User.deleteMany({ role: 'admin' });
    const credentials = {
      name: 'Bootstrapped Admin',
      email: uniqueEmail('bootstrap-admin'),
      password: 'Initial-Admin-2026!',
    };

    assert.deepEqual(await bootstrapInitialAdmin(credentials), { created: true });
    const admin = await User.findOne({ email: credentials.email }).select('+password');
    assert.equal(admin.role, 'admin');
    assert.notEqual(admin.password, credentials.password);
    assert.equal(await admin.matchPassword(credentials.password), true);
    await assert.rejects(bootstrapInitialAdmin(credentials), /already been completed/);
    assert.equal(await User.countDocuments({ role: 'admin' }), 1);
  });

  it('rejects invalid login credentials without issuing a token', async () => {
    const response = await api('/auth/login', {
      method: 'POST',
      body: { email: fixture.adminEmail, password: 'incorrect-password' },
    });
    assert.equal(response.status, 401);
    assert.equal(await User.countDocuments(), 1);
  });

  it('requires the current password and a strong, different password before changing credentials', async () => {
    const user = await createUser('password-change');
    const token = await login(user.email);
    const strongPassword = 'Strong-Change-2026!';

    assert.equal((await api('/auth/change-password', {
      method: 'PUT',
      body: { currentPassword: testPassword, newPassword: strongPassword },
    })).status, 401);
    assert.equal((await api('/auth/change-password', {
      method: 'PUT',
      token,
      body: { newPassword: strongPassword },
    })).status, 400);
    assert.equal((await api('/auth/change-password', {
      method: 'PUT',
      token,
      body: { currentPassword: 'wrong-password', newPassword: strongPassword },
    })).status, 400);
    assert.equal((await api('/auth/change-password', {
      method: 'PUT',
      token,
      body: { currentPassword: testPassword, newPassword: 'weak' },
    })).status, 400);
    assert.equal((await api('/auth/change-password', {
      method: 'PUT',
      token,
      body: { currentPassword: testPassword, newPassword: testPassword },
    })).status, 400);

    const changed = await api('/auth/change-password', {
      method: 'PUT',
      token,
      body: { currentPassword: testPassword, newPassword: strongPassword },
    });
    assert.equal(changed.status, 200);
    assert.deepEqual(changed.data, { message: 'Password updated successfully.' });
    const storedUser = await User.findById(user._id).select('+password');
    assert.notEqual(storedUser.password, strongPassword);
    assert.equal(await storedUser.matchPassword(strongPassword), true);
    assert.equal((await api('/auth/login', {
      method: 'POST',
      body: { email: user.email, password: testPassword },
    })).status, 401);
    assert.equal((await api('/auth/login', {
      method: 'POST',
      body: { email: user.email, password: strongPassword },
    })).status, 200);
  });

  it('rejects inactive and blocked accounts at login and on already-issued tokens', async () => {
    const inactive = await createUser('inactive');
    const inactiveToken = await login(inactive.email);
    await User.updateOne({ _id: inactive._id }, { isActive: false });
    assert.equal((await api('/auth/login', {
      method: 'POST',
      body: { email: inactive.email, password: testPassword },
    })).status, 403);
    const inactiveRequest = await api('/auth/me', { token: inactiveToken });
    assert.equal(inactiveRequest.status, 403);

    const blocked = await createUser('blocked');
    const blockedToken = await login(blocked.email);
    await User.updateOne({ _id: blocked._id }, { isBlocked: true });
    assert.equal((await api('/auth/login', {
      method: 'POST',
      body: { email: blocked.email, password: testPassword },
    })).status, 403);
    assert.equal((await api('/auth/me', { token: blockedToken })).status, 403);
  });

  it('scopes notification read and delete operations to the authenticated owner', async () => {
    const owner = await createUser('notification-owner');
    const other = await createUser('notification-other');
    const ownerToken = await login(owner.email);
    const otherToken = await login(other.email);
    const notification = await Notification.create({
      user: owner._id,
      title: 'Private notification',
      message: 'Owner-only fixture',
    });

    assert.equal((await api(`/notifications/${notification._id}/read`, {
      method: 'PATCH',
      token: otherToken,
    })).status, 404);
    assert.equal((await Notification.findById(notification._id)).isRead, false);
    assert.equal((await api(`/notifications/${notification._id}`, {
      method: 'DELETE',
      token: otherToken,
    })).status, 404);
    assert.ok(await Notification.findById(notification._id));
    assert.equal((await api('/notifications/not-an-id/read', {
      method: 'PATCH',
      token: ownerToken,
    })).status, 400);

    assert.equal((await api(`/notifications/${notification._id}/read`, {
      method: 'PATCH',
      token: ownerToken,
    })).status, 200);
    assert.equal((await Notification.findById(notification._id)).isRead, true);
    assert.equal((await api(`/notifications/${notification._id}`, {
      method: 'DELETE',
      token: ownerToken,
    })).status, 200);
    assert.equal(await Notification.findById(notification._id), null);
  });

  it('never returns a configured API key in settings responses', async () => {
    const secretFixture = 'integration-only-api-key-7391';
    const updated = await api('/settings', {
      method: 'PUT',
      token: fixture.adminToken,
      body: { ...fixture.settings.toObject(), openaiApiKey: secretFixture },
    });
    assert.equal(updated.status, 200);
    assert.ok(!JSON.stringify(updated.data).includes(secretFixture));
    assert.equal(updated.data.openaiApiKey, '••••••••7391');
    assert.equal((await Settings.findById(fixture.settings._id)).openaiApiKey, secretFixture);

    const fetched = await api('/settings', { token: fixture.adminToken });
    assert.equal(fetched.status, 200);
    assert.ok(!JSON.stringify(fetched.data).includes(secretFixture));
    assert.equal(fetched.data.openaiApiKey, '••••••••7391');
    const publicSettings = await api('/settings/public');
    assert.ok(!JSON.stringify(publicSettings.data).includes(secretFixture));
  });

  it('keeps password reset fields private and prevents participant updates from assigning passwords', async () => {
    const user = await createUser('safe-user');
    user.resetToken = 'reset-token-fixture';
    user.resetTokenHash = 'hashed-reset-token-fixture';
    user.resetExpires = new Date(Date.now() + 60_000);
    await user.save();

    const listed = await api('/users', { token: fixture.adminToken });
    const listedUser = listed.data.find((entry) => entry._id === String(user._id));
    assert.ok(listedUser);
    assert.equal(Object.hasOwn(listedUser, 'password'), false);
    assert.equal(Object.hasOwn(listedUser, 'resetToken'), false);
    assert.equal(Object.hasOwn(listedUser, 'resetTokenHash'), false);
    assert.equal(Object.hasOwn(listedUser, 'resetExpires'), false);

    const updated = await api(`/users/${user._id}`, {
      method: 'PUT',
      token: fixture.adminToken,
      body: { name: 'Updated Fixture', password: 'Unsafe-Admin-Password-2026!', resetToken: 'attempted-token' },
    });
    assert.equal(updated.status, 200);
    assert.equal(Object.hasOwn(updated.data, 'password'), false);
    assert.equal(Object.hasOwn(updated.data, 'resetToken'), false);
    assert.equal(Object.hasOwn(updated.data, 'resetTokenHash'), false);
    const storedUser = await User.findById(user._id).select('+resetToken +resetTokenHash +resetExpires');
    assert.equal(storedUser.name, 'Updated Fixture');
    assert.equal(await storedUser.matchPassword(testPassword), true);
    assert.equal(storedUser.resetToken, 'reset-token-fixture');
    assert.equal(storedUser.resetTokenHash, 'hashed-reset-token-fixture');
  });

  it('requires authentication and limits admin APIs to admin accounts', async () => {
    assert.equal((await api('/dashboard/admin')).status, 401);

    const user = await createUser();
    const userToken = await login(user.email);
    assert.equal((await api('/users', { token: userToken })).status, 403);

    const adminResponse = await api('/users', { token: fixture.adminToken });
    assert.equal(adminResponse.status, 200);
    assert.equal((await api('/dashboard/admin', { token: fixture.adminToken })).status, 200);
  });

  it('lets admins and organizers manage attendance only for ended events without duplicate records', async () => {
    const organizer = await createUser('attendance-organizer');
    const promoted = await api(`/users/${organizer._id}`, {
      method: 'PUT',
      token: fixture.adminToken,
      body: { role: 'organizer' },
    });
    assert.equal(promoted.status, 200);
    assert.equal(promoted.data.role, 'organizer');
    const organizerToken = await login(organizer.email);
    const participant = await createUser('attendance-participant');
    const endedEvent = await createEvent({ date: '2024-06-15', status: 'completed' });
    const futureEvent = await createEvent({ status: 'scheduled' });
    const approved = await Registration.create({
      user: participant._id,
      event: endedEvent._id,
      status: 'approved',
    });
    const pending = await Registration.create({
      user: await createUser('attendance-pending').then((user) => user._id),
      event: endedEvent._id,
      status: 'pending',
    });
    const futureRegistration = await Registration.create({
      user: await createUser('future-attendance').then((user) => user._id),
      event: futureEvent._id,
      status: 'approved',
    });
    const participantToken = await login(participant.email);

    assert.equal((await api('/registrations/attendance/events')).status, 401);
    assert.equal((await api('/registrations/attendance/events', { token: participantToken })).status, 403);
    assert.equal((await api(`/users/${participant._id}`, {
      method: 'PUT',
      token: participantToken,
      body: { role: 'organizer' },
    })).status, 403);
    const listed = await api('/registrations/attendance/events', { token: organizerToken });
    assert.equal(listed.status, 200);
    assert.ok(listed.data.some((event) => String(event._id) === String(endedEvent._id)));
    assert.ok(!listed.data.some((event) => String(event._id) === String(futureEvent._id)));

    const initial = await api(`/registrations/attendance/events/${endedEvent._id}`, { token: organizerToken });
    assert.equal(initial.status, 200);
    assert.equal(initial.data.registrations.length, 1);

    const tooEarly = await api(`/registrations/${futureRegistration._id}/attendance`, {
      method: 'PATCH',
      token: organizerToken,
      body: { attendanceStatus: 'verified' },
    });
    assert.equal(tooEarly.status, 409);

    const present = await api(`/registrations/${approved._id}/attendance`, {
      method: 'PATCH',
      token: organizerToken,
      body: { attendanceStatus: 'verified' },
    });
    assert.equal(present.status, 200);
    assert.equal(present.data.attendanceStatus, 'verified');
    assert.equal(String(present.data.attendanceVerifiedBy._id), String(organizer._id));
    const markedAbsent = await api(`/registrations/${approved._id}/attendance`, {
      method: 'PATCH',
      token: organizerToken,
      body: { attendanceStatus: 'absent' },
    });
    assert.equal(markedAbsent.status, 200);
    assert.equal(markedAbsent.data.attendanceStatus, 'absent');
    assert.equal(String(markedAbsent.data.attendanceVerifiedBy._id), String(organizer._id));
    assert.ok(markedAbsent.data.attendanceVerifiedAt);
    const returnedPresent = await api(`/registrations/${approved._id}/attendance`, {
      method: 'PATCH',
      token: fixture.adminToken,
      body: { attendanceStatus: 'verified' },
    });
    assert.equal(returnedPresent.status, 200);
    assert.equal(await Registration.countDocuments({ event: endedEvent._id }), 2);
    assert.equal((await Registration.findById(approved._id)).attendanceStatus, 'verified');

    const refreshed = await api(`/registrations/attendance/events/${endedEvent._id}`, { token: organizerToken });
    assert.equal(refreshed.data.registrations[0].attendanceStatus, 'verified');
    assert.equal((await api(`/registrations/${pending._id}/attendance`, {
      method: 'PATCH',
      token: organizerToken,
      body: { attendanceStatus: 'verified' },
    })).status, 409);
  });

  it('submits feedback, returns populated records to admins, and scopes personal feedback', async () => {
    const event = await createEvent({ title: 'Feedback fixture event', status: 'completed', date: '2024-06-15' });
    const user = await createUser('feedback');
    const userToken = await login(user.email);
    await Registration.create({
      user: user._id,
      event: event._id,
      status: 'approved',
      attendanceStatus: 'verified',
      attendanceVerifiedAt: new Date(),
      attendanceVerifiedBy: fixture.adminId,
    });

    const submitted = await api('/feedback', {
      method: 'POST',
      token: userToken,
      body: { eventId: String(event._id), rating: 4, comment: '  Great event.  ' },
    });
    assert.equal(submitted.status, 201, submitted.data?.message);
    assert.equal(submitted.data.user.name, user.name);
    assert.equal(submitted.data.event.title, event.title);
    assert.equal(submitted.data.rating, 4);
    assert.equal(submitted.data.comment, 'Great event.');
    assert.ok(submitted.data.createdAt);

    const personal = await api('/feedback/my', { token: userToken });
    assert.equal(personal.status, 200);
    assert.equal(personal.data.length, 1);
    assert.equal(personal.data[0].event.title, event.title);

    assert.equal((await api('/feedback')).status, 401);
    assert.equal((await api('/feedback', { token: userToken })).status, 403);
    const adminList = await api('/feedback', { token: fixture.adminToken });
    assert.equal(adminList.status, 200);
    assert.equal(adminList.data.length, 1);
    assert.equal(adminList.data[0].user.name, user.name);
    assert.equal(adminList.data[0].event.title, event.title);

    const duplicate = await api('/feedback', {
      method: 'POST',
      token: userToken,
      body: { eventId: String(event._id), rating: 5, comment: 'Duplicate review' },
    });
    assert.equal(duplicate.status, 409);

    const reply = await api(`/feedback/${submitted.data._id}/reply`, {
      method: 'PATCH',
      token: fixture.adminToken,
      body: { reply: 'Thank you for sharing your feedback.' },
    });
    assert.equal(reply.status, 200);
    assert.equal(reply.data.adminReply, 'Thank you for sharing your feedback.');
    assert.equal((await api('/feedback/my', { token: userToken })).data[0].adminReply, reply.data.adminReply);
  });

  it('allows attendance updates only for completed events and returns each student’s own status', async () => {
    const user = await createUser('attendance-present');
    const otherUser = await createUser('attendance-absent');
    const userToken = await login(user.email);
    const otherToken = await login(otherUser.email);
    const event = await createEvent({
      title: 'Attendance workflow fixture',
      date: '2024-06-15',
      status: 'scheduled',
    });
    const presentRegistration = await Registration.create({
      user: user._id,
      event: event._id,
      status: 'approved',
    });
    const absentRegistration = await Registration.create({
      user: otherUser._id,
      event: event._id,
      status: 'approved',
    });
    assert.equal(presentRegistration.attendanceStatus, 'unverified');
    assert.equal(presentRegistration.attendanceVerifiedAt, null);
    assert.equal((await api(`/events/${event._id}/complete`, { method: 'PATCH' })).status, 401);
    assert.equal((await api(`/events/${event._id}/complete`, { method: 'PATCH', token: userToken })).status, 403);
    assert.equal((await api(`/registrations/${presentRegistration._id}/attendance`, {
      method: 'PATCH',
      token: userToken,
      body: { attendanceStatus: 'verified' },
    })).status, 403);
    assert.equal((await api(`/registrations/attendance/events/${event._id}`, {
      token: fixture.adminToken,
    })).status, 409);
    assert.ok(!(await api('/registrations/attendance/events', { token: fixture.adminToken }))
      .data.some((item) => String(item._id) === String(event._id)));
    assert.equal((await api(`/registrations/${presentRegistration._id}/attendance`, {
      method: 'PATCH',
      token: fixture.adminToken,
      body: { attendanceStatus: 'verified' },
    })).status, 409);

    const completeResponse = await api(`/events/${event._id}/complete`, {
      method: 'PATCH',
      token: fixture.adminToken,
    });
    assert.equal(completeResponse.status, 200, completeResponse.data?.message);
    assert.equal(completeResponse.data.status, 'completed');

    const attendanceEvents = await api('/registrations/attendance/events', { token: fixture.adminToken });
    assert.ok(attendanceEvents.data.some((item) => String(item._id) === String(event._id)));
    const attendanceReport = await api(`/registrations/attendance/events/${event._id}`, {
      token: fixture.adminToken,
    });
    assert.equal(attendanceReport.status, 200);
    assert.equal(attendanceReport.data.registrations.length, 2);
    assert.ok(attendanceReport.data.registrations.every((registration) => registration.status === 'approved'));

    const verified = await api(`/registrations/${presentRegistration._id}/attendance`, {
      method: 'PATCH',
      token: fixture.adminToken,
      body: { attendanceStatus: 'verified' },
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.data.attendanceStatus, 'verified');
    assert.equal(verified.data.attendanceVerifiedBy.name, 'Integration Admin');

    const markedAbsent = await api(`/registrations/${absentRegistration._id}/attendance`, {
      method: 'PATCH',
      token: fixture.adminToken,
      body: { attendanceStatus: 'absent' },
    });
    assert.equal(markedAbsent.status, 200);
    assert.equal(markedAbsent.data.attendanceStatus, 'absent');
    assert.equal(await Registration.countDocuments({ event: event._id }), 2);

    const feedbackResponse = await api('/feedback', {
      method: 'POST',
      token: userToken,
      body: { eventId: String(event._id), rating: 5, comment: 'Great event' },
    });
    assert.equal(feedbackResponse.status, 201, feedbackResponse.data?.message);
    const duplicateFeedback = await api('/feedback', {
      method: 'POST',
      token: userToken,
      body: { eventId: String(event._id), rating: 4, comment: 'Second review' },
    });
    assert.equal(duplicateFeedback.status, 409);

    const unauthorizedFeedback = await api('/feedback', {
      method: 'POST',
      token: otherToken,
      body: { eventId: String(event._id), rating: 4, comment: 'Not verified' },
    });
    assert.equal(unauthorizedFeedback.status, 403);

    const myEvents = await api('/registrations/my/events', { token: userToken });
    assert.equal(myEvents.status, 200);
    assert.equal(myEvents.data[0].event.status, 'completed');
    assert.equal(myEvents.data[0].attendanceStatus, 'verified');
    const myRegistrations = await api('/registrations/my', { token: userToken });
    assert.equal(myRegistrations.status, 200);
    assert.equal(myRegistrations.data[0].event.status, 'completed');
    assert.equal(myRegistrations.data[0].attendanceStatus, 'verified');
    const otherRegistrations = await api('/registrations/my', { token: otherToken });
    assert.equal(otherRegistrations.data[0].attendanceStatus, 'absent');
  });

  it('rejects event completion before its scheduled end and does not allow direct completed status writes', async () => {
    const futureEvent = await createEvent({
      title: 'Not-yet-ended event',
      date: '2035-06-15',
      startTime: '10:00',
      endTime: '11:00',
      status: 'scheduled',
    });
    const tooEarly = await api(`/events/${futureEvent._id}/complete`, {
      method: 'PATCH',
      token: fixture.adminToken,
    });
    assert.equal(tooEarly.status, 409);
    assert.equal((await Event.findById(futureEvent._id)).status, 'scheduled');

    const directComplete = await api('/events', {
      method: 'POST',
      token: fixture.adminToken,
      body: eventBody({ status: 'completed' }),
    });
    assert.equal(directComplete.status, 400);

    const directUpdate = await api(`/events/${futureEvent._id}`, {
      method: 'PUT',
      token: fixture.adminToken,
      body: { status: 'completed' },
    });
    assert.equal(directUpdate.status, 400);
    assert.equal((await Event.findById(futureEvent._id)).status, 'scheduled');
  });

  it('rejects invalid or missing event/rating feedback without saving records', async () => {
    const user = await createUser('invalid-feedback');
    const userToken = await login(user.email);
    const invalidEvent = await api('/feedback', {
      method: 'POST',
      token: userToken,
      body: { eventId: 'not-an-object-id', rating: 5, comment: 'Invalid event' },
    });
    assert.equal(invalidEvent.status, 400);

    const missingEvent = await api('/feedback', {
      method: 'POST',
      token: userToken,
      body: { eventId: '507f1f77bcf86cd799439011', rating: 5, comment: 'Missing event' },
    });
    assert.equal(missingEvent.status, 404);

    const invalidRating = await api('/feedback', {
      method: 'POST',
      token: userToken,
      body: { eventId: String((await createEvent())._id), rating: 6, comment: 'Invalid rating' },
    });
    assert.equal(invalidRating.status, 400);
    assert.equal(await Feedback.countDocuments(), 0);
  });

  it('personalizes upcoming recommendations from a participant profile, registrations, feedback, and conflicts', async () => {
    const technical = await Category.create({ name: 'Technical' });
    const workshop = await Category.create({ name: 'Workshop' });
    const user = await createUser('recommendations');
    const otherUser = await createUser('other-recommendations');
    const userToken = await login(user.email);
    const otherToken = await login(otherUser.email);

    const updatedProfile = await api('/auth/profile', {
      method: 'PUT',
      token: userToken,
      body: { interests: ['Technical', 'technical', 'Workshop'], skills: ['robotics', 'machine learning'] },
    });
    assert.equal(updatedProfile.status, 200);
    assert.deepEqual(updatedProfile.data.interests, ['Technical', 'Workshop']);
    assert.deepEqual(updatedProfile.data.skills, ['robotics', 'machine learning']);
    assert.equal(updatedProfile.data.password, undefined);

    const pastEvent = await createEvent({
      title: 'Past technical event',
      category: technical._id,
      date: '2024-06-15',
      status: 'completed',
    });
    await Registration.create({ user: user._id, event: pastEvent._id, status: 'approved' });

    const registeredOverlap = await createEvent({
      title: 'Registered workshop',
      category: workshop._id,
      date: '2030-06-16',
      startTime: '14:30',
      endTime: '15:30',
      status: 'published',
    });
    await Registration.create({ user: user._id, event: registeredOverlap._id, status: 'approved' });

    const suggested = await createEvent({
      title: 'Robotics and machine learning lab',
      description: 'Hands-on robotics and machine learning workshop.',
      category: technical._id,
      date: '2030-06-16',
      startTime: '14:00',
      endTime: '15:00',
      status: 'scheduled',
      isFeatured: true,
      registrationCount: 10,
    });
    const full = await createEvent({
      title: 'Full technical event',
      category: technical._id,
      date: '2030-06-16',
      registrationCount: fixture.venue.capacity,
    });
    const cancelled = await createEvent({
      title: 'Cancelled technical event',
      category: technical._id,
      date: '2030-06-16',
      status: 'cancelled',
    });
    const draft = await createEvent({
      title: 'Draft technical event',
      category: technical._id,
      date: '2030-06-16',
      status: 'draft',
    });
    const completed = await createEvent({
      title: 'Completed technical event',
      category: technical._id,
      date: '2030-06-16',
      status: 'completed',
    });
    const elapsed = await createEvent({
      title: 'Elapsed technical event',
      category: technical._id,
      date: '2024-06-15',
      status: 'published',
    });
    const blockedVenue = await Venue.create({
      name: `Blocked Venue ${randomUUID()}`,
      location: 'Test-only location',
      capacity: 100,
      facilities: ['stage'],
      isBlocked: true,
    });
    const venueUnavailable = await createEvent({
      title: 'Blocked venue event',
      category: technical._id,
      date: '2030-06-16',
      venue: blockedVenue._id,
    });

    const beforeFeedback = await api('/ai/recommendations', { token: userToken });
    const scoreBeforeFeedback = beforeFeedback.data.recommendations.find(
      (item) => item.eventId === String(suggested._id)
    ).matchPercentage;
    await Feedback.create({ user: user._id, event: pastEvent._id, rating: 5, comment: 'Excellent' });

    const response = await api('/ai/recommendations', { token: userToken });
    assert.equal(response.status, 200);
    assert.deepEqual(response.data.preferences, {
      interests: ['Technical', 'Workshop'],
      skills: ['robotics', 'machine learning'],
    });
    const recommendation = response.data.recommendations.find((item) => item.eventId === String(suggested._id));
    assert.ok(recommendation);
    assert.ok(recommendation.matchPercentage > 0 && recommendation.matchPercentage <= 100);
    assert.ok(recommendation.matchPercentage > scoreBeforeFeedback);
    assert.match(recommendation.explanation, /Technical interest/);
    assert.match(recommendation.explanation, /robotics/);
    assert.match(recommendation.explanation, /registered for 1 other Technical event/i);
    assert.match(recommendation.explanation, /average rating/i);
    assert.equal(recommendation.isConflicting, true);
    assert.equal(recommendation.conflicts[0].title, registeredOverlap.title);
    assert.equal(recommendation.availability.seatsRemaining, fixture.venue.capacity - suggested.registrationCount);
    for (const excluded of [full, cancelled, draft, completed, elapsed, registeredOverlap, pastEvent, venueUnavailable]) {
      assert.equal(response.data.recommendations.some((item) => item.eventId === String(excluded._id)), false);
    }
    const personalPlan = await api('/ai/personal-plan', { token: userToken });
    assert.equal(personalPlan.status, 200);
    assert.deepEqual(personalPlan.data.plan.map((item) => item.event).sort(), [
      pastEvent.title,
      registeredOverlap.title,
    ].sort());

    const otherResponse = await api('/ai/recommendations', { token: otherToken });
    assert.equal(otherResponse.status, 200);
    assert.deepEqual(otherResponse.data.preferences, { interests: [], skills: [] });
    assert.equal((await api('/ai/recommendations')).status, 401);

    const directRegistration = await api('/registrations', {
      method: 'POST',
      token: userToken,
      body: { eventId: String(suggested._id) },
    });
    assert.equal(directRegistration.status, 201);
    const refreshed = await api('/ai/recommendations', { token: userToken });
    assert.equal(refreshed.data.recommendations.some((item) => item.eventId === String(suggested._id)), false);
  });

  it('answers event assistant questions from available event records and validates requests', async () => {
    const technical = await Category.create({ name: 'Technical' });
    const user = await createUser('event-assistant');
    const userToken = await login(user.email);
    const event = await createEvent({
      title: 'Robotics showcase',
      description: 'Interactive robotics demonstrations.',
      category: technical._id,
      date: '2030-06-16',
      startTime: '13:00',
      endTime: '14:00',
      status: 'published',
    });
    await createEvent({
      title: 'Sold out robotics lab',
      category: technical._id,
      date: '2030-06-16',
      status: 'scheduled',
      registrationCount: fixture.venue.capacity,
    });
    const limitedVenue = await Venue.create({
      name: `Limited Venue ${randomUUID()}`,
      location: 'Test-only location',
      capacity: 2,
      facilities: ['stage'],
    });
    const countFull = await createEvent({
      title: 'Robotics event with full registration records',
      category: technical._id,
      date: '2030-06-16',
      status: 'scheduled',
      venue: limitedVenue._id,
      registrationCount: 0,
    });
    const attendees = await Promise.all([createUser('attendee'), createUser('attendee')]);
    await Promise.all(attendees.map((attendee) => Registration.create({
      user: attendee._id,
      event: countFull._id,
      status: 'approved',
    })));

    assert.equal((await api('/ai/event-assistant', { method: 'POST', body: { question: 'robotics' } })).status, 401);
    const invalid = await api('/ai/event-assistant', {
      method: 'POST',
      token: userToken,
      body: { question: 'x' },
    });
    assert.equal(invalid.status, 400);

    const response = await api('/ai/event-assistant', {
      method: 'POST',
      token: userToken,
      body: { question: 'Which robotics events are available?' },
    });
    assert.equal(response.status, 200);
    assert.match(response.data.answer, /Robotics showcase/);
    assert.equal(response.data.events.length, 1);
    assert.equal(response.data.events[0]._id, String(event._id));

    const generalQuestion = await api('/ai/event-assistant', {
      method: 'POST',
      token: userToken,
      body: { question: 'What upcoming events are available?' },
    });
    assert.equal(generalQuestion.status, 200);
    assert.equal(generalQuestion.data.events.length, 1);
    assert.equal(generalQuestion.data.events[0]._id, String(event._id));
  });

  it('returns created scheduled events in the admin dashboard and excludes drafts on reload', async () => {
    const scheduled = await api('/events', {
      method: 'POST',
      token: fixture.adminToken,
      body: eventBody({
        title: 'Dashboard upcoming scheduled event',
        status: 'scheduled',
        venue: String(fixture.venue._id),
        date: '2030-06-16',
        startTime: '10:00',
        endTime: '11:00',
      }),
    });
    assert.equal(scheduled.status, 201, scheduled.data?.message);

    const draft = await api('/events', {
      method: 'POST',
      token: fixture.adminToken,
      body: eventBody({
        title: 'Dashboard future draft',
        status: 'draft',
        date: '2030-06-17',
      }),
    });
    assert.equal(draft.status, 201, draft.data?.message);

    const firstLoad = await api('/dashboard/admin', { token: fixture.adminToken });
    assert.equal(firstLoad.status, 200);
    assert.deepEqual(firstLoad.data.upcomingEvents.map((event) => event.title), [
      'Dashboard upcoming scheduled event',
    ]);
    assert.equal(firstLoad.data.upcomingEvents[0].category.name, fixture.category.name);
    assert.equal(firstLoad.data.upcomingEvents[0].venue.name, fixture.venue.name);
    assert.equal(firstLoad.data.stats.totalEvents, 2);
    assert.equal(firstLoad.data.stats.scheduledEvents, 1);

    const refreshed = await api('/dashboard/admin', { token: fixture.adminToken });
    assert.deepEqual(refreshed.data.upcomingEvents.map((event) => event._id), [
      scheduled.data._id,
    ]);
    assert.equal(refreshed.data.stats.totalEvents, 2);
  });

  it('creates a category through the API and uses its listed ID to create an event', async () => {
    const categoryName = `API-created category ${randomUUID()}`;
    const createdCategory = await api('/categories', {
      method: 'POST',
      token: fixture.adminToken,
      body: { name: categoryName, description: 'Created by isolated integration test' },
    });
    assert.equal(createdCategory.status, 201);
    assert.equal(createdCategory.data.name, categoryName);
    assert.ok(createdCategory.data._id);

    const storedCategory = await Category.findById(createdCategory.data._id);
    assert.equal(storedCategory.name, categoryName);
    assert.equal(storedCategory.isActive, true);

    const listedCategories = await api('/categories?all=true', { token: fixture.adminToken });
    assert.equal(listedCategories.status, 200);
    assert.ok(Array.isArray(listedCategories.data));
    const listedCategory = listedCategories.data.find((category) => category.name === categoryName);
    assert.ok(listedCategory);
    assert.equal(String(listedCategory._id), String(createdCategory.data._id));

    const createdEvent = await api('/events', {
      method: 'POST',
      token: fixture.adminToken,
      body: eventBody({ category: String(listedCategory._id) }),
    });
    assert.equal(createdEvent.status, 201);
    assert.equal(String(createdEvent.data.category._id), String(listedCategory._id));

    const storedEvent = await Event.findById(createdEvent.data._id);
    assert.equal(String(storedEvent.category), String(listedCategory._id));
  });

  it('loads event form options and saves selected database IDs on an event', async () => {
    const organizer = await Staff.create({
      name: 'Actual organizer fixture',
      email: uniqueEmail('organizer'),
      role: 'coordinator',
    });
    const assignedStaff = await Staff.create({
      name: 'Assigned staff fixture',
      email: uniqueEmail('assigned-staff'),
      role: 'technician',
    });
    const resource = await Resource.create({
      name: 'Event resource fixture',
      type: 'equipment',
      quantity: 3,
      available: 3,
    });

    for (const [path, expectedId, expectedName] of [
      ['/categories?all=true', fixture.category._id, fixture.category.name],
      ['/venues', fixture.venue._id, fixture.venue.name],
      ['/staff', organizer._id, organizer.name],
      ['/resources', resource._id, resource.name],
    ]) {
      const response = await api(path, { token: fixture.adminToken });
      assert.equal(response.status, 200, `${path} should return successfully`);
      assert.ok(Array.isArray(response.data), `${path} should return an array`);
      assert.ok(response.data.some((item) =>
        String(item._id) === String(expectedId) && item.name === expectedName
      ), `${path} should include the actual database record`);
    }

    const created = await api('/events', {
      method: 'POST',
      token: fixture.adminToken,
      body: eventBody({
        venue: String(fixture.venue._id),
        organizer: String(organizer._id),
        staff: [String(assignedStaff._id)],
        resources: [{ resource: String(resource._id), quantity: 2 }],
      }),
    });
    assert.equal(created.status, 201);
    assert.equal(String(created.data.category._id), String(fixture.category._id));
    assert.equal(String(created.data.venue._id), String(fixture.venue._id));
    assert.equal(String(created.data.organizer._id), String(organizer._id));
    assert.equal(created.data.organizer.name, organizer.name);
    assert.equal(String(created.data.staff[0]._id), String(assignedStaff._id));
    assert.equal(String(created.data.resources[0].resource._id), String(resource._id));
    assert.equal(created.data.resources[0].quantity, 2);
    const stored = await Event.findById(created.data._id);
    assert.equal(String(stored.category), String(fixture.category._id));
    assert.equal(String(stored.venue), String(fixture.venue._id));
    assert.equal(String(stored.organizer), String(organizer._id));
    assert.equal(String(stored.staff[0]), String(assignedStaff._id));
    assert.equal(String(stored.resources[0].resource), String(resource._id));
    assert.equal(stored.resources[0].quantity, 2);

    const listed = await api('/events', { token: fixture.adminToken });
    assert.equal(listed.status, 200);
    assert.ok(listed.data.some((event) => String(event._id) === String(created.data._id)));

    const invalidCategory = await api('/events', {
      method: 'POST',
      token: fixture.adminToken,
      body: eventBody({ category: '' }),
    });
    assert.equal(invalidCategory.status, 400);
    assert.equal(invalidCategory.data.message, 'A valid event category is required.');
    assert.equal(await Event.countDocuments(), 1);
  });

  it('allows an admin to create and update an event and persists the changes', async () => {
    const created = await api('/events', {
      method: 'POST',
      token: fixture.adminToken,
      body: eventBody(),
    });
    assert.equal(created.status, 201);

    const updated = await api(`/events/${created.data._id}`, {
      method: 'PUT',
      token: fixture.adminToken,
      body: { title: 'Updated integration event', description: 'Persisted update' },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.title, 'Updated integration event');
    const stored = await Event.findById(created.data._id);
    assert.equal(stored.title, 'Updated integration event');
    assert.equal(stored.description, 'Persisted update');
  });

  it('lets an admin approve a participant registration and persists the approval', async () => {
    const user = await createUser();
    const event = await createEvent({ status: 'published' });
    const userToken = await login(user.email);
    const created = await api('/registrations', {
      method: 'POST',
      token: userToken,
      body: { eventId: String(event._id) },
    });
    assert.equal(created.status, 201);

    const approved = await api(`/registrations/${created.data._id}/status`, {
      method: 'PATCH',
      token: fixture.adminToken,
      body: { status: 'approved' },
    });
    assert.equal(approved.status, 200);
    assert.equal((await Registration.findById(created.data._id)).status, 'approved');
  });

  it('generates, validates, approves, and rechecks a schedule against stored events', async () => {
    const event = await createEvent({ status: 'draft', venue: undefined });
    const generated = await api('/ai/schedule/generate', {
      method: 'POST',
      token: fixture.adminToken,
      body: { startDate: date, endDate: date },
    });
    assert.equal(generated.status, 200);
    assert.equal(generated.data.assignments.length, 1, JSON.stringify(generated.data));

    const proposal = {
      assignments: generated.data.assignments,
      eventVersions: generated.data.eventVersions,
      scheduleRevision: generated.data.scheduleRevision,
      summary: generated.data.summary,
    };
    const validation = await api('/schedules/validate', {
      method: 'POST',
      token: fixture.adminToken,
      body: proposal,
    });
    assert.equal(validation.status, 200);
    assert.equal(validation.data.valid, true);

    const approved = await api('/schedules/approve', {
      method: 'POST',
      token: fixture.adminToken,
      body: proposal,
    });
    assert.equal(approved.status, 200);
    assert.equal((await Event.findById(event._id)).status, 'scheduled');
    assert.equal(await Schedule.countDocuments(), 1);
    assert.equal((await Schedule.findOne()).entries.length, 1);

    const scan = await api('/conflicts/detect', {
      method: 'POST',
      token: fixture.adminToken,
    });
    assert.equal(scan.status, 200);
    assert.equal(scan.data.count, 0);
  });

  it('keeps schedule writes locked until an admin unlocks, then revalidates saves and event updates', async () => {
    const event = await createEvent();
    const locked = await api('/schedules/lock', {
      method: 'PATCH',
      token: fixture.adminToken,
      body: { reason: 'Changes paused during final review.' },
    });
    assert.equal(locked.status, 200);
    assert.equal(locked.data.isLocked, true);
    assert.equal(locked.data.lockReason, 'Changes paused during final review.');
    assert.ok(locked.data.lockedAt);
    assert.equal(String(locked.data.lockedBy), String((await User.findOne({ email: fixture.adminEmail }))._id));

    const rejectedUpdate = await api(`/events/${event._id}`, {
      method: 'PUT',
      token: fixture.adminToken,
      body: { startTime: '11:00', endTime: '12:00' },
    });
    assert.equal(rejectedUpdate.status, 409);
    assert.match(rejectedUpdate.data.message, /Schedule is locked/);

    const rejectedSave = await api('/schedules', {
      method: 'POST',
      token: fixture.adminToken,
      body: { entries: [{ event: String(event._id), date, startTime: '10:00', endTime: '11:00', venue: String(fixture.venue._id) }] },
    });
    assert.equal(rejectedSave.status, 409);
    assert.match(rejectedSave.data.message, /Schedule is locked/);

    const user = await createUser();
    const deniedUnlock = await api('/schedules/unlock', {
      method: 'PATCH',
      token: await login(user.email),
    });
    assert.equal(deniedUnlock.status, 403);
    assert.equal((await Schedule.findOne()).isLocked, true);

    const unlocked = await api('/schedules/unlock', {
      method: 'PATCH',
      token: fixture.adminToken,
    });
    assert.equal(unlocked.status, 200);
    assert.equal(unlocked.data.isLocked, false);
    assert.equal(unlocked.data.lockReason, '');
    assert.equal(unlocked.data.lockedAt, null);
    assert.equal(unlocked.data.lockedBy, null);

    const updated = await api(`/events/${event._id}`, {
      method: 'PUT',
      token: fixture.adminToken,
      body: { startTime: '11:00', endTime: '12:00' },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.startTime, '11:00');
    assert.equal(updated.data.endTime, '12:00');

    const saved = await api('/schedules', {
      method: 'POST',
      token: fixture.adminToken,
      body: { entries: [{ event: String(event._id), date, startTime: '11:00', endTime: '12:00', venue: String(fixture.venue._id) }] },
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.isLocked, false);
    assert.equal(saved.data.entries.length, 1);
    assert.equal((await Event.findById(event._id)).startTime, '11:00');
  });

  it('allows drafts while locked, blocks scheduling until admin unlock, then validates and relocks', async () => {
    const locked = await api('/schedules/lock', {
      method: 'PATCH',
      token: fixture.adminToken,
      body: { reason: 'Protect existing published bookings.' },
    });
    assert.equal(locked.status, 200);
    assert.equal(locked.data.isLocked, true);

    const draft = await api('/events', {
      method: 'POST',
      token: fixture.adminToken,
      body: eventBody({ status: 'draft' }),
    });
    assert.equal(draft.status, 201, draft.data?.message);
    assert.equal(draft.data.status, 'draft');
    assert.equal(await Schedule.findOne().then((schedule) => schedule.entries.length), 0);

    const blockedWhileLocked = await api('/events', {
      method: 'POST',
      token: fixture.adminToken,
      body: eventBody({ status: 'scheduled', venue: String(fixture.venue._id) }),
    });
    assert.equal(blockedWhileLocked.status, 409);
    assert.match(blockedWhileLocked.data.message, /admin must unlock/i);
    assert.match(blockedWhileLocked.data.message, /Protect existing published bookings/);
    assert.equal(await Event.countDocuments({ status: 'scheduled' }), 0);

    const user = await createUser();
    const deniedCreate = await api('/events', {
      method: 'POST',
      token: await login(user.email),
      body: eventBody({ status: 'scheduled', venue: String(fixture.venue._id), startTime: '12:00', endTime: '13:00' }),
    });
    assert.equal(deniedCreate.status, 403);

    const unlocked = await api('/schedules/unlock', {
      method: 'PATCH',
      token: fixture.adminToken,
    });
    assert.equal(unlocked.status, 200);
    assert.equal(unlocked.data.isLocked, false);

    const scheduled = await api('/events', {
      method: 'POST',
      token: fixture.adminToken,
      body: eventBody({ status: 'scheduled', venue: String(fixture.venue._id) }),
    });
    assert.equal(scheduled.status, 201, scheduled.data?.message);
    assert.equal(scheduled.data.status, 'scheduled');
    assert.equal((await Schedule.findOne()).entries.length, 1);

    const conflicting = await api('/events', {
      method: 'POST',
      token: fixture.adminToken,
      body: eventBody({ status: 'scheduled', venue: String(fixture.venue._id) }),
    });
    assert.equal(conflicting.status, 409);
    assert.match(conflicting.data.message, /conflicts/i);
    assert.ok(conflicting.data.details.conflicts.some((conflict) =>
      ['VENUE_CONFLICT', 'TIME_CONFLICT', 'BUFFER_CONFLICT'].includes(conflict.code)
    ));
    assert.equal(await Event.countDocuments({ status: 'scheduled' }), 1);

    const relocked = await api('/schedules/lock', {
      method: 'PATCH',
      token: fixture.adminToken,
      body: { reason: 'Schedule finalized.' },
    });
    assert.equal(relocked.status, 200);
    assert.equal(relocked.data.isLocked, true);

    const blockedAfterRelock = await api('/events', {
      method: 'POST',
      token: fixture.adminToken,
      body: eventBody({ status: 'scheduled', venue: String(fixture.venue._id), startTime: '12:00', endTime: '13:00' }),
    });
    assert.equal(blockedAfterRelock.status, 409);
    assert.match(blockedAfterRelock.data.message, /admin must unlock/i);
    assert.equal(await Event.countDocuments({ status: 'scheduled' }), 1);
  });

  it('handles schedule generation and conflict scans when optional settings are absent', async () => {
    await createEvent();
    await Settings.deleteMany({});

    const generated = await api('/ai/schedule/generate', {
      method: 'POST',
      token: fixture.adminToken,
      body: { startDate: date, endDate: date },
    });
    const scan = await api('/conflicts/detect', {
      method: 'POST',
      token: fixture.adminToken,
    });

    assert.deepEqual([generated.status, scan.status], [200, 200]);
    assert.equal(await Schedule.countDocuments(), 0);
    assert.equal(await Conflict.countDocuments(), 0);
    assert.equal(await Event.countDocuments(), 1);
  });

  it('returns a ranked proposal matching the frontend contract without saving it', async () => {
    const event = await createEvent({ status: 'draft', venue: undefined });
    await Settings.deleteMany({});
    const scheduleBefore = await Schedule.countDocuments();

    assert.equal((await api('/ai/schedule/generate', {
      method: 'POST',
      body: { startDate: date, endDate: date },
    })).status, 401);
    const user = await createUser();
    assert.equal((await api('/ai/schedule/generate', {
      method: 'POST',
      token: await login(user.email),
      body: { startDate: date, endDate: date },
    })).status, 403);

    const response = await api('/ai/schedule/generate', {
      method: 'POST',
      token: fixture.adminToken,
      body: { startDate: date, endDate: date },
    });

    assert.equal(response.status, 200, response.data?.message);
    assert.ok(Array.isArray(response.data.assignments));
    assert.ok(Array.isArray(response.data.unscheduled));
    assert.equal(response.data.assignments.length, 1);
    assert.equal(response.data.assignments[0].eventId, String(event._id));
    assert.equal(typeof response.data.assignments[0].score, 'number');
    assert.equal(typeof response.data.summary, 'string');
    assert.equal(typeof response.data.eventVersions[String(event._id)], 'string');
    assert.equal(typeof response.data.scheduleRevision, 'number');
    assert.equal(response.data.aiEnabled, false);
    assert.equal(await Schedule.countDocuments(), scheduleBefore);
    assert.equal((await Event.findById(event._id)).status, 'draft');
  });

  it('returns an empty proposal when there is no scheduling data', async () => {
    await Promise.all([
      Event.deleteMany({}),
      Venue.deleteMany({}),
      Resource.deleteMany({}),
      Staff.deleteMany({}),
      Settings.deleteMany({}),
      Schedule.deleteMany({}),
    ]);

    const response = await api('/ai/schedule/generate', {
      method: 'POST',
      token: fixture.adminToken,
      body: { startDate: date, endDate: date },
    });

    assert.equal(response.status, 200, response.data?.message);
    assert.deepEqual(response.data.assignments, []);
    assert.deepEqual(response.data.unscheduled, []);
    assert.equal(response.data.scheduleRevision, 0);
    assert.equal(await Event.countDocuments(), 0);
  });

  it('returns malformed stored event timing as unscheduled instead of failing proposal generation', async () => {
    const event = await createEvent({ status: 'draft' });
    await Event.collection.updateOne({ _id: event._id }, { $set: { startTime: 'not-a-time' } });

    const response = await api('/ai/schedule/generate', {
      method: 'POST',
      token: fixture.adminToken,
      body: { startDate: date, endDate: date },
    });

    assert.equal(response.status, 200, response.data?.message);
    assert.deepEqual(response.data.assignments, []);
    assert.equal(response.data.unscheduled[0].eventId, String(event._id));
    assert.match(response.data.unscheduled[0].reason, /invalid date or time/i);
  });

  it('returns a useful client error for an invalid ranked proposal search window', async () => {
    const response = await api('/ai/schedule/generate', {
      method: 'POST',
      token: fixture.adminToken,
      body: { startDate: '2027-02-31', endDate: '2027-03-01' },
    });
    assert.equal(response.status, 400);
    assert.equal(response.data.code, 'INVALID_SCHEDULING_WINDOW');
    assert.match(response.data.message, /startDate must be a valid YYYY-MM-DD date/);

    const malformedOptions = await api('/ai/schedule/generate', {
      method: 'POST',
      token: fixture.adminToken,
      body: { startDate: 20270228 },
    });
    assert.equal(malformedOptions.status, 400);
    assert.equal(malformedOptions.data.code, 'INVALID_SCHEDULE_REQUEST');
    assert.match(malformedOptions.data.message, /YYYY-MM-DD/);
  });

  it('detects venue double booking from persisted scheduled events', async () => {
    await createEvent();
    await createEvent();

    const response = await api('/conflicts/detect', {
      method: 'POST',
      token: fixture.adminToken,
    });
    assert.equal(response.status, 200);
    assert.ok(response.data.conflicts.some((conflict) => conflict.type === 'venue'));
    assert.ok(response.data.conflicts.some((conflict) => conflict.type === 'timing'));
    assert.equal(await Conflict.countDocuments({ status: 'open' }), response.data.count);
    await api('/conflicts/detect', {
      method: 'POST',
      token: fixture.adminToken,
    });
    assert.equal(await Conflict.countDocuments({ status: 'open' }), response.data.count);
  });

  it('persists detected timing conflicts, reports record-based counters, and resolves cleared conflicts', async () => {
    const first = await createEvent({ title: 'Persisted timing event A' });
    const second = await createEvent({
      title: 'Persisted timing event B',
      startTime: '10:30',
      endTime: '11:30',
    });

    const scan = await api('/conflicts/detect', {
      method: 'POST',
      token: fixture.adminToken,
    });
    assert.equal(scan.status, 200);
    assert.ok(scan.data.conflicts.some((conflict) =>
      conflict.type === 'timing' &&
      conflict.events.map(String).includes(String(first._id)) &&
      conflict.events.map(String).includes(String(second._id))
    ));
    assert.equal(await Conflict.countDocuments({ status: 'open', type: 'timing' }), 1);

    const summary = await api('/conflicts/summary', { token: fixture.adminToken });
    assert.equal(summary.status, 200);
    assert.equal(summary.data.timing, 1);
    assert.equal(summary.data.pending, 2);
    assert.equal(summary.data.total, 2);

    const listed = await api('/conflicts?status=open&type=timing', { token: fixture.adminToken });
    assert.equal(listed.status, 200);
    assert.equal(listed.data[0].events.length, 2);
    assert.deepEqual(
      listed.data[0].events.map((event) => event.title).sort(),
      ['Persisted timing event A', 'Persisted timing event B']
    );
    assert.match(listed.data[0].description, /overlap in time/i);

    await Event.updateOne({ _id: second._id }, { $set: { startTime: '12:00', endTime: '13:00' } });
    const refreshed = await api('/conflicts/detect', {
      method: 'POST',
      token: fixture.adminToken,
    });
    assert.equal(refreshed.status, 200);
    assert.equal(refreshed.data.count, 0);

    const resolved = await api('/conflicts?status=resolved', { token: fixture.adminToken });
    assert.equal(resolved.status, 200);
    assert.equal(resolved.data.length, 2);
    assert.ok(resolved.data.every((conflict) => /no longer detected/i.test(conflict.resolution)));
    const refreshedSummary = await api('/conflicts/summary', { token: fixture.adminToken });
    assert.equal(refreshedSummary.data.pending, 0);
    assert.equal(refreshedSummary.data.resolved, 2);
    assert.equal(refreshedSummary.data.total, 2);
  });

  it('persists failed event validation, deduplicates it, suggests a feasible solution, and resolves after retry', async () => {
    const assignedStaff = await Staff.create({
      name: 'Jyoti Kumari',
      email: uniqueEmail('jyoti'),
      role: 'technician',
    });
    const replacementStaff = await Staff.create({
      name: 'Available technician',
      email: uniqueEmail('replacement'),
      role: 'technician',
    });
    const alternativeVenue = await Venue.create({
      name: 'Sound-ready venue',
      location: 'Test-only location',
      capacity: 100,
      facilities: ['stage', 'sound box'],
    });
    await createEvent({
      title: 'Existing Jyoti booking',
      staff: [assignedStaff._id],
    });

    const attempted = eventBody({
      title: 'Rejected sound event',
      status: 'scheduled',
      venue: String(fixture.venue._id),
      staff: [String(assignedStaff._id)],
      requiredFacilities: ['sound box'],
      date,
      startTime: '10:00',
      endTime: '11:00',
    });
    const failed = await api('/events', {
      method: 'POST',
      token: fixture.adminToken,
      body: attempted,
    });
    assert.equal(failed.status, 409);
    assert.ok(failed.data.details.conflicts.some((conflict) => conflict.code === 'VENUE_CONFLICT'));
    assert.ok(failed.data.details.conflicts.some((conflict) => conflict.code === 'STAFF_CONFLICT'));
    assert.equal(await Event.countDocuments({ title: 'Rejected sound event' }), 0);

    const records = await Conflict.find({ status: 'open' });
    assert.ok(records.some((conflict) =>
      conflict.type === 'venue' &&
      conflict.proposedEvent?.title === 'Rejected sound event' &&
      String(conflict.proposedEvent.venue) === String(fixture.venue._id) &&
      conflict.eventDetails.some((event) => event.title === 'Rejected sound event') &&
      conflict.detectedAt instanceof Date
    ));
    assert.ok(records.some((conflict) =>
      conflict.type === 'staff' &&
      String(conflict.staff) === String(assignedStaff._id) &&
      conflict.proposedEvent?.title === 'Rejected sound event'
    ));

    const repeated = await api('/events', {
      method: 'POST',
      token: fixture.adminToken,
      body: attempted,
    });
    assert.equal(repeated.status, 409);
    assert.equal(await Conflict.countDocuments({ status: 'open' }), records.length);

    const scan = await api('/conflicts/detect', {
      method: 'POST',
      token: fixture.adminToken,
    });
    assert.equal(scan.status, 200);
    assert.equal(await Conflict.countDocuments({ status: 'open' }), records.length);
    const dashboard = await api('/conflicts/summary', { token: fixture.adminToken });
    assert.equal(dashboard.data.pending, records.length);
    assert.equal(dashboard.data.total, records.length);
    assert.ok(dashboard.data.venue > 0);
    assert.ok(dashboard.data.staff > 0);

    const staffConflict = records.find((conflict) => conflict.type === 'staff');
    const suggestions = await api(`/conflicts/${staffConflict._id}/ai-suggestion`, {
      token: fixture.adminToken,
    });
    assert.equal(suggestions.status, 200, suggestions.data?.message);
    const selected = suggestions.data.suggestions.find((suggestion) =>
      suggestion.feasible &&
      suggestion.availability.staff.some((member) => member.id === String(replacementStaff._id)) &&
      suggestion.availability.venue.facilitiesAvailable
    );
    assert.ok(selected, 'expected a feasible proposal using the available technician and sound-ready venue');

    const saved = await api('/events', {
      method: 'POST',
      token: fixture.adminToken,
      body: {
        ...selected.eventPayload,
        resolutionConflictId: String(staffConflict._id),
      },
    });
    assert.equal(saved.status, 201, saved.data?.message);
    const resolved = await Conflict.findById(staffConflict._id);
    assert.equal(resolved.status, 'resolved');
    assert.match(resolved.resolution, /saved after backend schedule revalidation/i);
    assert.equal(await Conflict.countDocuments({
      proposalFingerprint: staffConflict.proposalFingerprint,
      status: 'open',
    }), 0);
    const resolvedTab = await api('/conflicts?status=resolved', { token: fixture.adminToken });
    assert.equal(resolvedTab.status, 200);
    assert.ok(resolvedTab.data.filter((conflict) =>
      conflict.proposalFingerprint === staffConflict.proposalFingerprint
    ).length >= 2);
    const afterResolution = await api('/conflicts/summary', { token: fixture.adminToken });
    assert.equal(afterResolution.data.pending, 0);
    assert.ok(afterResolution.data.resolved > 0);
    assert.equal(await Event.countDocuments({ title: 'Rejected sound event' }), 1);
  });

  it('persists rejected existing-event schedule updates without changing the saved event', async () => {
    const assignedStaff = await Staff.create({
      name: 'Update conflict technician',
      email: uniqueEmail('update-conflict-staff'),
      role: 'technician',
    });
    const alternateVenue = await Venue.create({
      name: 'Update target venue',
      location: 'Test-only location',
      capacity: 100,
      facilities: ['sound box'],
    });
    await createEvent({
      title: 'Existing update blocker',
      staff: [assignedStaff._id],
    });
    const target = await createEvent({
      title: 'Rejected schedule update',
      venue: alternateVenue._id,
      startTime: '12:00',
      endTime: '13:00',
    });

    const response = await api(`/events/${target._id}`, {
      method: 'PUT',
      token: fixture.adminToken,
      body: {
        date,
        startTime: '10:00',
        endTime: '11:00',
        venue: String(fixture.venue._id),
        staff: [String(assignedStaff._id)],
        requiredFacilities: ['sound box'],
      },
    });
    assert.equal(response.status, 409);
    assert.ok(response.data.details.conflicts.some((conflict) => conflict.code === 'STAFF_CONFLICT'));

    const persistedConflict = await Conflict.findOne({
      type: 'staff',
      'proposedEvent.isNewEvent': false,
      'proposedEvent.title': 'Rejected schedule update',
    });
    assert.ok(persistedConflict);
    assert.ok(persistedConflict.events.map(String).includes(String(target._id)));
    assert.equal(persistedConflict.proposedEvent.startTime, '10:00');
    const unchanged = await Event.findById(target._id);
    assert.equal(String(unchanged.venue), String(alternateVenue._id));
    assert.equal(unchanged.startTime, '12:00');
  });

  it('detects overlapping staff assignments and resource over-allocation', async () => {
    const secondVenue = await Venue.create({
      name: `Second venue ${randomUUID()}`,
      location: 'Test-only location',
      capacity: 100,
    });
    const staff = await Staff.create({
      name: 'Shared fixture staff',
      email: uniqueEmail('staff'),
      role: 'technician',
    });
    const resource = await Resource.create({
      name: 'Single fixture resource',
      type: 'equipment',
      quantity: 1,
      available: 1,
    });

    await createEvent({
      staff: [staff._id],
      resources: [{ resource: resource._id, quantity: 1 }],
    });
    await createEvent({
      venue: secondVenue._id,
      staff: [staff._id],
      resources: [{ resource: resource._id, quantity: 1 }],
    });

    const response = await api('/conflicts/detect', {
      method: 'POST',
      token: fixture.adminToken,
    });
    assert.equal(response.status, 200);
    assert.ok(response.data.conflicts.some((conflict) => conflict.type === 'staff'));
    assert.ok(response.data.conflicts.some((conflict) => conflict.type === 'resource'));
  });

  it('enforces event registration capacity and leaves counts consistent when full', async () => {
    fixture.venue.capacity = 1;
    await fixture.venue.save();
    const event = await createEvent({ status: 'published', expectedAudience: 1 });
    const firstUser = await createUser('capacity-one');
    const secondUser = await createUser('capacity-two');

    const first = await api('/registrations', {
      method: 'POST',
      token: await login(firstUser.email),
      body: { eventId: String(event._id) },
    });
    const second = await api('/registrations', {
      method: 'POST',
      token: await login(secondUser.email),
      body: { eventId: String(event._id) },
    });

    assert.equal(first.status, 201);
    assert.equal(second.status, 400);
    assert.equal(await Registration.countDocuments({ event: event._id }), 1);
    assert.equal((await Event.findById(event._id)).registrationCount, 1);
  });

  it('allows only one concurrent scheduled booking for the same venue and time', async () => {
    const requests = [0, 1].map((index) => api('/events', {
      method: 'POST',
      token: fixture.adminToken,
      body: eventBody({
        title: `Concurrent booking ${index} ${randomUUID()}`,
        status: 'scheduled',
        venue: String(fixture.venue._id),
      }),
    }));
    const results = await Promise.all(requests);

    assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
    assert.equal(await Event.countDocuments({ status: 'scheduled', venue: fixture.venue._id }), 1);
    assert.equal((await Schedule.findOne()).entries.length, 1);
  });

  it('returns specific schedule conflict codes and accepts feasible buffered bookings', async () => {
    const availableStaff = await Staff.create({
      name: 'Available staff fixture',
      email: uniqueEmail('available-staff'),
      role: 'technician',
    });
    const availableResource = await Resource.create({
      name: 'Available resource fixture',
      type: 'equipment',
      quantity: 3,
      available: 3,
    });
    const basePayload = {
      ...eventBody({
        status: 'scheduled',
        venue: String(fixture.venue._id),
        staff: [String(availableStaff._id)],
        resources: [{ resource: String(availableResource._id), quantity: 1 }],
      }),
      date,
      startTime: '10:00',
      endTime: '11:00',
    };
    const createScheduled = (overrides = {}) => api('/events', {
      method: 'POST',
      token: fixture.adminToken,
      body: { ...basePayload, ...overrides },
    });

    const freeBooking = await createScheduled({ title: 'Free venue fixture' });
    assert.equal(freeBooking.status, 201);

    const venueConflict = await createScheduled({ title: 'Venue overlap fixture' });
    assert.equal(venueConflict.status, 409);
    assert.ok(venueConflict.data.details.conflicts.some((conflict) =>
      conflict.code === 'VENUE_CONFLICT' &&
      conflict.eventDetails.some((event) => event.title === 'Free venue fixture')
    ));
    assert.ok(venueConflict.data.details.conflicts.some((conflict) =>
      conflict.code === 'TIME_CONFLICT' &&
      conflict.eventDetails.some((event) => event.title === 'Free venue fixture')
    ));

    const assignedStaff = await Staff.create({
      name: 'Conflict staff fixture',
      email: uniqueEmail('conflict-staff'),
      role: 'technician',
    });
    const staffVenue = await Venue.create({
      name: 'Staff conflict venue fixture',
      location: 'Test-only location',
      capacity: 100,
    });
    const staffBooking = await createScheduled({
      title: 'Staff conflict fixture',
      venue: String(staffVenue._id),
      staff: [String(assignedStaff._id)],
    });
    assert.equal(staffBooking.status, 201);
    const staffConflict = await createScheduled({
      title: 'Overlapping staff fixture',
      venue: String(staffVenue._id),
      staff: [String(assignedStaff._id)],
    });
    assert.equal(staffConflict.status, 409);
    assert.ok(staffConflict.data.details.conflicts.some((conflict) =>
      conflict.code === 'STAFF_CONFLICT' && conflict.staff === String(assignedStaff._id)
    ));

    const unavailableResource = await Resource.create({
      name: 'Unavailable resource fixture',
      type: 'equipment',
      quantity: 2,
      available: 2,
      isAvailable: false,
    });
    const resourceVenue = await Venue.create({
      name: 'Resource conflict venue fixture',
      location: 'Test-only location',
      capacity: 100,
    });
    const resourceConflict = await createScheduled({
      title: 'Unavailable resource booking',
      venue: String(resourceVenue._id),
      resources: [{ resource: String(unavailableResource._id), quantity: 1 }],
    });
    assert.equal(resourceConflict.status, 409);
    assert.ok(resourceConflict.data.details.conflicts.some((conflict) =>
      conflict.code === 'RESOURCE_CONFLICT' && conflict.resource === String(unavailableResource._id)
    ));

    const capacityConflict = await createScheduled({
      title: 'Capacity conflict fixture',
      expectedAudience: fixture.venue.capacity + 1,
    });
    assert.equal(capacityConflict.status, 409);
    assert.ok(capacityConflict.data.details.conflicts.some((conflict) =>
      conflict.code === 'CAPACITY_EXCEEDED' && conflict.venue === String(fixture.venue._id)
    ));

    const bufferBooking = await createScheduled({
      title: 'Buffer baseline fixture',
      startTime: '13:00',
      endTime: '14:00',
    });
    assert.equal(bufferBooking.status, 201);
    const validGap = await createScheduled({
      title: 'Valid buffer gap fixture',
      startTime: '14:30',
      endTime: '15:30',
    });
    assert.equal(validGap.status, 201);
    const insufficientGap = await createScheduled({
      title: 'Insufficient buffer gap fixture',
      startTime: '14:15',
      endTime: '15:15',
    });
    assert.equal(insufficientGap.status, 409);
    assert.ok(insufficientGap.data.details.conflicts.some((conflict) => conflict.code === 'BUFFER_CONFLICT'));

    assert.ok(await Conflict.countDocuments({ status: 'open' }) > 0);
    assert.equal(await Event.countDocuments(), 4);
  });

  it('suggests a fully available resolution and revalidates it before saving', async () => {
    const assignedStaff = await Staff.create({
      name: 'Busy technician fixture',
      email: uniqueEmail('busy-technician'),
      role: 'technician',
    });
    const replacementStaff = await Staff.create({
      name: 'Available technician fixture',
      email: uniqueEmail('available-technician'),
      role: 'technician',
    });
    const unavailableResource = await Resource.create({
      name: 'Unavailable camera fixture',
      type: 'camera',
      quantity: 3,
      available: 3,
      isAvailable: false,
    });
    const replacementResource = await Resource.create({
      name: 'Available camera fixture',
      type: 'camera',
      quantity: 4,
      available: 4,
      isAvailable: true,
    });
    const replacementVenue = await Venue.create({
      name: 'Available alternate venue fixture',
      location: 'Test-only location',
      capacity: 80,
      facilities: ['stage'],
      isAvailable: true,
    });
    await createEvent({
      title: 'Blocking event fixture',
      staff: [assignedStaff._id],
    });
    const target = await createEvent({
      title: 'Conflict resolution target fixture',
      staff: [assignedStaff._id],
      resources: [{ resource: unavailableResource._id, quantity: 2 }],
      requiredFacilities: ['stage'],
      expectedAudience: 50,
    });

    const detected = await api('/conflicts/detect', { method: 'POST', token: fixture.adminToken });
    assert.equal(detected.status, 200);
    const listed = await api('/conflicts?status=open&type=venue', { token: fixture.adminToken });
    assert.equal(listed.status, 200);
    const venueConflict = listed.data.find((item) =>
      item.events.some((event) => String(event._id) === String(target._id))
    );
    assert.ok(venueConflict);

    const suggestionResponse = await api(`/conflicts/${venueConflict._id}/ai-suggestion`, { token: fixture.adminToken });
    assert.equal(suggestionResponse.status, 200);
    assert.equal(suggestionResponse.data.conflict.type, 'venue');
    assert.ok(suggestionResponse.data.conflict.reason);
    const suggestion = suggestionResponse.data.suggestions.find((item) =>
      String(item.eventId) === String(target._id) &&
      String(item.proposed.venue) === String(replacementVenue._id) &&
      item.proposed.staff.includes(String(replacementStaff._id)) &&
      item.proposed.resources.some((resource) =>
        String(resource.resource) === String(replacementResource._id) && resource.quantity === 2
      )
    );
    assert.ok(suggestion, `expected a feasible venue, staff, and resource replacement; got ${JSON.stringify(suggestionResponse.data.suggestions.map((item) => ({
      eventId: String(item.eventId),
      proposed: item.proposed,
      availability: item.availability,
    })))}`);
    assert.equal(suggestion.explanation.length > 0, true);
    assert.equal(suggestion.availability.venue.available, true);
    assert.equal(suggestion.availability.venue.capacitySufficient, true);
    assert.equal(suggestion.availability.venue.facilitiesAvailable, true);
    assert.equal(suggestion.availability.staff.every((member) => member.available), true);
    assert.equal(suggestion.availability.resources.every((resource) => resource.available), true);
    assert.equal(suggestion.availability.time.available, true);

    const applied = await api(`/events/${target._id}`, {
      method: 'PUT',
      token: fixture.adminToken,
      body: {
        date: suggestion.proposed.date,
        startTime: suggestion.proposed.startTime,
        endTime: suggestion.proposed.endTime,
        venue: suggestion.proposed.venue,
        organizer: suggestion.proposed.organizer,
        staff: suggestion.proposed.staff,
        resources: suggestion.proposed.resources.map(({ resource, quantity }) => ({ resource, quantity })),
      },
    });
    assert.equal(applied.status, 200);
    assert.equal(String(applied.data.venue._id), String(replacementVenue._id));
    assert.deepEqual(applied.data.staff.map((member) => String(member._id)), [String(replacementStaff._id)]);
    assert.equal(String(applied.data.resources[0].resource._id), String(replacementResource._id));

    const afterSave = await api('/conflicts/detect', { method: 'POST', token: fixture.adminToken });
    assert.equal(afterSave.status, 200);
    assert.equal(afterSave.data.conflicts.some((item) => item.events.includes(String(target._id))), false);
  });

  it('suggests feasible create-time venue, capacity, staff, resource, and buffered-time alternatives for admins', async () => {
    const busyStaff = await Staff.create({
      name: 'Busy technician for create suggestion',
      email: uniqueEmail('busy-tech'),
      role: 'technician',
      isAvailable: true,
    });
    const replacementStaff = await Staff.create({
      name: 'Available technician for create suggestion',
      email: uniqueEmail('available-tech'),
      role: 'technician',
      isAvailable: true,
    });
    const unavailableResource = await Resource.create({
      name: 'Limited camera stock',
      type: 'camera',
      quantity: 3,
      available: 3,
      isAvailable: true,
    });
    const replacementResource = await Resource.create({
      name: 'Replacement camera stock',
      type: 'camera',
      quantity: 5,
      available: 5,
      isAvailable: true,
    });
    const replacementVenue = await Venue.create({
      name: 'Large fully equipped suggestion venue',
      location: 'Test-only location',
      capacity: 200,
      facilities: ['stage', 'projector'],
      isAvailable: true,
    });
    await createEvent({
      title: 'Create suggestion blocker',
      staff: [busyStaff._id],
      resources: [{ resource: unavailableResource._id, quantity: 2 }],
    });
    const payload = eventBody({
      title: 'Event with multiple create conflicts',
      status: 'scheduled',
      venue: String(fixture.venue._id),
      staff: [String(busyStaff._id)],
      resources: [{ resource: String(unavailableResource._id), quantity: 2 }],
      expectedAudience: 150,
      requiredFacilities: ['stage', 'projector'],
      setupMinutes: 20,
      cleanupMinutes: 25,
    });

    const user = await createUser();
    const denied = await api('/events/alternatives', {
      method: 'POST',
      token: await login(user.email),
      body: payload,
    });
    assert.equal(denied.status, 403);

    const response = await api('/events/alternatives', {
      method: 'POST',
      token: fixture.adminToken,
      body: payload,
    });
    assert.equal(response.status, 200);
    const conflictTypes = new Set(response.data.conflicts.map((item) => item.type));
    for (const type of ['venue', 'capacity', 'staff', 'resource']) {
      assert.ok(conflictTypes.has(type), `expected separate ${type} conflict`);
      assert.ok(response.data.conflicts.find((item) => item.type === type).alternatives.length > 0);
    }

    const combined = response.data.alternatives.find((item) =>
      item.startTime === '10:00' &&
      String(item.venue) === String(replacementVenue._id) &&
      item.staff.includes(String(replacementStaff._id)) &&
      item.resources.some((resource) => String(resource.resource) === String(replacementResource._id))
    );
    assert.ok(combined, `expected a same-time venue/staff/resource alternative; got ${JSON.stringify(response.data.alternatives)}`);
    assert.equal(combined.availability.venue.capacitySufficient, true);
    assert.equal(combined.availability.venue.facilitiesAvailable, true);
    assert.ok(combined.availability.staff.every((member) => member.available && member.role === 'technician'));
    assert.ok(combined.availability.resources.every((resource) => resource.available && resource.quantity <= resource.availableQuantity));
    assert.equal(combined.availability.time.setupMinutes, 20);
    assert.equal(combined.availability.time.cleanupMinutes, 25);
    assert.ok(response.data.alternatives.some((item) =>
      item.startTime !== payload.startTime &&
      item.availability.time.available &&
      item.availability.time.setupMinutes === 20 &&
      item.availability.time.cleanupMinutes === 25
    ), 'expected an alternative time with setup and cleanup buffers preserved');
    assert.equal(await Event.countDocuments(), 1, 'suggestion generation must not create events');

    const applied = await api('/events', {
      method: 'POST',
      token: fixture.adminToken,
      body: {
        ...payload,
        date: combined.date,
        startTime: combined.startTime,
        endTime: combined.endTime,
        venue: combined.venue,
        organizer: combined.organizer,
        staff: combined.staff,
        resources: combined.resources.map(({ resource, quantity }) => ({ resource, quantity })),
      },
    });
    assert.equal(applied.status, 201, applied.data?.message);
    assert.equal(String(applied.data.venue._id), String(replacementVenue._id));
    assert.deepEqual(applied.data.staff.map((member) => String(member._id)), [String(replacementStaff._id)]);
    assert.equal(String(applied.data.resources[0].resource._id), String(replacementResource._id));
  });

  it('suggests only venues that meet facility, capacity, and buffered availability requirements', async () => {
    const soundBoxVenue = await Venue.create({
      name: 'Sound box equipped venue',
      location: 'Test-only location',
      capacity: 180,
      facilities: ['sound box', 'stage'],
      isAvailable: true,
    });
    const missingFacilityVenue = await Venue.create({
      name: 'Large venue missing sound box',
      location: 'Test-only location',
      capacity: 250,
      facilities: ['stage'],
      isAvailable: true,
    });
    const undersizedVenue = await Venue.create({
      name: 'Small sound box venue',
      location: 'Test-only location',
      capacity: 100,
      facilities: ['sound box', 'stage'],
      isAvailable: true,
    });
    await createEvent({
      title: 'Sound box venue blocker',
      venue: soundBoxVenue._id,
      startTime: '09:30',
      endTime: '10:00',
      cleanupMinutes: 30,
    });
    const payload = eventBody({
      title: 'Event requiring sound box',
      status: 'scheduled',
      venue: String(fixture.venue._id),
      expectedAudience: 150,
      requiredFacilities: ['sound box'],
      setupMinutes: 20,
      cleanupMinutes: 25,
    });

    const response = await api('/events/alternatives', {
      method: 'POST',
      token: fixture.adminToken,
      body: payload,
    });
    assert.equal(response.status, 200);
    const facilityConflict = response.data.conflicts.find((item) => item.type === 'venue');
    assert.ok(facilityConflict);
    assert.match(facilityConflict.reason, /sound box/i);
    assert.ok(facilityConflict.alternatives.length > 0);

    const valid = response.data.alternatives.filter((item) => String(item.venue) === String(soundBoxVenue._id));
    assert.ok(valid.length, 'expected a fully equipped venue at an available time');
    assert.ok(valid.every((item) =>
      item.availability.venue.available &&
      item.availability.venue.capacitySufficient &&
      item.availability.venue.facilitiesAvailable &&
      item.availability.time.available &&
      item.availability.time.setupMinutes === 20 &&
      item.availability.time.cleanupMinutes === 25 &&
      item.startTime !== '10:00'
    ));
    assert.ok(response.data.alternatives.every((item) =>
      String(item.venue) !== String(missingFacilityVenue._id) &&
      String(item.venue) !== String(undersizedVenue._id)
    ));
    assert.equal(await Event.countDocuments(), 1, 'generating venue suggestions must not modify event data');
  });

  it('suggests available same-role staff for Jyoti Kumari overlapping an event and revalidates creation', async () => {
    const jyoti = await Staff.create({
      name: 'Jyoti Kumari',
      email: uniqueEmail('jyoti'),
      role: 'technician',
      isAvailable: true,
    });
    const replacement = await Staff.create({
      name: 'Available technician',
      email: uniqueEmail('replacement-tech'),
      role: 'technician',
      isAvailable: true,
    });
    const wrongRole = await Staff.create({
      name: 'Available coordinator',
      email: uniqueEmail('coordinator'),
      role: 'coordinator',
      isAvailable: true,
    });
    const unavailable = await Staff.create({
      name: 'Unavailable technician',
      email: uniqueEmail('unavailable-tech'),
      role: 'technician',
      isAvailable: false,
    });
    const secondVenue = await Venue.create({
      name: 'Separate staff test venue',
      location: 'Test-only location',
      capacity: 200,
      facilities: ['stage'],
      isAvailable: true,
    });
    await createEvent({
      title: 'Jyoti existing overlapping event',
      staff: [jyoti._id],
      venue: fixture.venue._id,
    });
    const payload = eventBody({
      title: 'Event requiring Jyoti',
      status: 'scheduled',
      venue: String(secondVenue._id),
      staff: [String(jyoti._id)],
      setupMinutes: 15,
      cleanupMinutes: 20,
    });

    const response = await api('/events/alternatives', {
      method: 'POST',
      token: fixture.adminToken,
      body: payload,
    });
    assert.equal(response.status, 200);
    const staffConflict = response.data.conflicts.find((item) => item.type === 'staff');
    assert.ok(staffConflict);
    assert.match(staffConflict.reason, /Jyoti Kumari/i);
    assert.ok(staffConflict.alternatives.length > 0);

    const valid = response.data.alternatives.find((item) =>
      item.startTime === payload.startTime &&
      item.staff.includes(String(replacement._id))
    );
    assert.ok(valid, 'expected to retain the time and replace overlapping staff with a qualified member');
    assert.ok(valid.availability.staff.some((member) =>
      member.id === String(replacement._id) && member.role === 'technician' && member.available
    ));
    assert.ok(response.data.alternatives.every((item) =>
      !item.staff.includes(String(wrongRole._id)) && !item.staff.includes(String(unavailable._id))
    ));
    assert.equal(await Event.countDocuments(), 1, 'suggestions must not create or alter events');

    const created = await api('/events', {
      method: 'POST',
      token: fixture.adminToken,
      body: {
        ...payload,
        date: valid.date,
        startTime: valid.startTime,
        endTime: valid.endTime,
        venue: valid.venue,
        organizer: valid.organizer,
        staff: valid.staff,
        resources: valid.resources.map(({ resource, quantity }) => ({ resource, quantity })),
      },
    });
    assert.equal(created.status, 201, created.data?.message);
    assert.deepEqual(created.data.staff.map((member) => String(member._id)), [String(replacement._id)]);
  });

  it('returns client errors for invalid IDs and 404 for absent events without partial writes', async () => {
    const invalidId = await api('/events/not-an-object-id');
    assert.equal(invalidId.status, 400);

    const missingId = '507f1f77bcf86cd799439011';
    const absent = await api(`/events/${missingId}`);
    assert.equal(absent.status, 404);

    const updateMissing = await api(`/events/${missingId}`, {
      method: 'PUT',
      token: fixture.adminToken,
      body: { date, startTime: '12:00', endTime: '13:00' },
    });
    assert.equal(updateMissing.status, 404);
    assert.equal(await Event.countDocuments(), 0);
    assert.equal(await Schedule.countDocuments(), 0);
  });

  it('rejects invalid event input without persisting an event', async () => {
    const invalid = await api('/events', {
      method: 'POST',
      token: fixture.adminToken,
      body: eventBody({ date: 'not-a-date' }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(await Event.countDocuments(), 0);
  });

  it('returns 404 for registration approval when the registration does not exist', async () => {
    const missingId = '507f1f77bcf86cd799439011';
    const response = await api(`/registrations/${missingId}/status`, {
      method: 'PATCH',
      token: fixture.adminToken,
      body: { status: 'approved' },
    });
    assert.equal(response.status, 404);
    assert.deepEqual(response.data, { message: 'Registration not found.' });
    assert.equal(await Registration.countDocuments(), 0);
    assert.equal(await Notification.countDocuments(), 0);
  });
});
