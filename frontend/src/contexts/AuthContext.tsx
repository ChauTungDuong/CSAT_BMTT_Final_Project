import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import api from "../api/client";
import {
  getMockAuthPayloadForRole,
  isDevMockEnabled,
  isMockAutoLoginEnabled,
  MOCK_LOGGED_OUT_KEY,
} from "../mocks/devMockData";

interface AuthUser {
  accessToken: string;
  role: "customer" | "admin";
  forcePasswordChange?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearForcePasswordChange: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (
      isDevMockEnabled() &&
      isMockAutoLoginEnabled() &&
      !sessionStorage.getItem("auth") &&
      !sessionStorage.getItem(MOCK_LOGGED_OUT_KEY)
    ) {
      const role =
        import.meta.env.VITE_MOCK_ROLE === "admin" ? "admin" : "customer";
      const mockUser = getMockAuthPayloadForRole(role);
      setUser(mockUser);
      api.defaults.headers.common["Authorization"] =
        `Bearer ${mockUser.accessToken}`;
      sessionStorage.setItem("auth", JSON.stringify(mockUser));
      setIsLoading(false);
      return;
    }

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
    sessionStorage.removeItem(MOCK_LOGGED_OUT_KEY);
    setUser(data);
    api.defaults.headers.common["Authorization"] = `Bearer ${data.accessToken}`;
    sessionStorage.setItem("auth", JSON.stringify(data));
  };

  const logout = async () => {
    try {
      if (!isDevMockEnabled()) {
        await api.post("/auth/logout");
      }
    } catch {
      // Ignore backend errors and continue local cleanup.
    } finally {
      if (isDevMockEnabled()) {
        sessionStorage.setItem(MOCK_LOGGED_OUT_KEY, "1");
      }
      setUser(null);
      delete api.defaults.headers.common["Authorization"];
      sessionStorage.removeItem("auth");
      window.location.href = "/login";
    }
  };

  const clearForcePasswordChange = () => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, forcePasswordChange: false };
      sessionStorage.setItem("auth", JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, clearForcePasswordChange, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
