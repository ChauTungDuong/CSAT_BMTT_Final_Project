import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const homeRoute = user?.role === "admin" ? "/admin" : "/dashboard";

  return (
    <nav className="flex min-h-14 items-center justify-between bg-blue-700 px-6 py-4 text-white shadow sm:min-h-[3.75rem] sm:py-4">
      <Link to={homeRoute} className="text-xl font-bold tracking-wide">
        BankDemo
      </Link>
      <div className="flex items-center gap-4 sm:gap-5">
        <span className="text-sm leading-none opacity-75 capitalize">
          {user?.role ?? "guest"}
        </span>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-blue-700 shadow-sm transition hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-700"
        >
          Đăng xuất
        </button>
      </div>
    </nav>
  );
}
