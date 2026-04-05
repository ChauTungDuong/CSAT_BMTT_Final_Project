import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../api/client";
import { BackToDashboardLink } from "../../components/common/BackToDashboardLink";
import type { Account, Transaction } from "../../types";
import { accountTypeLabel } from "../../utils/accountLabels";
import { transactionTypeLabelVi } from "../../utils/transactionLabels";

const TX_STATUS_LABELS: Record<string, string> = {
  completed: "Thành công",
  failed: "Thất bại",
  pending: "Đang xử lý",
  cancelled: "Đã hủy",
  reversed: "Đã hoàn tác",
  processing: "Đang xử lý",
};

function transactionStatusLabel(status: string): string {
  const k = status.trim().toLowerCase();
  return TX_STATUS_LABELS[k] ?? "Không xác định";
}

export function TransactionHistoryPage() {
  const [page, setPage] = useState(1);

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["my-accounts"],
    queryFn: async () => (await api.get("/accounts/me")).data,
  });

  const currentAccount = useMemo(() => accounts?.[0], [accounts]);
  const currentAccountId = currentAccount?.id ?? "";

  const { data: history, isLoading } = useQuery<{
    items: Transaction[];
    total: number;
    page: number;
    limit: number;
  }>({
    queryKey: ["tx-history", currentAccountId, page],
    queryFn: async () =>
      (
        await api.get(
          `/transactions/accounts/${currentAccountId}/history?page=${page}`,
        )
      ).data,
    enabled: !!currentAccountId,
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100/90 to-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6 md:p-8">
          <header>
            <BackToDashboardLink className="mb-3" />
            <h1 className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">
              Lịch sử giao dịch
            </h1>
          </header>

          <div className="rounded-xl border border-slate-100 bg-slate-50/90 p-5 sm:p-6">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Tài khoản hiện tại
            </label>
            <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
              {currentAccount
                ? `${currentAccount.accountNumber} (${accountTypeLabel(currentAccount.accountType)})`
                : "Không tìm thấy tài khoản"}
            </div>
          </div>

          {currentAccountId ? (
            <div className="overflow-hidden rounded-xl border border-slate-100">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">
                Đang tải dữ liệu...
              </div>
            ) : history?.items?.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Chưa có giao dịch nào.
              </div>
            ) : (
              <div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-sm">
                      <th className="px-6 py-3 border-b">Thời gian</th>
                      <th className="px-6 py-3 border-b">Loại Giao Dịch</th>
                      <th className="px-6 py-3 border-b">Số Tiền</th>
                      <th className="px-6 py-3 border-b">Nội Dung</th>
                      <th className="px-6 py-3 border-b text-center">
                        Trạng Thái
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history?.items.map((tx) => (
                      <tr
                        key={tx.id}
                        className="border-b last:border-0 hover:bg-gray-50 transition"
                      >
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(tx.createdAt).toLocaleString("vi-VN")}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-800">
                          {transactionTypeLabelVi(tx.type, tx.direction)}
                        </td>
                        <td
                          className={`px-6 py-4 text-sm font-bold ${tx.direction === "debit" ? "text-red-600" : "text-green-600"}`}
                        >
                          {tx.direction === "debit" ? "-" : "+"}
                          {tx.amount}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {tx.description || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-center">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              tx.status === "completed"
                                ? "bg-green-100 text-green-700"
                                : tx.status === "failed"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {transactionStatusLabel(tx.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-4 flex gap-2 justify-center border-t">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 text-sm"
                  >
                    Trang trước
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-600 flex items-center">
                    Trang {page}
                  </span>
                  <button
                    disabled={
                      !history?.items ||
                      history.items.length < (history.limit || 10)
                    }
                    onClick={() => setPage((p) => p + 1)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 text-sm"
                  >
                    Trang sau
                  </button>
                </div>
              </div>
            )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-100 bg-slate-50/90 p-8 text-center text-slate-500">
              Bạn chưa có tài khoản để xem lịch sử giao dịch.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
