import { useState, FormEvent, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { PinModal } from "../../components/common/PinModal";
import type { Customer } from "../../types";

interface UpdateProfileForm {
  fullName: string;
  email: string;
  dateOfBirth: string;
  address: string;
}

function ProfileInfoCard({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800 break-words">
        {value && value.trim().length > 0 ? value : "--"}
      </p>
    </div>
  );
}

function toDateInputValue(dateValue?: string | null): string {
  if (!dateValue) return "";
  const trimmed = dateValue.trim();
  const slash = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slash) {
    const [, dd, mm, yyyy] = slash;
    return `${yyyy}-${mm}-${dd}`;
  }
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return trimmed;
  return "";
}

export function ProfilePage() {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [viewToken, setViewToken] = useState("");
  const [viewExpiresAt, setViewExpiresAt] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSetPin, setShowSetPin] = useState(false);
  const [showChangePinStep1, setShowChangePinStep1] = useState(false);
  const [showChangePinStep2, setShowChangePinStep2] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [otp, setOtp] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState("");
  const [form, setForm] = useState<UpdateProfileForm>({
    fullName: "",
    email: "",
    dateOfBirth: "",
    address: "",
  });
  const [saveError, setSaveError] = useState("");

  const { data: profile, refetch } = useQuery<Customer>({
    queryKey: ["my-profile", pinVerified, viewToken],
    queryFn: async () => {
      const { data } = await api.get("/customers/me", {
        params: pinVerified && viewToken ? { viewToken } : undefined,
      });
      return data;
    },
    onSuccess: (data: Customer) => {
      setForm({
        fullName: data.fullName ?? "",
        email: data.email ?? "",
        dateOfBirth: toDateInputValue(data.dateOfBirth),
        address: data.address ?? "",
      });
    },
  } as any);

  useEffect(() => {
    if (!pinVerified || !viewExpiresAt) return;
    const remain = new Date(viewExpiresAt).getTime() - Date.now();
    if (remain <= 0) {
      setPinVerified(false);
      setViewToken("");
      setViewExpiresAt(null);
      return;
    }

    const timer = setTimeout(() => {
      setPinVerified(false);
      setViewToken("");
      setViewExpiresAt(null);
      refetch();
    }, remain);

    return () => clearTimeout(timer);
  }, [pinVerified, viewExpiresAt, refetch]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError("");

    if (!pinVerified || !viewToken) {
      setSaveError("Vui lòng xác thực PIN trước khi cập nhật hồ sơ.");
      return;
    }

    try {
      await api.put("/customers/me", form, {
        params: { viewToken },
      });
      setEditing(false);
      refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setSaveError(
        Array.isArray(msg) ? msg.join(", ") : (msg ?? "Lỗi lưu thông tin"),
      );
    }
  };

  const handlePinSuccess = (payload?: any) => {
    if (payload?.viewToken) {
      setViewToken(payload.viewToken);
      setViewExpiresAt(payload.expiresAt ?? null);
    }
    setPinVerified(true);
    setShowPinModal(false);
    refetch();
  };

  // Đặt PIN lần đầu (chưa có PIN)
  const handleSetPin = async (pin: string) => {
    await api.put("/customers/me/pin", { pin });
  };

  const handleSetPinSuccess = () => {
    setShowSetPin(false);
    setPinSuccess("Đặt PIN thành công!");
    refetch();
    setTimeout(() => setPinSuccess(""), 3000);
  };

  const requestPinChangeOtp = async (e: FormEvent) => {
    e.preventDefault();
    setPinError("");

    if (!currentPassword.trim()) {
      setPinError("Vui lòng nhập mật khẩu hiện tại.");
      return;
    }

    if (!/^\d{6}$/.test(currentPin)) {
      setPinError("PIN hiện tại phải gồm đúng 6 chữ số.");
      return;
    }

    setPinSubmitting(true);
    try {
      await api.post("/customers/me/pin/change/request-otp", {
        currentPassword,
        currentPin,
      });

      setShowChangePinStep1(false);
      setShowChangePinStep2(true);
      setPinSuccess("OTP đã được gửi tới email đăng ký của bạn.");
      setTimeout(() => setPinSuccess(""), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setPinError(
        Array.isArray(msg) ? msg.join(", ") : (msg ?? "Có lỗi xảy ra"),
      );
    } finally {
      setPinSubmitting(false);
    }
  };

  const confirmPinChange = async (e: FormEvent) => {
    e.preventDefault();
    setPinError("");

    if (!/^\d{6}$/.test(otp)) {
      setPinError("OTP phải gồm đúng 6 chữ số.");
      return;
    }

    if (!/^\d{6}$/.test(newPin)) {
      setPinError("PIN mới phải gồm đúng 6 chữ số.");
      return;
    }

    if (newPin !== confirmNewPin) {
      setPinError("PIN xác nhận không khớp.");
      return;
    }

    setPinSubmitting(true);
    try {
      await api.put("/customers/me/pin/change/confirm", {
        otp,
        newPin,
        confirmPin: confirmNewPin,
      });

      setShowChangePinStep2(false);
      setCurrentPassword("");
      setCurrentPin("");
      setOtp("");
      setNewPin("");
      setConfirmNewPin("");
      setPinSuccess("Đổi PIN thành công!");
      setTimeout(() => setPinSuccess(""), 3000);
      refetch();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setPinError(
        Array.isArray(msg) ? msg.join(", ") : (msg ?? "Có lỗi xảy ra"),
      );
    } finally {
      setPinSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                Hồ sơ cá nhân
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Quản lý thông tin cá nhân và thiết lập bảo mật PIN.
              </p>
            </div>
            <button
              onClick={() => navigate("/dashboard")}
              className="text-sm border border-slate-300 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50"
            >
              Quay lại
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-4">
          <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-3">
            <h2 className="font-semibold text-lg text-slate-800">
              Thông tin cơ bản
            </h2>
            <div className="flex gap-4 items-center">
              {!pinVerified && (
                <button
                  onClick={() => setShowPinModal(true)}
                  className="text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg"
                >
                  Xác thực PIN để xem đầy đủ
                </button>
              )}
              {!editing && (
                <button
                  disabled={!pinVerified}
                  onClick={() => {
                    if (!pinVerified) return;
                    setForm({
                      fullName: profile?.fullName ?? "",
                      email: profile?.email ?? "",
                      dateOfBirth: toDateInputValue(profile?.dateOfBirth),
                      address: profile?.address ?? "",
                    });
                    setEditing(true);
                  }}
                  className="text-sm bg-gray-100 text-gray-700 font-medium px-3 py-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cập nhật
                </button>
              )}
            </div>
          </div>

          {!pinVerified && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Bạn cần xác thực PIN để mở quyền cập nhật hồ sơ cá nhân.
            </p>
          )}

          {editing ? (
            <form onSubmit={handleSave} className="space-y-4 pt-2">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Họ và tên
                </label>
                <input
                  value={form.fullName}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, fullName: e.target.value }))
                  }
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
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Ngày sinh
                </label>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, dateOfBirth: e.target.value }))
                  }
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Địa chỉ
                </label>
                <textarea
                  rows={3}
                  value={form.address}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, address: e.target.value }))
                  }
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              {saveError && <p className="text-red-500 text-sm">{saveError}</p>}
              <div className="flex gap-3 pt-2">
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
                  Xác nhận cập nhật
                </button>
              </div>
            </form>
          ) : (
            <div className="pt-2">
              <div className="mb-3 text-xs text-slate-500">
                Trạng thái hiển thị:
                <span
                  className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                    pinVerified
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {pinVerified
                    ? "Đang hiển thị đầy đủ"
                    : "Đang che dữ liệu nhạy cảm"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ProfileInfoCard label="Họ và tên" value={profile?.fullName} />
                <ProfileInfoCard label="Email" value={profile?.email} />
                <ProfileInfoCard label="Số điện thoại" value={profile?.phone} />
                <ProfileInfoCard label="CCCD" value={profile?.cccd} />
                <ProfileInfoCard
                  label="Ngày sinh"
                  value={profile?.dateOfBirth}
                />
                <div className="md:col-span-2">
                  <ProfileInfoCard label="Địa chỉ" value={profile?.address} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PIN */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-2">PIN bảo mật</h2>
          <p className="text-sm text-slate-500 mb-4">
            PIN 6 chữ số bảo vệ quyền xem thông tin nhạy cảm.
          </p>
          {pinSuccess && (
            <p className="text-green-600 text-sm mb-3">{pinSuccess}</p>
          )}

          {pinError && <p className="text-red-500 text-sm mb-3">{pinError}</p>}

          <button
            onClick={() => {
              setPinError("");
              if (profile?.hasPin) {
                setShowChangePinStep1(true);
              } else {
                setShowSetPin(true);
              }
            }}
            className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-900"
          >
            {profile?.hasPin ? "Đổi PIN (xác thực 2 bước)" : "Đặt PIN"}
          </button>
        </div>
      </div>

      {showPinModal && (
        <PinModal
          onSuccess={handlePinSuccess}
          onClose={() => setShowPinModal(false)}
        />
      )}

      {showSetPin && (
        <PinModal
          title="Đặt PIN mới"
          onConfirm={handleSetPin}
          onSuccess={handleSetPinSuccess}
          onClose={() => setShowSetPin(false)}
        />
      )}

      {showChangePinStep1 && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl">
            <div className="px-5 py-4 border-b bg-slate-50 rounded-t-2xl">
              <h3 className="font-semibold text-slate-800">
                Bước 1: Xác thực đổi PIN
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Nhập mật khẩu hiện tại và PIN hiện tại để nhận OTP.
              </p>
            </div>
            <form
              onSubmit={requestPinChangeOtp}
              className="px-5 py-4 space-y-3"
            >
              <div>
                <label className="block text-sm text-slate-600 mb-1">
                  Mật khẩu hiện tại
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">
                  PIN hiện tại
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={currentPin}
                  onChange={(e) =>
                    setCurrentPin(e.target.value.replace(/\D/g, ""))
                  }
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              {pinError && <p className="text-red-500 text-sm">{pinError}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePinStep1(false);
                    setPinError("");
                  }}
                  className="flex-1 border rounded-lg py-2 text-gray-600 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={pinSubmitting}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700 disabled:opacity-50"
                >
                  {pinSubmitting ? "Đang gửi..." : "Gửi OTP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showChangePinStep2 && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl">
            <div className="px-5 py-4 border-b bg-slate-50 rounded-t-2xl">
              <h3 className="font-semibold text-slate-800">
                Bước 2: OTP và PIN mới
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Nhập OTP email, PIN mới và xác nhận PIN mới.
              </p>
            </div>
            <form onSubmit={confirmPinChange} className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">OTP</label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">
                  PIN mới
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">
                  Xác nhận PIN mới
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={confirmNewPin}
                  onChange={(e) =>
                    setConfirmNewPin(e.target.value.replace(/\D/g, ""))
                  }
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              {pinError && <p className="text-red-500 text-sm">{pinError}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePinStep2(false);
                    setOtp("");
                    setNewPin("");
                    setConfirmNewPin("");
                    setPinError("");
                  }}
                  className="flex-1 border rounded-lg py-2 text-gray-600 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={pinSubmitting}
                  className="flex-1 bg-gray-800 text-white rounded-lg py-2 hover:bg-gray-900 disabled:opacity-50"
                >
                  {pinSubmitting ? "Đang xử lý..." : "Xác nhận đổi PIN"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage;
