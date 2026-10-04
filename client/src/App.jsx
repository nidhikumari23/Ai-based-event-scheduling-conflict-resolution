import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute';
import AdminLayout from './components/admin/AdminLayout';
import UserLayout from './components/user/UserLayout';

import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';

import AdminDashboard from './pages/admin/AdminDashboard';
import Categories from './pages/admin/Categories';
import Brands from './pages/admin/Brands';
import Venues from './pages/admin/Venues';
import Resources from './pages/admin/Resources';
import AdminEvents from './pages/admin/AdminEvents';
import Staff from './pages/admin/Staff';
import Participants from './pages/admin/Participants';
import AIScheduling from './pages/admin/AIScheduling';
import Conflicts from './pages/admin/Conflicts';
import ScheduleMgmt from './pages/admin/ScheduleMgmt';
import AdminNotifications from './pages/admin/AdminNotifications';
import Reports from './pages/admin/Reports';
import AdminFeedback from './pages/admin/AdminFeedback';
import Settings from './pages/admin/Settings';

import UserDashboard from './pages/user/UserDashboard';
import UserEvents from './pages/user/UserEvents';
import EventDetail from './pages/user/EventDetail';
import MyRegistrations from './pages/user/MyRegistrations';
import UserSchedule from './pages/user/UserSchedule';
import Recommendations from './pages/user/Recommendations';
import UserNotifications from './pages/user/UserNotifications';
import Profile from './pages/user/Profile';
import MyFeedback from './pages/user/MyFeedback';
import PersonalSchedule from './pages/user/PersonalSchedule';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      <Route element={<ProtectedRoute adminOnly />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="categories" element={<Categories />} />
          <Route path="brands" element={<Brands />} />
          <Route path="venues" element={<Venues />} />
          <Route path="resources" element={<Resources />} />
          <Route path="events" element={<AdminEvents />} />
          <Route path="staff" element={<Staff />} />
          <Route path="participants" element={<Participants />} />
          <Route path="ai-scheduling" element={<AIScheduling />} />
          <Route path="conflicts" element={<Conflicts />} />
          <Route path="schedule" element={<ScheduleMgmt />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="reports" element={<Reports />} />
          <Route path="feedback" element={<AdminFeedback />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/user" element={<UserLayout />}>
          <Route index element={<UserDashboard />} />
          <Route path="events" element={<UserEvents />} />
          <Route path="events/:id" element={<EventDetail />} />
          <Route path="registrations" element={<MyRegistrations />} />
          <Route path="personal-schedule" element={<PersonalSchedule />} />
          <Route path="schedule" element={<UserSchedule />} />
          <Route path="recommendations" element={<Recommendations />} />
          <Route path="feedback" element={<MyFeedback />} />
          <Route path="notifications" element={<UserNotifications />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
