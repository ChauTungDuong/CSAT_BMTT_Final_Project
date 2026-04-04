import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

interface SystemStats {
  totalUsers: number;
  customers: number;
  admins: number;
  inactive: number;
}

interface UserRow {
  id: string;
  username: string;
  fullName?: string;
  email?: string;
  phone?: string;
  accountNumber?: string;
  cccd?: string;
  dateOfBirth?: string;
  address?: string;
  role: string;
  isActive: boolean;
}

interface PagedUsers {
  items: UserRow[];
  total: number;
}

const roleLabel: Record<string, string> = {
  customer: "Khách hàng",
  admin: "Quản trị viên",
};

type ActionType = "toggle-status";

interface ActionModalState {
  type: ActionType;
  user: UserRow;
  nextIsActive?: boolean;
}

interface FeedbackState {
  type: "success" | "error";
  message: string;
}

const actionConfig: Record<
  ActionType,
  {
    title: string;
    reasonLabel: string;
    submitLabel: string;
    description: string;
  }
> = {
  "toggle-status": {
    title: "Xác nhận khóa/mở khóa tài khoản",
    reasonLabel: "Lý do khóa/mở khóa",
    submitLabel: "Xác nhận",
    description:
      "Thao tác này yêu cầu PIN admin và lý do để ghi nhận đầy đủ vào audit log.",
  },
};

function parseApiMessage(err: any, fallback: string) {
  const msg = err?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  return typeof msg === "string" ? msg : fallback;
}

export function AdminDashboard() {
  const qc = useQueryClient();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [actionModal, setActionModal] = useState<ActionModalState | null>(null);
  const [adminPin, setAdminPin] = useState("");
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const { data: stats } = useQuery<SystemStats>({
    queryKey: ["admin-stats"],
    queryFn: async () => (await api.get("/admin/stats")).data,
  });

  const { data: users } = useQuery<PagedUsers>({
    queryKey: ["admin-users", searchKeyword],
    queryFn: async () =>
      (
        await api.get(
          `/admin/users?page=1&limit=50${
            searchKeyword.trim()
              ? `&q=${encodeURIComponent(searchKeyword.trim())}`
              : ""
          }`,
        )
      ).data,
  });

  const toggleStatus = useMutation({
    mutationFn: ({
      userId,
      isActive,
      adminPin,
      reason,
    }: {
      userId: string;
      isActive: boolean;
      adminPin: string;
      reason: string;
    }) =>
      api.patch(`/admin/users/${userId}/status`, {
        isActive,
        adminPin,
        reason,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const isActionSubmitting = toggleStatus.isPending;

  const activeActionConfig = useMemo(
    () => (actionModal ? actionConfig[actionModal.type] : null),
    [actionModal],
  );

  const openActionModal = (payload: ActionModalState) => {
    setFeedback(null);
    setActionError("");
    setAdminPin("");
    setReason("");
    setActionModal(payload);
  };

  const closeActionModal = () => {
    setActionModal(null);
    setActionError("");
    setAdminPin("");
    setReason("");
  };

  const submitAdminAction = async () => {
    if (!actionModal) return;
    setActionError("");
    setFeedback(null);

    if (!/^\d{6}$/.test(adminPin)) {
      setActionError("PIN admin phải gồm đúng 6 chữ số.");
      return;
    }

    if (!reason.trim()) {
      setActionError("Vui lòng nhập lý do.");
      return;
    }

    try {
      if (actionModal.type === "toggle-status") {
        const res = await toggleStatus.mutateAsync({
          userId: actionModal.user.id,
          isActive: !!actionModal.nextIsActive,
          adminPin,
          reason: reason.trim(),
        });
        const warning = res?.data?.warning as string | undefined;
        setFeedback({
          type: warning ? "error" : "success",
          message:
            warning ??
            (actionModal.nextIsActive
              ? "Đã mở khóa tài khoản thành công."
              : "Đã khóa tài khoản thành công."),
        });
      }

      closeActionModal();
    } catch (err: any) {
      setActionError(parseApiMessage(err, "Không thể thực hiện thao tác."));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100/90 to-gray-50">
      <div className="mx-auto w-full max-w-none px-4 py-6 sm:px-8 sm:py-10 xl:px-12 2xl:px-16">
        <div className="space-y-6 rounded-2xl bg-white p-5 shadow-md sm:p-6 md:p-8 lg:p-10 xl:p-12">
          <nav
            className="flex flex-wrap gap-3"
            aria-label="Điều hướng nhanh quản trị"
          >
            <Link
              to="/admin/audit"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-100 px-5 py-3 text-base font-semibold text-slate-800 shadow-sm transition hover:bg-slate-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Audit log
            </Link>
            <Link
              to="/admin/profile"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-100 px-5 py-3 text-base font-semibold text-slate-800 shadow-sm transition hover:bg-slate-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Hồ sơ của tôi
            </Link>
          </nav>

          {feedback && (
            <div
              className={`rounded-xl border px-4 py-3 text-base ${
                feedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {feedback.message}
            </div>
          )}

          
          <section
            className="space-y-6"
            aria-labelledby="admin-users-heading"
          >
            <div>
              <h2
                id="admin-users-heading"
                className="text-xl font-semibold text-slate-800 sm:text-2xl"
              >
                Quản lý tài khoản
              </h2>
              <p className="mt-2 text-base text-slate-600">
                Kích hoạt và mở khóa tài khoản. Thông tin nhạy cảm hiển thị
                theo chính sách bảo mật của hệ thống.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-9 sm:gap-12 md:grid-cols-4">
              {[
                { label: "Tổng người dùng", value: stats?.totalUsers },
                { label: "Khách hàng", value: stats?.customers },
                { label: "Quản trị viên", value: stats?.admins },
                { label: "Tài khoản khóa", value: stats?.inactive },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-slate-200/70 bg-white px-4 py-4 text-center shadow-md shadow-slate-200/80 ring-1 ring-slate-900/[0.04] sm:px-5 sm:py-5"
                >
                  <p className="text-base font-semibold leading-snug text-slate-600 sm:text-lg md:text-xl">
                    {s.label}
                  </p>
                  <p className="mt-2 text-xl font-bold tabular-nums text-slate-900 sm:mt-2.5 sm:text-2xl">
                    {s.value ?? "…"}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/60 p-5 shadow-sm ring-1 ring-slate-100/60 sm:p-6">
              <div className="mb-4">
                <label
                  htmlFor="admin-user-search"
                  className="text-base font-semibold text-slate-800 sm:text-lg"
                >
                  Tìm kiếm người dùng
                </label>
              </div>
              <div className="relative">
                <span
                  className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400"
                  aria-hidden
                >
                  <svg
                    className="h-5 w-5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </span>
                <input
                  id="admin-user-search"
                  type="search"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="Nhập tên đăng nhập hoặc mã người dùng…"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-200/90 bg-white py-3.5 pl-12 pr-4 text-base text-slate-900 shadow-inner shadow-slate-200/40 transition placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/15 sm:py-4 sm:pl-12 sm:pr-5 sm:text-lg"
                />
              </div>
            </div>

            <div
              className="overflow-hidden rounded-xl bg-slate-100/60 shadow-sm"
              role="region"
              aria-label="Danh sách tài khoản"
            >
            <div className="bg-white">
            <table className="w-full table-fixed text-sm sm:text-[0.9375rem]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-[10%] text-center px-2 py-3.5 font-medium text-gray-600">
                    Tên đăng nhập
                  </th>
                  <th className="w-[10%] text-center px-2 py-3.5 font-medium text-gray-600">
                    Họ tên
                  </th>
                  <th className="w-[10%] text-center px-2 py-3.5 font-medium text-gray-600">
                    Email
                  </th>
                  <th className="w-[calc(60%/7)] text-center px-2 py-3.5 font-medium text-gray-600">
                    SĐT
                  </th>
                  <th className="w-[calc(60%/7)] text-center px-2 py-3.5 font-medium text-gray-600">
                    Số tài khoản
                  </th>
                  <th className="w-[calc(60%/7)] text-center px-2 py-3.5 font-medium text-gray-600">
                    Ngày sinh
                  </th>
                  <th className="w-[calc(60%/7)] text-center px-2 py-3.5 font-medium text-gray-600">
                    CCCD
                  </th>
                  <th className="w-[calc(60%/7)] text-center px-2 py-3.5 font-medium text-gray-600">
                    Địa chỉ
                  </th>
                  <th className="w-[calc(60%/7)] text-center px-2 py-3.5 font-medium text-gray-600">
                    Vai trò
                  </th>
                  <th className="w-[calc(60%/7)] text-center px-2 py-3.5 font-medium text-gray-600">
                    Trạng thái
                  </th>
                  <th className="w-[10%] text-center px-2 py-3.5 font-medium text-gray-600">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users?.items.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-2 py-3.5 text-center align-middle font-mono break-all">
                      {u.username}
                    </td>
                    <td className="px-2 py-3.5 text-center align-middle">
                      {u.fullName ?? (
                        <span className="text-gray-400 italic">--</span>
                      )}
                    </td>
                    <td className="px-2 py-3.5 text-center align-middle font-mono text-gray-500 break-all">
                      {u.email ?? "--"}
                    </td>
                    <td className="px-2 py-3.5 text-center align-middle font-mono text-gray-500 break-all">
                      {u.phone ?? "--"}
                    </td>
                    <td className="px-2 py-3.5 text-center align-middle font-mono text-gray-500 break-all">
                      {u.accountNumber ?? "--"}
                    </td>
                    <td className="px-2 py-3.5 text-center align-middle font-mono text-gray-500">
                      {u.dateOfBirth ?? "--"}
                    </td>
                    <td className="px-2 py-3.5 text-center align-middle font-mono text-gray-500 break-all">
                      {u.cccd ?? "--"}
                    </td>
                    <td className="px-2 py-3.5 text-center align-middle text-gray-500 break-words">
                      {u.address ?? "--"}
                    </td>
                    <td className="px-2 py-3.5 text-center align-middle">
                      <span
                        className={`inline-flex items-center rounded px-2 py-1 text-sm font-medium ${
                          u.role === "admin"
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {roleLabel[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-2 py-3.5 text-center align-middle">
                      <span
                        className={`inline-flex items-center rounded px-2 py-1 text-sm font-medium ${
                          u.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {u.isActive ? "Hoạt động" : "Bị khóa"}
                      </span>
                    </td>
                    <td className="px-2 py-3.5 text-center align-middle">
                      {u.role === "admin" ? (
                        <span className="text-gray-400 italic">--</span>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <button
                            onClick={() =>
                              openActionModal({
                                type: "toggle-status",
                                user: u,
                                nextIsActive: !u.isActive,
                              })
                            }
                            disabled={toggleStatus.isPending}
                            className={`rounded px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                              u.isActive
                                ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                : "bg-green-100 text-green-700 hover:bg-green-200"
                            }`}
                          >
                            {u.isActive ? "Khóa" : "Mở khóa"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!users?.items.length && (
              <p className="py-8 text-center text-base text-slate-400">
                Không có người dùng
              </p>
            )}
            </div>
            </div>
          </section>
        </div>
      </div>

      {actionModal && activeActionConfig && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-200">
            <div className="px-6 py-4 border-b bg-slate-50 rounded-t-2xl">
              <h3 className="text-lg font-semibold text-slate-800">
                {activeActionConfig.title}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Người dùng:{" "}
                <span className="font-medium">{actionModal.user.username}</span>
              </p>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-600">
                {activeActionConfig.description}
              </p>

              <div>
                <label className="block text-sm text-slate-600 mb-1">
                  PIN admin
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={adminPin}
                  onChange={(e) =>
                    setAdminPin(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="Nhập 6 chữ số"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">
                  {activeActionConfig.reasonLabel}
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Mô tả ngắn gọn, rõ ràng"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {actionError && (
                <p className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
                  {actionError}
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={closeActionModal}
                disabled={isActionSubmitting}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={submitAdminAction}
                disabled={isActionSubmitting}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isActionSubmitting
                  ? "Đang xử lý..."
                  : activeActionConfig.submitLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
