import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Loader from './components/Loader';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Telegram from './components/Telegram';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Tournaments = lazy(() => import('./pages/Tournaments'));
const TournamentDetails = lazy(() => import('./pages/TournamentDetails'));
const TeamRegistration = lazy(() => import('./pages/TeamRegistration'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const MyTeams = lazy(() => import('./pages/MyTeams'));
const Payments = lazy(() => import('./pages/Payments'));
const Profile = lazy(() => import('./pages/Profile'));
const Legal = lazy(() => import('./pages/Legal'));
const NotFound = lazy(() => import('./pages/NotFound'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminOverview = lazy(() => import('./pages/admin/Overview'));
const AdminTournaments = lazy(() => import('./pages/admin/Tournaments'));
const AdminTeams = lazy(() => import('./pages/admin/Teams'));
const AdminPayments = lazy(() => import('./pages/admin/Payments'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminAudit = lazy(() => import('./pages/admin/Audit'));

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) { setTimeout(() => document.querySelector(hash)?.scrollIntoView(), 50); return; }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  const P = ({ children, admin }) => <ProtectedRoute admin={admin}>{children}</ProtectedRoute>;
  return (
    <>
      <ScrollToTop />
      <Navbar />
      <Telegram />
      <main id="main">
        <Suspense fallback={<Loader message="Loading page…" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/tournaments" element={<Tournaments />} />
            <Route path="/tournaments/:id" element={<TournamentDetails />} />
            <Route path="/tournaments/:id/register" element={<P><TeamRegistration /></P>} />
            <Route path="/checkout/:registrationId" element={<P><Checkout /></P>} />
            <Route path="/dashboard" element={<P><Dashboard /></P>} />
            <Route path="/teams" element={<P><MyTeams /></P>} />
            <Route path="/payments" element={<P><Payments /></P>} />
            <Route path="/profile" element={<P><Profile /></P>} />
            <Route path="/privacy" element={<Legal kind="privacy" />} />
            <Route path="/terms" element={<Legal kind="terms" />} />
            <Route path="/admin" element={<P admin><AdminLayout /></P>}>
              <Route index element={<AdminOverview />} />
              <Route path="tournaments" element={<AdminTournaments />} />
              <Route path="teams" element={<AdminTeams />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="audit" element={<AdminAudit />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
