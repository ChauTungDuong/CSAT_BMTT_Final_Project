import { useState, FormEvent, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

interface UserProfile {
  id: string;
  username: string;
  role: string;
  fullName: string | null;
  email: string | null;
  hasAdminPin?: boolean;
}

const roleLabel: Record<string, string> = {
  admin: "Quản trị viên",
  customer: "Khách hàng",
};

export function UserProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "" });
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [adminPinConfirm, setAdminPinConfirm] = useState("");
  const [pinMsg, setPinMsg] = useState("");
  const [pinErr, setPinErr] = useState("");

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

    try {
      if (profile?.hasAdminPin) {
        if (!currentPassword.trim()) {
          setPinErr("Vui lòng nhập mật khẩu hiện tại.");
          return;
        }
        if (!/^\d{6}$/.test(currentPin)) {
          setPinErr("PIN hiện tại phải gồm đúng 6 chữ số.");
          return;
        }
        if (!/^\d{6}$/.test(newPin)) {
          setPinErr("PIN mới phải gồm đúng 6 chữ số.");
          return;
        }
        if (newPin !== adminPinConfirm) {
          setPinErr("PIN xác nhận không khớp.");
          return;
        }

        await api.post("/admin/security/change-pin", {
          currentPassword,
          currentPin,
          newPin,
          confirmPin: adminPinConfirm,
        });
        setCurrentPassword("");
        setCurrentPin("");
        setNewPin("");
      } else {
        if (!/^\d{6}$/.test(adminPin)) {
          setPinErr("PIN admin phải là 6 chữ số.");
          return;
        }
        if (adminPin !== adminPinConfirm) {
          setPinErr("PIN xác nhận không khớp.");
          return;
        }
        await api.post("/admin/security/set-pin", { pin: adminPin });
        setAdminPin("");
      }

      setAdminPinConfirm("");
      setPinMsg("Đã cập nhật PIN bảo mật admin.");
      setProfile((prev) => (prev ? { ...prev, hasAdminPin: true } : prev));
    } catch (err: any) {
      setPinErr(err?.response?.data?.message ?? "Không thể cập nhật PIN admin");
    }
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/15";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100/90 to-gray-50">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="space-y-6 rounded-2xl bg-white p-5 shadow-md sm:p-6 md:p-8">
          <nav
            className="flex flex-wrap gap-3"
            aria-label="Điều hướng nhanh quản trị"
          >
            <Link
              to="/admin"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-100 px-5 py-3 text-base font-semibold text-slate-800 shadow-sm transition hover:bg-slate-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Quản lý tài khoản
            </Link>
            <Link
              to="/admin/audit"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-100 px-5 py-3 text-base font-semibold text-slate-800 shadow-sm transition hover:bg-slate-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Audit log
            </Link>
          </nav>

          <header>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
              Hồ sơ cá nhân
            </h1>
            <p className="mt-2 text-base text-slate-500">
              Thông tin hiển thị và PIN dùng cho thao tác quản trị có kiểm soát.
            </p>
          </header>

          <section
            className="rounded-xl border border-slate-100 p-5 sm:p-6"
            aria-labelledby="admin-profile-account-heading"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2
                id="admin-profile-account-heading"
                className="text-lg font-semibold text-slate-800"
              >
                Thông tin tài khoản
              </h2>
              {!editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-base font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Cập nhật
                </button>
              )}
            </div>

            {saveSuccess && (
              <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-base text-emerald-700">
                {saveSuccess}
              </p>
            )}

            {editing ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-4">
                  <div>
                    <span className="block text-sm font-medium text-slate-600">
                      Tên đăng nhập
                    </span>
                    <p className="mt-1.5 font-mono text-base font-medium text-slate-900">
                      {profile?.username}
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor="profile-fullName"
                      className="mb-1.5 block text-sm font-medium text-slate-600"
                    >
                      Họ và tên
                    </label>
                    <input
                      id="profile-fullName"
                      value={form.fullName}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, fullName: e.target.value }))
                      }
                      placeholder="Nhập họ và tên..."
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="profile-email"
                      className="mb-1.5 block text-sm font-medium text-slate-600"
                    >
                      Email
                    </label>
                    <input
                      id="profile-email"
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, email: e.target.value }))
                      }
                      placeholder="email@example.com"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-slate-600">
                      Vai trò
                    </span>
                    <div className="mt-1.5">
                      <span
                        className={`inline-flex rounded-lg px-2.5 py-1 text-sm font-medium ${
                          profile?.role === "admin"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {roleLabel[profile?.role ?? ""] ?? profile?.role}
                      </span>
                    </div>
                  </div>
                </div>
                {saveError && (
                  <p className="text-base text-red-600">{saveError}</p>
                )}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="flex-1 rounded-xl border border-slate-200 py-2.5 text-base font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-blue-600 py-2.5 text-base font-semibold text-white transition hover:bg-blue-700"
                  >
                    Lưu
                  </button>
                </div>
              </form>
            ) : (
              <dl className="grid grid-cols-1 gap-4 text-base sm:grid-cols-2 sm:gap-x-8 sm:gap-y-4">
                <div>
                  <dt className="text-slate-500">Tên đăng nhập</dt>
                  <dd className="mt-0.5 font-mono font-medium text-slate-900">
                    {profile?.username}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Họ và tên</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {profile?.fullName || (
                      <span className="text-slate-400 italic">(chưa có)</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Email</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {profile?.email || (
                      <span className="text-slate-400 italic">(chưa có)</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Vai trò</dt>
                  <dd className="mt-1">
                    <span
                      className={`inline-flex rounded-lg px-2.5 py-1 text-sm font-medium ${
                        profile?.role === "admin"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {roleLabel[profile?.role ?? ""] ?? profile?.role}
                    </span>
                  </dd>
                </div>
              </dl>
            )}
          </section>

          {profile?.role === "admin" && (
            <section
              className="rounded-xl border border-slate-100 p-5 sm:p-6"
              aria-labelledby="admin-profile-pin-heading"
            >
              <h3
                id="admin-profile-pin-heading"
                className="mb-1 text-lg font-semibold text-slate-800"
              >
                PIN bảo mật admin
              </h3>
              <p className="mb-4 text-sm text-slate-500 sm:text-base">
                Dùng khi khóa/mở khóa tài khoản và các thao tác nhạy cảm khác.
              </p>

              <form onSubmit={handleSetAdminPin} className="space-y-3">
                {profile?.hasAdminPin ? (
                  <>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Mật khẩu hiện tại"
                      className={inputClass}
                    />
                    <input
                      type="password"
                      maxLength={6}
                      value={currentPin}
                      onChange={(e) =>
                        setCurrentPin(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="PIN hiện tại (6 số)"
                      className={inputClass}
                    />
                    <input
                      type="password"
                      maxLength={6}
                      value={newPin}
                      onChange={(e) =>
                        setNewPin(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="PIN mới (6 số)"
                      className={inputClass}
                    />
                  </>
                ) : (
                  <input
                    type="password"
                    maxLength={6}
                    value={adminPin}
                    onChange={(e) =>
                      setAdminPin(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="Nhập PIN admin 6 số"
                    className={inputClass}
                  />
                )}
                <input
                  type="password"
                  maxLength={6}
                  value={adminPinConfirm}
                  onChange={(e) =>
                    setAdminPinConfirm(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder={
                    profile?.hasAdminPin
                      ? "Xác nhận PIN mới"
                      : "Nhập lại PIN admin"
                  }
                  className={inputClass}
                />
                {pinErr && <p className="text-base text-red-600">{pinErr}</p>}
                {pinMsg && (
                  <p className="text-base text-green-600">{pinMsg}</p>
                )}
                <button
                  type="submit"
                  className="rounded-xl bg-slate-800 px-5 py-2.5 text-base font-semibold text-white transition hover:bg-slate-900"
                >
                  {profile?.hasAdminPin ? "Đổi PIN admin" : "Lưu PIN admin"}
                </button>
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
