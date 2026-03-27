import { useState, FormEvent, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../api/client";

interface UserProfile {
  id: string;
  username: string;
  role: string;
  fullName: string | null;
  email: string | null;
}

const roleLabel: Record<string, string> = {
  admin: "Quản trị viên",
  customer: "Khách hàng",
};

export function UserProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "" });
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [adminPinConfirm, setAdminPinConfirm] = useState("");
  const [pinMsg, setPinMsg] = useState("");
  const [pinErr, setPinErr] = useState("");

  const homeRoute = user?.role === "admin" ? "/admin" : "/dashboard";

  useEffect(() => {
    api.get("/auth/me").then((res) => {
      setProfile(res.data);
      setForm({
        fullName: res.data.fullName ?? "",
        email: res.data.email ?? "",
      });
    });
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError("");
    try {
      await api.put("/auth/me", form);
      setProfile((p) => (p ? { ...p, ...form } : p));
      setEditing(false);
      setSaveSuccess("Cập nhật thành công!");
      setTimeout(() => setSaveSuccess(""), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setSaveError(
        Array.isArray(msg) ? msg.join(", ") : (msg ?? "Lỗi lưu thông tin"),
      );
    }
  };

  const handleSetAdminPin = async (e: FormEvent) => {
    e.preventDefault();
    setPinErr("");
    setPinMsg("");

    if (!/^\d{6}$/.test(adminPin)) {
      setPinErr("PIN admin phải là 6 chữ số.");
      return;
    }
    if (adminPin !== adminPinConfirm) {
      setPinErr("PIN xác nhận không khớp.");
      return;
    }

    try {
      await api.post("/admin/security/set-pin", { pin: adminPin });
      setAdminPin("");
      setAdminPinConfirm("");
      setPinMsg("Đã cập nhật PIN bảo mật admin.");
    } catch (err: any) {
      setPinErr(err?.response?.data?.message ?? "Không thể cập nhật PIN admin");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(homeRoute)}
            className="text-blue-600 hover:underline text-sm"
          >
            ← Quay lại
          </button>
          <h1 className="text-xl font-bold text-gray-800">Hồ sơ cá nhân</h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold">Thông tin tài khoản</h2>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="text-sm text-blue-600 hover:underline"
              >
                Chỉnh sửa
              </button>
            )}
          </div>

          <dl className="space-y-3 text-sm mb-5">
            <div>
              <dt className="text-gray-500">Tên đăng nhập</dt>
              <dd className="font-medium font-mono">{profile?.username}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Vai trò</dt>
              <dd>
                <span
                  className={`text-xs px-2 py-1 rounded font-medium ${
                    profile?.role === "admin"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {roleLabel[profile?.role ?? ""] ?? profile?.role}
                </span>
              </dd>
            </div>
          </dl>

          {saveSuccess && (
            <p className="text-green-600 text-sm mb-3">{saveSuccess}</p>
          )}

          {editing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Họ và tên
                </label>
                <input
                  value={form.fullName}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, fullName: e.target.value }))
                  }
                  placeholder="Nhập họ và tên..."
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, email: e.target.value }))
                  }
                  placeholder="email@example.com"
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              {saveError && <p className="text-red-500 text-sm">{saveError}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="flex-1 border rounded-lg py-2 text-gray-600 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700"
                >
                  Lưu
                </button>
              </div>
            </form>
          ) : (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Họ và tên</dt>
                <dd className="font-medium">
                  {profile?.fullName || (
                    <span className="text-gray-400 italic">(chưa có)</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium">
                  {profile?.email || (
                    <span className="text-gray-400 italic">(chưa có)</span>
                  )}
                </dd>
              </div>
            </dl>
          )}

          {profile?.role === "admin" && (
            <div className="mt-8 pt-6 border-t">
              <h3 className="font-semibold text-gray-800 mb-2">
                PIN bảo mật admin
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                PIN này dùng cho thao tác nhạy cảm như khóa/mở khóa tài khoản,
                reset mật khẩu và xem thông tin chi tiết người dùng.
              </p>

              <form onSubmit={handleSetAdminPin} className="space-y-3">
                <input
                  type="password"
                  maxLength={6}
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  placeholder="Nhập PIN admin 6 số"
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  type="password"
                  maxLength={6}
                  value={adminPinConfirm}
                  onChange={(e) => setAdminPinConfirm(e.target.value)}
                  placeholder="Nhập lại PIN admin"
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {pinErr && <p className="text-sm text-red-600">{pinErr}</p>}
                {pinMsg && <p className="text-sm text-green-600">{pinMsg}</p>}
                <button
                  type="submit"
                  className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-900"
                >
                  Lưu PIN admin
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserProfilePage;
