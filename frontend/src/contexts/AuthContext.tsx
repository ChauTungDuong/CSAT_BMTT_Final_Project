import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import api from "../api/client";

interface AuthUser {
  accessToken: string;
  role: "customer" | "admin";
}

interface AuthContextType {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore from sessionStorage (not localStorage for security)
    const stored = sessionStorage.getItem("auth");
    if (stored) {
      const parsed = JSON.parse(stored) as AuthUser;
      setUser(parsed);
      api.defaults.headers.common["Authorization"] =
        `Bearer ${parsed.accessToken}`;
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const { data } = await api.post<AuthUser>("/auth/login", {
      username,
      password,
    });
    setUser(data);
    api.defaults.headers.common["Authorization"] = `Bearer ${data.accessToken}`;
    sessionStorage.setItem("auth", JSON.stringify(data));
  };

  const logout = () => {
    setUser(null);
    delete api.defaults.headers.common["Authorization"];
    sessionStorage.removeItem("auth");
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
