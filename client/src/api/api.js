import axios from 'axios';

const apiOrigin = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || '';

const api = axios.create({
  baseURL: `${apiOrigin}/api`,
  headers: { 'Content-Type': 'application/json' },
});

export const assetUrl = (path) => {
  if (!path || /^https?:\/\//i.test(path)) return path;
  return `${apiOrigin}${path.startsWith('/') ? path : `/${path}`}`;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

export const dashboardAPI = {
  admin: () => api.get('/dashboard/admin'),
  user: () => api.get('/dashboard/user'),
};

export const categoryAPI = {
  list: (all) => api.get(`/categories${all ? '?all=true' : ''}`),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  toggle: (id) => api.patch(`/categories/${id}/toggle`),
  remove: (id) => api.delete(`/categories/${id}`),
};

export const brandAPI = {
  list: (all) => api.get(`/brands${all ? '?all=true' : ''}`),
  create: (data) => api.post('/brands', data),
  update: (id, data) => api.put(`/brands/${id}`, data),
  toggle: (id) => api.patch(`/brands/${id}/toggle`),
  remove: (id) => api.delete(`/brands/${id}`),
};

export const venueAPI = {
  list: () => api.get('/venues'),
  create: (data) => api.post('/venues', data),
  update: (id, data) => api.put(`/venues/${id}`, data),
  remove: (id) => api.delete(`/venues/${id}`),
  block: (id, data) => api.patch(`/venues/${id}/block`, data),
  bookings: (id) => api.get(`/venues/${id}/bookings`),
};

export const resourceAPI = {
  list: () => api.get('/resources'),
  create: (data) => api.post('/resources', data),
  update: (id, data) => api.put(`/resources/${id}`, data),
  toggle: (id) => api.patch(`/resources/${id}/toggle`),
  remove: (id) => api.delete(`/resources/${id}`),
  overbooking: () => api.get('/resources/overbooking'),
};

export const eventAPI = {
  list: (params) => api.get('/events', { params }),
  get: (id) => api.get(`/events/${id}`),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.put(`/events/${id}`, data),
  remove: (id) => api.delete(`/events/${id}`),
  cancel: (id) => api.patch(`/events/${id}/cancel`),
  reschedule: (id, data) => api.patch(`/events/${id}/reschedule`, data),
  featured: (id) => api.patch(`/events/${id}/featured`),
  live: () => api.get('/events/live'),
};

export const staffAPI = {
  list: () => api.get('/staff'),
  create: (data) => api.post('/staff', data),
  update: (id, data) => api.put(`/staff/${id}`, data),
  remove: (id) => api.delete(`/staff/${id}`),
  assign: (id, eventId) => api.patch(`/staff/${id}/assign`, { eventId }),
  toggle: (id) => api.patch(`/staff/${id}/availability`),
};

export const registrationAPI = {
  register: (eventId) => api.post('/registrations', { eventId }),
  my: () => api.get('/registrations/my'),
  all: (params) => api.get('/registrations', { params }),
  updateStatus: (id, status) => api.patch(`/registrations/${id}/status`, { status }),
  cancel: (eventId) => api.delete(`/registrations/${eventId}`),
  export: (event) => api.get(`/registrations/export${event ? `?event=${event}` : ''}`),
  remove: (id) => api.delete(`/registrations/admin/${id}`),
};

export const scheduleAPI = {
  get: () => api.get('/schedules'),
  public: () => api.get('/schedules/public'),
  view: (type) => api.get(`/schedules/view/${type}`),
  save: (data) => api.post('/schedules', data),
  generate: (data) => api.post('/schedules/generate', data),
  lock: () => api.patch('/schedules/lock'),
  publish: (publish = true) => api.patch('/schedules/publish', { publish }),
};

export const conflictAPI = {
  list: (params) => api.get('/conflicts', { params }),
  summary: () => api.get('/conflicts/summary'),
  detect: () => api.post('/conflicts/detect'),
  resolve: (id, data) => api.patch(`/conflicts/${id}/resolve`, data),
  aiSuggestion: (id) => api.get(`/conflicts/${id}/ai-suggestion`),
};

export const aiAPI = {
  generateSchedule: () => api.post('/ai/schedule/generate'),
  regenerate: () => api.post('/ai/schedule/regenerate'),
  recommendations: () => api.get('/ai/recommendations'),
  personalPlan: () => api.get('/ai/personal-plan'),
  checkOverlaps: (eventIds) => api.post('/ai/check-overlaps', { eventIds }),
};

export const notificationAPI = {
  list: () => api.get('/notifications'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  send: (data) => api.post('/notifications/send', data),
  remove: (id) => api.delete(`/notifications/${id}`),
};

export const feedbackAPI = {
  list: () => api.get('/feedback'),
  my: () => api.get('/feedback/my'),
  create: (data) => api.post('/feedback', data),
  update: (id, data) => api.put(`/feedback/${id}`, data),
  remove: (id) => api.delete(`/feedback/${id}`),
  reply: (id, reply) => api.patch(`/feedback/${id}/reply`, { reply }),
  popular: () => api.get('/feedback/popular'),
  ratings: (eventId) => api.get(`/feedback/event/${eventId}`),
};

export const settingsAPI = {
  get: () => api.get('/settings'),
  public: () => api.get('/settings/public'),
  update: (data) => api.put('/settings', data),
};

export const reportAPI = {
  participation: () => api.get('/reports/participation'),
  venues: () => api.get('/reports/venues'),
  resources: () => api.get('/reports/resources'),
  conflicts: () => api.get('/reports/conflicts'),
  registrations: () => api.get('/reports/registrations'),
  cancelled: () => api.get('/reports/cancelled'),
  aiSchedule: () => api.get('/reports/ai-schedule'),
  export: (type) => api.get(`/reports/export/${type}`, { responseType: 'blob' }),
};

export const userAPI = {
  list: () => api.get('/users'),
  preferences: () => api.get('/users/preferences'),
  get: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  remove: (id) => api.delete(`/users/${id}`),
  toggle: (id) => api.patch(`/users/${id}/toggle`),
  getRegistrations: (id) => api.get(`/users/${id}/registrations`),
};

export const userPortalAPI = {
  stats: () => api.get('/user-portal/stats'),
  personalSchedule: () => api.get('/user-portal/personal-schedule'),
  addToSchedule: (eventId) => api.post(`/user-portal/personal-schedule/${eventId}`),
  removeFromSchedule: (eventId) => api.delete(`/user-portal/personal-schedule/${eventId}`),
};
