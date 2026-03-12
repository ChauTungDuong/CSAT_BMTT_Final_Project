import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Interceptor: redirect về login nếu 401 (ngoại trừ verify-pin)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? "";
    if (error.response?.status === 401 && !url.includes("verify-pin")) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;
