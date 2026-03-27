import { useState, FormEvent, useRef, KeyboardEvent, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { PinModal } from "../../components/common/PinModal";
import type { Customer } from "../../types";

interface UpdateProfileForm {
  fullName: string;
  email: string;
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

// Component nhập PIN (6 ô) dùng nội bộ cho việc ĐÔI/ĐẶT PIN
function PinInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const handleChange = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...value];
    next[i] = v;
    onChange(next);
    if (v && i < 5) inputs.current[i + 1]?.focus();
  };
  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[i] && i > 0)
      inputs.current[i - 1]?.focus();
  };
  return (
    <div>
      <label className="block text-sm text-gray-600 mb-2">{label}</label>
      <div className="flex gap-2">
        {value.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            type="password"
            maxLength={1}
            value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="w-10 h-12 text-center text-xl border-2 border-gray-300 rounded focus:border-blue-500 outline-none"
          />
        ))}
      </div>
    </div>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [viewToken, setViewToken] = useState("");
  const [viewExpiresAt, setViewExpiresAt] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSetPin, setShowSetPin] = useState(false);
  const [showChangePinForm, setShowChangePinForm] = useState(false);
  const [oldPinDigits, setOldPinDigits] = useState<string[]>(Array(6).fill(""));
  const [newPinDigits, setNewPinDigits] = useState<string[]>(Array(6).fill(""));
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState("");
  const [form, setForm] = useState<UpdateProfileForm>({
    fullName: "",
    email: "",
  });
  const [saveError, setSaveError] = useState("");

  const { data: profile, refetch } = useQuery<Customer>({
    queryKey: ["my-profile", pinVerified, viewToken],
    queryFn: async () => {
      const query =
        pinVerified && viewToken
          ? `?pinVerified=true&viewToken=${encodeURIComponent(viewToken)}`
          : "";
      const { data } = await api.get(`/customers/me${query}`);
      return data;
    },
    onSuccess: (data: Customer) => {
      setForm({ fullName: data.fullName ?? "", email: data.email ?? "" });
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
    try {
      await api.put("/customers/me", form);
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

  // Đổi PIN (đã có PIN cũ)
  const handleChangePin = async (e: FormEvent) => {
    e.preventDefault();
    setPinError("");
    const oldPin = oldPinDigits.join("");
    const newPin = newPinDigits.join("");
    if (oldPin.length < 6 || newPin.length < 6) {
      setPinError("Vui lòng nhập đủ 6 chữ số.");
      return;
    }
    try {
      await api.put("/customers/me/pin", { pin: newPin, oldPin });
      setShowChangePinForm(false);
      setOldPinDigits(Array(6).fill(""));
      setNewPinDigits(Array(6).fill(""));
      setPinSuccess("Đổi PIN thành công!");
      setTimeout(() => setPinSuccess(""), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setPinError(
        Array.isArray(msg) ? msg.join(", ") : (msg ?? "Có lỗi xảy ra"),
      );
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
                  onClick={() => {
                    setForm({
                      fullName: profile?.fullName ?? "",
                      email: profile?.email ?? "",
                    });
                    setEditing(true);
                  }}
                  className="text-sm bg-gray-100 text-gray-700 font-medium px-3 py-1 rounded hover:bg-gray-200"
                >
                  Chỉnh sửa
                </button>
              )}
            </div>
          </div>

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
                  Lưu
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

          {/* Form đổi PIN khi đã có PIN */}
          {showChangePinForm ? (
            <form onSubmit={handleChangePin} className="space-y-4">
              <PinInput
                label="PIN cũ"
                value={oldPinDigits}
                onChange={setOldPinDigits}
              />
              <PinInput
                label="PIN mới"
                value={newPinDigits}
                onChange={setNewPinDigits}
              />
              {pinError && <p className="text-red-500 text-sm">{pinError}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePinForm(false);
                    setPinError("");
                    setOldPinDigits(Array(6).fill(""));
                    setNewPinDigits(Array(6).fill(""));
                  }}
                  className="flex-1 border rounded-lg py-2 text-gray-600 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={
                    oldPinDigits.join("").length < 6 ||
                    newPinDigits.join("").length < 6
                  }
                  className="flex-1 bg-gray-800 text-white rounded-lg py-2 hover:bg-gray-900 disabled:opacity-50"
                >
                  Xác nhận đổi PIN
                </button>
              </div>
            </form>
          ) : (
            <>
              {pinError && (
                <p className="text-red-500 text-sm mb-3">{pinError}</p>
              )}
              <button
                onClick={() => {
                  setPinError("");
                  if (profile?.hasPin) {
                    setShowChangePinForm(true);
                  } else {
                    setShowSetPin(true);
                  }
                }}
                className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-900"
              >
                {profile?.hasPin ? "Đổi PIN" : "Đặt PIN"}
              </button>
            </>
          )}
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
    </div>
  );
}

export default ProfilePage;
