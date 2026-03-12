import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "../../api/client";
import type { AuditLog } from "../../types";

interface PagedLogs {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState("");
  const limit = 20;

  const { data, isFetching } = useQuery<PagedLogs>({
    queryKey: ["audit-logs", page, eventType],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (eventType) params.set("eventType", eventType);
      return (await api.get(`/admin/audit-logs?${params}`)).data;
    },
    keepPreviousData: true,
  } as Parameters<typeof useQuery<PagedLogs>>[0]);

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  const EVENT_TYPES = [
    "",
    "LOGIN_SUCCESS",
    "LOGIN_FAIL",
    "REGISTER",
    "PROFILE_VIEW",
    "PIN_VERIFY_SUCCESS",
    "PIN_VERIFY_FAIL",
    "TRANSFER",
    "ADMIN_ACTION",
    "API_ACCESS",
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/admin" className="text-blue-600 hover:underline text-sm">
            ← Quay lại
          </Link>
          <h1 className="text-xl font-bold text-gray-800">Nhật ký kiểm toán</h1>
        </div>

        {/* Bộ lọc */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex gap-3 items-center">
          <label className="text-sm font-medium text-gray-600">
            Loại sự kiện:
          </label>
          <select
            value={eventType}
            onChange={(e) => {
              setEventType(e.target.value);
              setPage(1);
            }}
            className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t || "Tất cả"}
              </option>
            ))}
          </select>
          {isFetching && (
            <span className="text-sm text-gray-400 ml-2">Đang tải…</span>
          )}
        </div>

        {/* Bảng */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  {[
                    "Thời gian",
                    "Loại sự kiện",
                    "User ID",
                    "Target ID",
                    "IP",
                    "Chi tiết",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.items?.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500 font-mono text-xs">
                      {new Date(log.createdAt).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          log.eventType.includes("FAIL")
                            ? "bg-red-100 text-red-700"
                            : log.eventType.includes("SUCCESS") ||
                                log.eventType === "REGISTER"
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {log.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">
                      {log.userId ?? "—"}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">
                      {log.targetId ?? "—"}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">
                      {log.ipAddress ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500 max-w-xs truncate">
                      {log.detail ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Phân trang */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Tổng: {data?.total ?? 0} bản ghi</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-50"
            >
              ‹ Trước
            </button>
            <span className="px-3 py-1">
              Trang {page}/{totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-50"
            >
              Sau ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuditPage;
