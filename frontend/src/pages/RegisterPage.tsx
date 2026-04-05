import { useState, useEffect, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/client";
import { EyeIcon, EyeSlashIcon } from "../components/common/EyeIcons";
import {
  OutlinedFormControl,
  outlinedInputClassName,
  outlinedSelectClassName,
} from "../components/common/OutlinedFormControl";

interface Ward {
  ward_code: string;
  name: string;
}

interface Province {
  province_code: string;
  name: string;
  wards: Ward[];
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    password: "",
    confirm: "",
    email: "",
    phone: "",
    cccd: "",
    dateOfBirth: "",
    city: "",
    ward: "",
    detailedAddress: "",
  });
  const [accountNumberMode, setAccountNumberMode] = useState<
    "random" | "phone"
  >("random");
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    fetch("/data.json")
      .then((res) => res.json())
      .then((data) => setProvinces(data))
      .catch((err) => console.error("Lỗi tải dữ liệu địa lý:", err));
  }, []);

  const set =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const val = e.target.value;
      setForm((prev) => {
        const next = { ...prev, [field]: val };
        if (field === "city") {
          const selected = provinces.find((p) => p.name === val);
          setWards(selected ? selected.wards : []);
          next.ward = "";
        }
        return next;
      });
    };

  const generateAccountNumber = () => {
    return "10" + Math.floor(10000000 + Math.random() * 90000000).toString();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Xác nhận mật khẩu không khớp.");
      return;
    }
    setLoading(true);
    try {
      const addressString = `${form.detailedAddress}, ${form.ward}, ${form.city}`;
      const fullName = `${form.lastName} ${form.firstName}`.trim();
      const accountNumber =
        accountNumberMode === "phone"
          ? form.phone.trim()
          : generateAccountNumber();

      await api.post("/auth/register", {
        username: form.username,
        password: form.password,
        fullName,
        email: form.email,
        phone: form.phone,
        cccd: form.cccd,
        dateOfBirth: form.dateOfBirth,
        address: addressString,
        accountNumber,
      });
      setShowSuccessDialog(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Đăng ký thất bại.";
      setError(Array.isArray(msg) ? msg.join(", ") : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:py-8">
      <div className="bg-white shadow-lg rounded-2xl px-6 py-6 sm:px-10 sm:py-8 w-full max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-blue-700 mb-1 text-center">
          BankDemo
        </h1>
        <p className="text-gray-500 mb-6 text-sm text-center">
          Đăng ký tài khoản khách hàng
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-5">
            <OutlinedFormControl
              id="register-last-name"
              label="Họ và đệm"
              required
            >
              <input
                id="register-last-name"
                required
                value={form.lastName}
                onChange={set("lastName")}
                className={outlinedInputClassName}
              />
            </OutlinedFormControl>
            <OutlinedFormControl id="register-first-name" label="Tên" required>
              <input
                id="register-first-name"
                required
                value={form.firstName}
                onChange={set("firstName")}
                className={outlinedInputClassName}
              />
            </OutlinedFormControl>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <OutlinedFormControl
              id="register-username"
              label="Tên đăng nhập"
              required
            >
              <input
                id="register-username"
                required
                minLength={3}
                maxLength={100}
                value={form.username}
                onChange={set("username")}
                className={outlinedInputClassName}
                autoComplete="username"
              />
            </OutlinedFormControl>
            <OutlinedFormControl id="register-email" label="Email" required>
              <input
                id="register-email"
                required
                type="email"
                value={form.email}
                onChange={set("email")}
                className={outlinedInputClassName}
                autoComplete="email"
              />
            </OutlinedFormControl>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <OutlinedFormControl
              id="register-password"
              label="Mật khẩu"
              required
            >
              <div className="relative flex min-h-[1.5rem] items-center">
                <input
                  id="register-password"
                  required
                  type={showPassword ? "text" : "password"}
                  minLength={8}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={set("password")}
                  className={`${outlinedInputClassName} pr-10`}
                />
                <button
                  type="button"
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-800 focus:outline-none focus-visible:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-500/35 focus-visible:ring-offset-0 rounded-sm"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                </button>
              </div>
            </OutlinedFormControl>
            <OutlinedFormControl
              id="register-confirm-password"
              label="Xác nhận mật khẩu"
              required
            >
              <div className="relative flex min-h-[1.5rem] items-center">
                <input
                  id="register-confirm-password"
                  required
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={set("confirm")}
                  className={`${outlinedInputClassName} pr-10`}
                />
                <button
                  type="button"
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-800 focus:outline-none focus-visible:text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-500/35 focus-visible:ring-offset-0 rounded-sm"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={
                    showConfirmPassword
                      ? "Ẩn xác nhận mật khẩu"
                      : "Hiện xác nhận mật khẩu"
                  }
                  aria-pressed={showConfirmPassword}
                >
                  {showConfirmPassword ? <EyeSlashIcon /> : <EyeIcon />}
                </button>
              </div>
            </OutlinedFormControl>
          </div>

          <div className="grid grid-cols-3 gap-5">
            <OutlinedFormControl
              id="register-phone"
              label="Số điện thoại"
              required
            >
              <input
                id="register-phone"
                required
                value={form.phone}
                onChange={set("phone")}
                className={outlinedInputClassName}
                autoComplete="tel"
              />
            </OutlinedFormControl>
            <OutlinedFormControl id="register-cccd" label="CCCD" required>
              <input
                id="register-cccd"
                required
                value={form.cccd}
                onChange={set("cccd")}
                className={outlinedInputClassName}
              />
            </OutlinedFormControl>
            <OutlinedFormControl
              id="register-dob"
              label="Ngày sinh"
              required
            >
              <input
                id="register-dob"
                required
                type="date"
                value={form.dateOfBirth}
                onChange={set("dateOfBirth")}
                className={outlinedInputClassName}
              />
            </OutlinedFormControl>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <OutlinedFormControl
              id="register-city"
              label="Tỉnh / Thành phố"
              required
            >
              <select
                id="register-city"
                required
                value={form.city}
                onChange={set("city")}
                className={outlinedSelectClassName}
              >
                <option value="">Chọn Tỉnh/Thành</option>
                {provinces.map((p) => (
                  <option key={p.province_code} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </OutlinedFormControl>
            <OutlinedFormControl
              id="register-ward"
              label="Phường / Xã"
              required
            >
              <select
                id="register-ward"
                required
                value={form.ward}
                onChange={set("ward")}
                disabled={!form.city}
                className={`${outlinedSelectClassName} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <option value="">Chọn Phường/Xã</option>
                {wards.map((w) => (
                  <option key={w.ward_code} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </select>
            </OutlinedFormControl>
          </div>

          <OutlinedFormControl
            id="register-address"
            label="Địa chỉ chi tiết"
            required
          >
            <input
              id="register-address"
              required
              value={form.detailedAddress}
              onChange={set("detailedAddress")}
              placeholder="Số nhà, đường..."
              className={outlinedInputClassName}
              autoComplete="street-address"
            />
          </OutlinedFormControl>

          <OutlinedFormControl
            id="register-account-mode-wrap"
            labelForId="account-mode-random"
            label="Tùy chọn số tài khoản"
            required
          >
            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input
                  id="account-mode-random"
                  type="radio"
                  name="account-mode"
                  checked={accountNumberMode === "random"}
                  onChange={() => setAccountNumberMode("random")}
                  className="text-blue-600 focus:ring-blue-500"
                />
                Tạo số tài khoản ngẫu nhiên
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input
                  id="account-mode-phone"
                  type="radio"
                  name="account-mode"
                  checked={accountNumberMode === "phone"}
                  onChange={() => setAccountNumberMode("phone")}
                  className="text-blue-600 focus:ring-blue-500"
                />
                Sử dụng số điện thoại làm số tài khoản
              </label>
            </div>
          </OutlinedFormControl>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3.5 rounded-lg hover:bg-blue-700 transition flex items-center justify-center text-base font-medium disabled:opacity-50 mt-4 min-h-[2.75rem]"
          >
            {loading ? "Đang xử lý..." : "Hoàn tất đăng ký"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          Đã có tài khoản?{" "}
          <Link to="/login" className="text-blue-600 hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>

      {showSuccessDialog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 text-center">
              Đăng ký thành công
            </h3>
            <p className="text-sm text-gray-600 text-center mt-2">
              Tài khoản đã được tạo. Vui lòng đăng nhập để tiếp tục.
            </p>
            <button
              onClick={() => navigate("/login")}
              className="mt-6 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Đến trang đăng nhập
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
