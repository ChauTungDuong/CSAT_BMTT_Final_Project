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

  /** Tỷ lệ cột (%); dùng cho <colgroup> để trình duyệt áp dụng ổn định */
  const auditTableColumns = [
    { label: "Thời gian", widthPct: 15 },
    { label: "Loại sự kiện", widthPct: 15 },
    { label: "User ID", widthPct: 12 },
    { label: "Target ID", widthPct: 12 },
    { label: "IP", widthPct: 12 },
    { label: "Chi tiết", widthPct: 34 },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100/90 to-gray-50">
      <div className="mx-auto w-full max-w-none px-4 py-6 sm:px-8 sm:py-10 xl:px-12 2xl:px-16">
        <div className="space-y-6 rounded-2xl bg-white p-5 shadow-md sm:p-6 md:p-8 lg:p-10 xl:p-12">
          <nav
            className="flex flex-wrap gap-3"
            aria-label="Điều hướng nhanh quản trị"
          >
            <Link
              to="/admin"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-100 px-5 py-3 text-base font-semibold text-slate-800 shadow-sm transition hover:bg-slate-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Quản lý tài khoản
            </Link>
            <Link
              to="/admin/profile"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-100 px-5 py-3 text-base font-semibold text-slate-800 shadow-sm transition hover:bg-slate-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Hồ sơ của tôi
            </Link>
          </nav>

          <header>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
              Audit log
            </h1>
            <p className="mt-2 text-base text-slate-500">
              Theo dõi sự kiện hệ thống theo thời gian và loại thao tác.
            </p>
          </header>

          <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/60 p-5 shadow-sm ring-1 ring-slate-100/60 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="audit-event-type"
                  className="text-base font-semibold text-slate-800 sm:text-lg"
                >
                  Lọc theo loại sự kiện
                </label>
                <p className="mt-1 text-sm text-slate-500 sm:text-base">
                  Chọn một loại để thu hẹp danh sách, hoặc &quot;Tất cả&quot; để
                  xem toàn bộ.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  id="audit-event-type"
                  value={eventType}
                  onChange={(e) => {
                    setEventType(e.target.value);
                    setPage(1);
                  }}
                  className="min-w-[12rem] rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-base text-slate-900 shadow-inner shadow-slate-200/40 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/15 sm:min-w-[14rem] sm:text-lg"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t || "Tất cả"}
                    </option>
                  ))}
                </select>
                {isFetching && (
                  <span className="text-base text-slate-400">Đang tải…</span>
                )}
              </div>
            </div>
          </div>

          <div
            className="overflow-hidden rounded-xl bg-slate-100/60 shadow-sm"
            role="region"
            aria-label="Bảng audit log"
          >
            <div className="w-full min-w-0 overflow-x-auto bg-white">
              <table className="w-full min-w-[720px] table-fixed border-collapse text-sm sm:min-w-full sm:text-[0.9375rem]">
                <colgroup>
                  {auditTableColumns.map((col) => (
                    <col
                      key={col.label}
                      style={{ width: `${col.widthPct}%` }}
                    />
                  ))}
                </colgroup>
                <thead className="border-b bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-600 sm:text-sm">
                  <tr>
                    {auditTableColumns.map((col) => (
                      <th
                        key={col.label}
                        className={`px-3 py-3.5 text-left sm:px-4 ${
                          col.label === "Chi tiết" ? "" : "whitespace-nowrap"
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.items?.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-gray-600 sm:px-4 sm:text-sm">
                        {new Date(log.createdAt).toLocaleString("vi-VN")}
                      </td>
                      <td className="px-3 py-3 sm:px-4">
                        <span
                          className={`inline-flex max-w-full truncate rounded px-2 py-1 text-xs font-medium sm:text-sm ${
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
                      <td className="truncate px-3 py-3 font-mono text-xs text-gray-500 sm:px-4 sm:text-sm">
                        {log.userId ?? "—"}
                      </td>
                      <td className="truncate px-3 py-3 font-mono text-xs text-gray-500 sm:px-4 sm:text-sm">
                        {log.targetId ?? "—"}
                      </td>
                      <td className="truncate px-3 py-3 font-mono text-xs text-gray-500 sm:px-4 sm:text-sm">
                        {log.ipAddress ?? "—"}
                      </td>
                      <td className="min-w-0 truncate px-3 py-3 text-left text-xs text-gray-500 sm:px-4 sm:text-sm">
                        {log.detail ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-slate-100 pt-2 text-base text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:pt-4">
            <span className="font-medium text-slate-700">
              Tổng: {data?.total ?? 0} bản ghi
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹ Trước
              </button>
              <span className="px-2 py-2 text-slate-600">
                Trang {page}/{totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sau ›
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
