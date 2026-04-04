import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../api/client";
import { EyeIcon, EyeSlashIcon } from "../components/common/EyeIcons";

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
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] =
    useState(false);

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white shadow-lg rounded-2xl p-12 w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-700 mb-2">BankDemo</h1>
          <p className="text-gray-500 text-base">Đăng nhập vào tài khoản</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">
              Tên đăng nhập
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="w-full text-lg leading-normal border border-gray-300 rounded-xl px-4 py-3.5 min-h-[3rem] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-base font-medium text-gray-700 mb-2"
            >
              Mật khẩu
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="no-native-password-reveal w-full min-h-[3rem] rounded-xl border border-gray-300 py-3.5 pl-4 pr-12 text-lg leading-normal focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-800 focus:outline-none focus-visible:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-500/35 focus-visible:ring-offset-0 rounded-sm"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
              </button>
            </div>
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(true);
                  setForgotStep(1);
                  setForgotError("");
                  setForgotMessage("");
                }}
                className="text-base text-blue-600 hover:underline"
              >
                Quên mật khẩu?
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-base bg-red-50 px-4 py-3 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full text-lg bg-blue-600 text-white py-3.5 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 font-medium"
          >
            {loading ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>

        <p className="mt-6 text-center text-base text-gray-500">
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
                    className="w-full text-lg leading-normal border rounded-lg px-3 py-3 min-h-[2.75rem]"
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
                    className="w-full text-lg leading-normal border rounded-lg px-3 py-3 min-h-[2.75rem]"
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
                    className="w-full text-lg leading-normal tracking-widest border rounded-lg px-3 py-3 min-h-[2.75rem]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="forgot-new-password"
                    className="block text-sm text-slate-600 mb-1"
                  >
                    Mật khẩu mới
                  </label>
                  <div className="relative">
                    <input
                      id="forgot-new-password"
                      type={showForgotNewPassword ? "text" : "password"}
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      className="no-native-password-reveal min-h-[2.75rem] w-full rounded-lg border py-3 pl-3 pr-12 text-lg leading-normal"
                    />
                    <button
                      type="button"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-1 text-gray-500 hover:text-gray-800 focus:outline-none focus-visible:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-500/35 focus-visible:ring-offset-0"
                      onClick={() =>
                        setShowForgotNewPassword((v) => !v)
                      }
                      aria-label={
                        showForgotNewPassword
                          ? "Ẩn mật khẩu mới"
                          : "Hiện mật khẩu mới"
                      }
                      aria-pressed={showForgotNewPassword}
                    >
                      {showForgotNewPassword ? (
                        <EyeSlashIcon />
                      ) : (
                        <EyeIcon />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="forgot-confirm-password"
                    className="block text-sm text-slate-600 mb-1"
                  >
                    Xác nhận mật khẩu mới
                  </label>
                  <div className="relative">
                    <input
                      id="forgot-confirm-password"
                      type={showForgotConfirmPassword ? "text" : "password"}
                      value={forgotConfirmPassword}
                      onChange={(e) =>
                        setForgotConfirmPassword(e.target.value)
                      }
                      className="no-native-password-reveal min-h-[2.75rem] w-full rounded-lg border py-3 pl-3 pr-12 text-lg leading-normal"
                    />
                    <button
                      type="button"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-1 text-gray-500 hover:text-gray-800 focus:outline-none focus-visible:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-500/35 focus-visible:ring-offset-0"
                      onClick={() =>
                        setShowForgotConfirmPassword((v) => !v)
                      }
                      aria-label={
                        showForgotConfirmPassword
                          ? "Ẩn xác nhận mật khẩu"
                          : "Hiện xác nhận mật khẩu"
                      }
                      aria-pressed={showForgotConfirmPassword}
                    >
                      {showForgotConfirmPassword ? (
                        <EyeSlashIcon />
                      ) : (
                        <EyeIcon />
                      )}
                    </button>
                  </div>
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
