import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Navbar from "./components/common/Navbar";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

import { DashboardPage } from "./pages/customer/DashboardPage";
import { ProfilePage } from "./pages/customer/ProfilePage";
import { TransferPage } from "./pages/customer/TransferPage";

import { TellerPage } from "./pages/teller/TellerPage";

import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AuditPage } from "./pages/admin/AuditPage";
import { UserProfilePage } from "./pages/admin/UserProfilePage";

// ---------- Guards ----------

function RequireAuth({ allowedRoles }: { allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();
  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Đang tải…
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role))
    return <Navigate to="/" replace />;
  return <Outlet />;
}

function RoleRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  if (user.role === "teller") return <Navigate to="/teller" replace />;
  return <Navigate to="/dashboard" replace />;
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
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Root redirect */}
        <Route path="/" element={<RoleRedirect />} />

        {/* Authenticated layout */}
        <Route element={<AppLayout />}>
          {/* Customer */}
          <Route element={<RequireAuth allowedRoles={["customer"]} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/transfer" element={<TransferPage />} />
          </Route>

          {/* Admin */}
          <Route element={<RequireAuth allowedRoles={["admin"]} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/audit" element={<AuditPage />} />
            <Route path="/admin/profile" element={<UserProfilePage />} />
          </Route>

          {/* Teller */}
          <Route element={<RequireAuth allowedRoles={["teller"]} />}>
            <Route path="/teller" element={<TellerPage />} />
            <Route path="/teller/profile" element={<UserProfilePage />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
