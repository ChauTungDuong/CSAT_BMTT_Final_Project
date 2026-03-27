import { useState, FormEvent, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";

export function PinSetupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: "", pin: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Nếu kiểm tra được đã có PIN thì đá về dashboard
    api.get("/customers/me").then((res) => {
      if (res.data?.hasPin) {
        navigate("/dashboard", { replace: true });
      }
    }).catch(() => {});
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(form.pin)) {
      setError("Mã PIN phải là 6 chữ số.");
      return;
    }

    if (form.pin !== form.confirm) {
      setError("Xác nhận mã PIN không khớp.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/customers/me/setup-pin", {
        password: form.password,
        pin: form.pin,
      });
      navigate("/dashboard");
    } catch (err: unknown) {
      const msg =
        (err as any)?.response?.data?.message ?? "Lỗi cài đặt mã PIN";
      setError(Array.isArray(msg) ? msg.join(", ") : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white shadow-lg rounded-2xl p-10 w-full max-w-md">
        <h1 className="text-2xl font-bold text-blue-700 mb-2">Thiết Lập Mã PIN</h1>
        <p className="text-gray-500 mb-6 text-sm">
          Tài khoản của bạn chưa có mã PIN. Vui lòng thiết lập mã PIN để thực hiện các giao dịch bảo mật.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mật khẩu đăng nhập
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mã PIN (6 chữ số)
            </label>
            <input
              type="password"
              maxLength={6}
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-widest text-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Xác nhận mã PIN
            </label>
            <input
              type="password"
              maxLength={6}
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-widest text-lg"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium mt-4"
          >
            {loading ? "Đang xử lý…" : "Cài đặt PIN"}
          </button>
        </form>
      </div>
    </div>
  );
}
