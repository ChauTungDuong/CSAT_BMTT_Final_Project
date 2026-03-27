import { useState, useEffect, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/client";

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
  const requiredStar = <span className="text-red-500 ml-1">*</span>;
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
      navigate("/login");
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-10">
      <div className="bg-white shadow-lg rounded-2xl p-10 w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-blue-700 mb-2 text-center">
          BankDemo
        </h1>
        <p className="text-gray-500 mb-6 text-sm text-center">
          Đăng ký tài khoản khách hàng
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Họ và đệm{requiredStar}
              </label>
              <input
                required
                value={form.lastName}
                onChange={set("lastName")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tên{requiredStar}
              </label>
              <input
                required
                value={form.firstName}
                onChange={set("firstName")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tên đăng nhập{requiredStar}
              </label>
              <input
                required
                minLength={3}
                maxLength={100}
                value={form.username}
                onChange={set("username")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email{requiredStar}
              </label>
              <input
                required
                type="email"
                value={form.email}
                onChange={set("email")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mật khẩu{requiredStar}
              </label>
              <input
                required
                type="password"
                minLength={8}
                value={form.password}
                onChange={set("password")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Xác nhận mật khẩu{requiredStar}
              </label>
              <input
                required
                type="password"
                value={form.confirm}
                onChange={set("confirm")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Số điện thoại{requiredStar}
              </label>
              <input
                required
                value={form.phone}
                onChange={set("phone")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CCCD{requiredStar}
              </label>
              <input
                required
                value={form.cccd}
                onChange={set("cccd")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ngày sinh{requiredStar}
              </label>
              <input
                required
                type="date"
                value={form.dateOfBirth}
                onChange={set("dateOfBirth")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tỉnh / Thành phố{requiredStar}
              </label>
              <select
                required
                value={form.city}
                onChange={set("city")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Chọn Tỉnh/Thành</option>
                {provinces.map((p) => (
                  <option key={p.province_code} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phường / Xã{requiredStar}
              </label>
              <select
                required
                value={form.ward}
                onChange={set("ward")}
                disabled={!form.city}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">Chọn Phường/Xã</option>
                {wards.map((w) => (
                  <option key={w.ward_code} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Địa chỉ chi tiết{requiredStar}
            </label>
            <input
              required
              value={form.detailedAddress}
              onChange={set("detailedAddress")}
              placeholder="Số nhà, đường..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tùy chọn số tài khoản{requiredStar}
            </label>
            <div className="space-y-2 rounded-lg border border-gray-300 p-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="account-mode"
                  checked={accountNumberMode === "random"}
                  onChange={() => setAccountNumberMode("random")}
                />
                Tạo số tài khoản ngẫu nhiên
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="account-mode"
                  checked={accountNumberMode === "phone"}
                  onChange={() => setAccountNumberMode("phone")}
                />
                Sử dụng số điện thoại làm số tài khoản
              </label>
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
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center font-medium disabled:opacity-50 mt-4"
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
    </div>
  );
}
