import { useState, FormEvent, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import type { Account } from "../../types";

export function TransferPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fromAccountId: "",
    toAccountNumber: "",
    amount: "",
    description: "",
    pin: "",
  });
  const [error, setError] = useState("");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["my-accounts"],
    queryFn: async () => (await api.get("/accounts/me")).data,
  });

  // Auto-select first account when loaded
  useEffect(() => {
    if (accounts && accounts.length > 0 && !form.fromAccountId) {
      setForm((prev) => ({ ...prev, fromAccountId: accounts[0].id }));
    }
  }, [accounts, form.fromAccountId]);

  const set =
    (field: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) {
      setError("Số tiền không hợp lệ.");
      return;
    }
    if (!/^\d{6}$/.test(form.pin)) {
      setError("Mã PIN phải là 6 chữ số.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/transactions/transfer", {
        fromAccountId: form.fromAccountId,
        toAccountNumber: form.toAccountNumber,
        amount: amt,
        description: form.description,
        pin: form.pin,
      });
      setShowSuccessDialog(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setError(
        Array.isArray(msg) ? msg.join(", ") : (msg ?? "Chuyển tiền thất bại."),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSuccess = () => {
    setShowSuccessDialog(false);
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-blue-600 hover:underline text-sm"
          >
            ← Quay lại
          </button>
          <h1 className="text-xl font-bold text-gray-800">Chuyển tiền</h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tài khoản nguồn
              </label>
              <div className="w-full border rounded-lg px-3 py-2 bg-gray-100 text-gray-700 flex items-center">
                {accounts?.[0] ? (
                  <span>
                    {accounts[0].accountNumber} ({accounts[0].accountType})
                  </span>
                ) : (
                  <span className="text-gray-400">Đang tải...</span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Số tài khoản nhận
              </label>
              <input
                type="text"
                value={form.toAccountNumber}
                onChange={set("toAccountNumber")}
                required
                placeholder="Nhập số tài khoản người nhận"
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Số tiền (VNĐ)
              </label>
              <input
                type="number"
                value={form.amount}
                onChange={set("amount")}
                required
                min="1000"
                step="1000"
                placeholder="0"
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nội dung chuyển khoản
              </label>
              <input
                type="text"
                value={form.description}
                onChange={set("description")}
                maxLength={200}
                placeholder="Ví dụ: Trả tiền thuê nhà tháng 6"
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mã PIN xác thực
              </label>
              <input
                type="password"
                maxLength={6}
                value={form.pin}
                onChange={set("pin")}
                required
                placeholder="Nhập mã PIN 6 số"
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none tracking-widest text-center"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? "Đang xử lý…" : "Chuyển tiền"}
            </button>
          </form>
        </div>
      </div>

      {showSuccessDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center transform transition-all">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Chuyển tiền thành công!
            </h3>
            <p className="text-gray-500 mb-6">
              Số tiền đã được chuyển đến tài khoản {form.toAccountNumber}.
            </p>
            <button
              onClick={handleCloseSuccess}
              className="w-full bg-green-600 text-white py-2 rounded-xl font-medium hover:bg-green-700 transition-colors"
            >
              Trở về trang chủ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TransferPage;
