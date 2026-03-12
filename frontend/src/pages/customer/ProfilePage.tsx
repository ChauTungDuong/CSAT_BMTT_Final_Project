import { useState, FormEvent, useRef, KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { PinModal } from "../../components/common/PinModal";
import type { Customer } from "../../types";

interface UpdateProfileForm {
  fullName: string;
  email: string;
}

interface CustomerWithPin extends Customer {
  hasPin?: boolean;
}

// Component nhập PIN (6 ô) dùng nội bộ
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

  const { data: profile, refetch } = useQuery<CustomerWithPin>({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data } = await api.get("/customers/me");
      return data;
    },
    onSuccess: (data: CustomerWithPin) => {
      setForm({ fullName: data.fullName ?? "", email: data.email ?? "" });
    },
  } as Parameters<typeof useQuery<CustomerWithPin>>[0]);

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-blue-600 hover:underline text-sm"
          >
            ← Quay lại
          </button>
          <h1 className="text-xl font-bold text-gray-800">Hồ sơ cá nhân</h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold">Thông tin cơ bản</h2>
            {!editing && (
              <button
                onClick={() => {
                  setForm({
                    fullName: profile?.fullName ?? "",
                    email: profile?.email ?? "",
                  });
                  setEditing(true);
                }}
                className="text-sm text-blue-600 hover:underline"
              >
                Chỉnh sửa
              </button>
            )}
          </div>

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
                <dd className="font-medium">{profile?.fullName}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium">{profile?.email}</dd>
              </div>
            </dl>
          )}
        </div>

        {/* PIN */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold mb-2">PIN bảo mật</h2>
          <p className="text-sm text-gray-500 mb-4">
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
              <div className="flex gap-3">
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
