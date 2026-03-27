import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const homeRoute = user?.role === "admin" ? "/admin" : "/dashboard";

  return (
    <nav className="bg-blue-700 text-white px-6 py-3 flex items-center justify-between shadow">
      <Link to={homeRoute} className="text-xl font-bold tracking-wide">
        BankDemo
      </Link>
      <div className="flex items-center gap-4">
        <span className="text-sm opacity-75 capitalize">
          {user?.role ?? "guest"}
        </span>
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="bg-white text-blue-700 text-sm px-3 py-1 rounded hover:bg-blue-50 transition"
        >
          Đăng xuất
        </button>
      </div>
    </nav>
  );
}
