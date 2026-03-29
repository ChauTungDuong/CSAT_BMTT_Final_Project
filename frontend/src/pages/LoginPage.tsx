import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../api/client";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      // Redirect based on role stored inside the token will be handled by App.tsx guard
      navigate("/", { replace: true });
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message;
      const clientMessage = typeof err?.message === "string" ? err.message : "";

      const message =
        backendMessage ||
        (clientMessage
          ? `Lỗi phía trình duyệt trước khi gọi API: ${clientMessage}`
          : "Tên đăng nhập hoặc mật khẩu không đúng.");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const closeForgotModal = () => {
    if (forgotLoading) return;
    setShowForgotModal(false);
    setForgotStep(1);
    setForgotOtp("");
    setForgotNewPassword("");
    setForgotConfirmPassword("");
    setForgotError("");
    setForgotMessage("");
  };

  const requestForgotOtp = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotMessage("");

    if (!forgotUsername.trim() || !forgotEmail.trim()) {
      setForgotError("Vui lòng nhập tên đăng nhập và email đã đăng ký.");
      return;
    }

    setForgotLoading(true);
    try {
      const res = await api.post("/auth/forgot-password/request", {
        username: forgotUsername.trim(),
        email: forgotEmail.trim(),
      });
      setForgotMessage(
        res?.data?.message ??
          "Nếu thông tin hợp lệ, OTP đặt lại mật khẩu đã được gửi qua email.",
      );
      setForgotStep(2);
    } catch (err: any) {
      const message =
        err?.response?.data?.message || "Không thể gửi OTP. Vui lòng thử lại.";
      setForgotError(message);
    } finally {
      setForgotLoading(false);
    }
  };

  const confirmForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotMessage("");

    if (!/^\d{6}$/.test(forgotOtp)) {
      setForgotError("OTP phải gồm đúng 6 chữ số.");
      return;
    }

    if (!forgotNewPassword || forgotNewPassword.length < 8) {
      setForgotError("Mật khẩu mới phải từ 8 ký tự.");
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError("Xác nhận mật khẩu không khớp.");
      return;
    }

    setForgotLoading(true);
    try {
      const res = await api.post("/auth/forgot-password/confirm", {
        username: forgotUsername.trim(),
        email: forgotEmail.trim(),
        otp: forgotOtp,
        newPassword: forgotNewPassword,
        confirmPassword: forgotConfirmPassword,
      });

      setForgotMessage(
        res?.data?.message ??
          "Đặt lại mật khẩu thành công. Vui lòng đăng nhập.",
      );
      setTimeout(() => {
        closeForgotModal();
      }, 1200);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        "Không thể đặt lại mật khẩu. Vui lòng kiểm tra OTP.";
      setForgotError(message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white shadow-lg rounded-2xl p-10 w-full max-w-md">
        <h1 className="text-2xl font-bold text-blue-700 mb-2">BankDemo</h1>
        <p className="text-gray-500 mb-6 text-sm">Đăng nhập vào tài khoản</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên đăng nhập
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mật khẩu
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(true);
                  setForgotStep(1);
                  setForgotError("");
                  setForgotMessage("");
                }}
                className="text-sm text-blue-600 hover:underline"
              >
                Quên mật khẩu?
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
          >
            {loading ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          Chưa có tài khoản?{" "}
          <Link to="/register" className="text-blue-600 hover:underline">
            Đăng ký
          </Link>
        </p>
      </div>

      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b bg-slate-50">
              <h2 className="font-semibold text-slate-800">Quên mật khẩu</h2>
              <p className="text-xs text-slate-500 mt-1">
                {forgotStep === 1
                  ? "Nhập tên đăng nhập và email để nhận OTP."
                  : "Nhập OTP và đặt mật khẩu mới."}
              </p>
            </div>

            {forgotStep === 1 ? (
              <form onSubmit={requestForgotOtp} className="px-5 py-4 space-y-3">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    Tên đăng nhập
                  </label>
                  <input
                    type="text"
                    value={forgotUsername}
                    onChange={(e) => setForgotUsername(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    Email đã đăng ký
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                {forgotError && (
                  <p className="text-sm text-red-600 rounded bg-red-50 border border-red-200 px-3 py-2">
                    {forgotError}
                  </p>
                )}
                {forgotMessage && (
                  <p className="text-sm text-emerald-700 rounded bg-emerald-50 border border-emerald-200 px-3 py-2">
                    {forgotMessage}
                  </p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closeForgotModal}
                    className="flex-1 border rounded-lg py-2 text-gray-700 hover:bg-gray-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {forgotLoading ? "Đang gửi..." : "Gửi OTP"}
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={confirmForgotPassword}
                className="px-5 py-4 space-y-3"
              >
                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    OTP
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={forgotOtp}
                    onChange={(e) =>
                      setForgotOtp(e.target.value.replace(/\D/g, ""))
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    type="password"
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                {forgotError && (
                  <p className="text-sm text-red-600 rounded bg-red-50 border border-red-200 px-3 py-2">
                    {forgotError}
                  </p>
                )}
                {forgotMessage && (
                  <p className="text-sm text-emerald-700 rounded bg-emerald-50 border border-emerald-200 px-3 py-2">
                    {forgotMessage}
                  </p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closeForgotModal}
                    className="flex-1 border rounded-lg py-2 text-gray-700 hover:bg-gray-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 bg-gray-800 text-white rounded-lg py-2 hover:bg-gray-900 disabled:opacity-50"
                  >
                    {forgotLoading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
