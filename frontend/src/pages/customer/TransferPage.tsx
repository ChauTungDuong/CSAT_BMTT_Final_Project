import { useState, FormEvent, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { BackToDashboardLink } from "../../components/common/BackToDashboardLink";
import type { Account } from "../../types";
import { accountTypeLabel } from "../../utils/accountLabels";

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
    <div className="min-h-screen bg-gradient-to-b from-slate-100/90 to-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6 md:p-8">
          <header>
            <BackToDashboardLink className="mb-3" />
            <h1 className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">
              Chuyển tiền
            </h1>
          </header>

          <div className="w-full rounded-xl border border-slate-100 bg-slate-50/90 p-5 sm:p-6">
            <form onSubmit={handleSubmit} className="w-full space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Tài khoản nguồn
                </label>
                <div className="flex w-full items-center rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-700">
                  {accounts?.[0] ? (
                    <span>
                      {`${accounts[0].accountNumber} (${accountTypeLabel(accounts[0].accountType)})`}
                    </span>
                  ) : (
                    <span className="text-slate-400">Đang tải...</span>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Số tài khoản nhận
                </label>
                <input
                  type="text"
                  value={form.toAccountNumber}
                  onChange={set("toAccountNumber")}
                  required
                  placeholder="Nhập số tài khoản người nhận"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
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
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Nội dung chuyển khoản
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={set("description")}
                  maxLength={200}
                  placeholder="Ví dụ: Trả tiền thuê nhà tháng 6"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Mã PIN xác thực
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={form.pin}
                  onChange={set("pin")}
                  required
                  placeholder="Nhập mã PIN 6 số"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-center tracking-widest outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-4 w-full rounded-xl bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Đang xử lý…" : "Chuyển tiền"}
              </button>
            </form>
          </div>
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
