import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import type { Account, Transaction } from "../../types";

export function TransactionHistoryPage() {
  const navigate = useNavigate();
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
    <div className="min-h-screen bg-gray-50 relative">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-blue-600 hover:underline text-sm"
            >
              ← Quay lại
            </button>
            <h1 className="text-xl font-bold text-gray-800">
              Lịch sử giao dịch
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tài khoản hiện tại
          </label>
          <div className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-700 text-sm">
            {currentAccount
              ? `${currentAccount.accountNumber} (${currentAccount.accountType})`
              : "Không tìm thấy tài khoản"}
          </div>
        </div>

        {currentAccountId ? (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
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
                        <td className="px-6 py-4 text-sm font-medium text-gray-800 capitalize">
                          {tx.type === "transfer"
                            ? tx.direction === "debit"
                              ? "Chuyển đi"
                              : "Nhận tiền"
                            : tx.type}
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
                            {tx.status}
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
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
            Bạn chưa có tài khoản để xem lịch sử giao dịch.
          </div>
        )}
      </div>
    </div>
  );
}

export default TransactionHistoryPage;
