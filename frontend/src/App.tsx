import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Navbar from "./components/common/Navbar";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

import { DashboardPage } from "./pages/customer/DashboardPage";
import { ProfilePage } from "./pages/customer/ProfilePage";
import { TransferPage } from "./pages/customer/TransferPage";
import { PinSetupPage } from "./pages/customer/PinSetupPage";
import { TransactionHistoryPage } from "./pages/customer/TransactionHistoryPage";
import { CardsPage } from "./pages/customer/CardsPage";

import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AuditPage } from "./pages/admin/AuditPage";
import { UserProfilePage } from "./pages/admin/UserProfilePage";
import ForceChangePasswordPage from "./pages/ForceChangePasswordPage";

// ---------- Guards ----------

function RequireAuth({ allowedRoles }: { allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Đang tải…
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (
    user.forcePasswordChange &&
    location.pathname !== "/force-change-password"
  ) {
    return <Navigate to="/force-change-password" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(user.role))
    return <Navigate to="/" replace />;
  return <Outlet />;
}

function RoleRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
}

function ScrollToTopOnNavigate() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);
  return null;
}

// ---------- Layout (with Navbar) ----------

function AppLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
}

// ---------- App ----------

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTopOnNavigate />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Root redirect */}
        <Route path="/" element={<RoleRedirect />} />

        {/* Authenticated layout */}
        <Route element={<AppLayout />}>
          <Route element={<RequireAuth />}>
            <Route
              path="/force-change-password"
              element={<ForceChangePasswordPage />}
            />
          </Route>

          {/* Customer */}
          <Route element={<RequireAuth allowedRoles={["customer"]} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/transfer" element={<TransferPage />} />
            <Route path="/history" element={<TransactionHistoryPage />} />
            <Route path="/cards" element={<CardsPage />} />
            <Route path="/pin-setup" element={<PinSetupPage />} />
          </Route>

          {/* Admin */}
          <Route element={<RequireAuth allowedRoles={["admin"]} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/audit" element={<AuditPage />} />
            <Route path="/admin/profile" element={<UserProfilePage />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
