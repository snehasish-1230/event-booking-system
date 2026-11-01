import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ScrollToTop from './components/common/ScrollToTop';

// Layouts
import MainLayout from './components/layout/MainLayout';
import OrganizerLayout from './components/layout/OrganizerLayout';
import AdminLayout from './components/layout/AdminLayout';

// Route Guards
import ProtectedRoute from './components/common/ProtectedRoute';
import OrganizerRoute from './components/common/OrganizerRoute';
import AdminRoute from './components/common/AdminRoute';
import GuestOnlyRoute from './components/common/GuestOnlyRoute';

// Public Pages
import HomePage from './pages/HomePage';
import EventListPage from './pages/EventListPage';
import EventDetailPage from './pages/EventDetailPage';
import PublicProfilePage from './pages/PublicProfilePage';
import AboutPage from './pages/AboutPage';
import NotFoundPage from './pages/NotFoundPage';
import TermsPage from './pages/TermsPage';

// Auth Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';

// Protected Pages
import MyTicketsPage from './pages/MyTicketsPage';
import TicketDetailPage from './pages/TicketDetailPage';
import PaymentPage from './pages/PaymentPage';
import SettingsPage from './pages/SettingsPage';

// Organizer Pages
import OrganizerDashboardPage from './pages/organizer/OrganizerDashboardPage';
import OrganizerEventsPage from './pages/organizer/OrganizerEventsPage';
import CreateEventPage from './pages/organizer/CreateEventPage';
import EditEventPage from './pages/organizer/EditEventPage';
import EventAttendeesPage from './pages/organizer/EventAttendeesPage';
import OrganizerSettingsPage from './pages/organizer/OrganizerSettingsPage';

// Admin Pages
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminEventsPage from './pages/admin/AdminEventsPage';
import AdminRegistrationsPage from './pages/admin/AdminRegistrationsPage';
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage';
import AdminEventRoomPage from './pages/admin/AdminEventRoomPage';

const App = () => {
  return (
    <>
      <ScrollToTop />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--toast-bg, #fff)',
            color: 'var(--toast-color, #1f2937)',
          },
          className: 'dark:!bg-gray-800 dark:!text-gray-100',
          success: {
            duration: 4000,
            iconTheme: { primary: '#10b981', secondary: '#fff' },
          },
          error: {
            duration: 6000,
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
          },
        }}
      />

      <Routes>
        {/* Public routes with MainLayout */}
        <Route element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="events" element={<EventListPage />} />
          <Route path="events/:slug" element={<EventDetailPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="users/:id" element={<PublicProfilePage />} />
        </Route>

        {/* Guest-only routes (login/register) */}
        <Route element={<GuestOnlyRoute />}>
          <Route element={<MainLayout />}>
            <Route path="auth/login" element={<LoginPage />} />
            <Route path="auth/register" element={<RegisterPage />} />
            <Route path="auth/forgot-password" element={<ForgotPasswordPage />} />
          </Route>
        </Route>

        {/* Protected routes - require authentication */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="tickets" element={<MyTicketsPage />} />
            <Route path="tickets/:id" element={<TicketDetailPage />} />
            <Route path="payments" element={<PaymentPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Organizer routes - require organizer or admin role */}
        <Route element={<OrganizerRoute />}>
          <Route path="organizer" element={<OrganizerLayout />}>
            <Route index element={<OrganizerDashboardPage />} />
            <Route path="events" element={<OrganizerEventsPage />} />
            <Route path="events/create" element={<CreateEventPage />} />
            <Route path="events/:id/edit" element={<EditEventPage />} />
            <Route path="events/:id/attendees" element={<EventAttendeesPage />} />
            <Route path="settings" element={<OrganizerSettingsPage />} />
          </Route>
        </Route>

        {/* Admin routes - require admin role */}
        <Route element={<AdminRoute />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="events" element={<AdminEventsPage />} />
            <Route path="room-management" element={<AdminEventRoomPage />} />
            <Route path="room-management/:id" element={<AdminEventRoomPage />} />
            <Route path="events/:id/room" element={<AdminEventRoomPage />} />
            <Route path="registrations" element={<AdminRegistrationsPage />} />
            <Route path="payments" element={<AdminPaymentsPage />} />
          </Route>
        </Route>

        {/* 404 - Not Found */}
        <Route element={<MainLayout />}>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
};

export default App;
