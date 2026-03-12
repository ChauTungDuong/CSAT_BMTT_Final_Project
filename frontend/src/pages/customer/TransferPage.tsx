import { useState, FormEvent } from "react";
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
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["my-accounts"],
    queryFn: async () => (await api.get("/accounts/me")).data,
  });

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
    setSuccess("");
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) {
      setError("Số tiền không hợp lệ.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/transactions/transfer", {
        fromAccountId: form.fromAccountId,
        toAccountNumber: form.toAccountNumber,
        amount: amt,
        description: form.description,
      });
      setSuccess("Chuyển tiền thành công!");
      setForm((p) => ({
        ...p,
        toAccountNumber: "",
        amount: "",
        description: "",
      }));
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

  return (
    <div className="min-h-screen bg-gray-50">
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
              <select
                value={form.fromAccountId}
                onChange={set("fromAccountId")}
                required
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">— Chọn tài khoản —</option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountNumber} ({a.accountType})
                  </option>
                ))}
              </select>
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

            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? "Đang xử lý…" : "Chuyển tiền"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default TransferPage;
