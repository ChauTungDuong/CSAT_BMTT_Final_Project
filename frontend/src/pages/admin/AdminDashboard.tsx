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

type ActionType = "toggle-status" | "reset-password";

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
  "reset-password": {
    title: "Reset mật khẩu người dùng",
    reasonLabel: "Lý do reset mật khẩu",
    submitLabel: "Reset mật khẩu",
    description:
      "Hệ thống sẽ tạo mật khẩu tạm thời, gửi email và buộc người dùng đổi mật khẩu ở lần đăng nhập kế tiếp.",
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

  const resetPassword = useMutation({
    mutationFn: ({
      userId,
      adminPin,
      reason,
    }: {
      userId: string;
      adminPin: string;
      reason: string;
    }) =>
      api.post(`/admin/users/${userId}/reset-password`, { adminPin, reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const isActionSubmitting = toggleStatus.isPending || resetPassword.isPending;

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
    if (isActionSubmitting) return;
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

      if (actionModal.type === "reset-password") {
        const res = await resetPassword.mutateAsync({
          userId: actionModal.user.id,
          adminPin,
          reason: reason.trim(),
        });
        setFeedback({
          type: "success",
          message:
            res?.data?.message ??
            "Đã reset mật khẩu và gửi mật khẩu tạm thời qua email người dùng.",
        });
      }

      closeActionModal();
    } catch (err: any) {
      setActionError(parseApiMessage(err, "Không thể thực hiện thao tác."));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full px-4 lg:px-6 py-8">
        {feedback && (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {feedback.message}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Tổng người dùng", value: stats?.totalUsers },
            { label: "Khách hàng", value: stats?.customers },
            { label: "Quản trị viên", value: stats?.admins },
            { label: "Tài khoản khóa", value: stats?.inactive },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-xl shadow-sm p-5 text-center"
            >
              <p className="text-3xl font-bold text-gray-800">
                {s.value ?? "..."}
              </p>
              <p className="text-base text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mb-6">
          <Link
            to="/admin/audit"
            className="bg-white border border-gray-200 px-4 py-2 rounded-lg text-base hover:bg-gray-50 shadow-sm"
          >
            📋 Xem Audit Log
          </Link>
          <Link
            to="/admin/profile"
            className="bg-white border border-gray-200 px-4 py-2 rounded-lg text-base hover:bg-gray-50 shadow-sm"
          >
            👤 Hồ sơ của tôi
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-blue-50">
            <h2 className="font-semibold text-xl text-gray-800">
              Quản lý tài khoản
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Kích hoạt, khóa hoặc reset mật khẩu tài khoản. Thông tin nhạy cảm
              hiển thị theo chính sách bảo mật của hệ thống.
            </p>
            <div className="mt-3">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm theo tên đăng nhập hoặc mã người dùng"
                className="w-full md:w-[420px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <table className="w-full table-fixed text-[12.5px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-[10%] text-left px-2 py-3 font-medium text-gray-600">
                    Tên đăng nhập
                  </th>
                  <th className="w-[8%] text-left px-2 py-3 font-medium text-gray-600">
                    Họ tên
                  </th>
                  <th className="w-[15%] text-left px-2 py-3 font-medium text-gray-600">
                    Email
                  </th>
                  <th className="w-[7%] text-left px-2 py-3 font-medium text-gray-600">
                    SĐT
                  </th>
                  <th className="w-[8%] text-left px-2 py-3 font-medium text-gray-600">
                    Số tài khoản
                  </th>
                  <th className="w-[7%] text-left px-2 py-3 font-medium text-gray-600">
                    Ngày sinh
                  </th>
                  <th className="w-[8%] text-left px-2 py-3 font-medium text-gray-600">
                    CCCD
                  </th>
                  <th className="w-[8%] text-left px-2 py-3 font-medium text-gray-600">
                    Địa chỉ
                  </th>
                  <th className="w-[6%] text-left px-2 py-3 font-medium text-gray-600">
                    Vai trò
                  </th>
                  <th className="w-[6%] text-left px-2 py-3 font-medium text-gray-600">
                    Trạng thái
                  </th>
                  <th className="w-[17%] text-left px-2 py-3 font-medium text-gray-600">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users?.items.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-2 py-3 font-mono break-all">
                      {u.username}
                    </td>
                    <td className="px-2 py-3">
                      {u.fullName ?? (
                        <span className="text-gray-400 italic">--</span>
                      )}
                    </td>
                    <td className="px-2 py-3 font-mono text-gray-500 break-all">
                      {u.email ?? "--"}
                    </td>
                    <td className="px-2 py-3 font-mono text-gray-500 break-all">
                      {u.phone ?? "--"}
                    </td>
                    <td className="px-2 py-3 font-mono text-gray-500 break-all">
                      {u.accountNumber ?? "--"}
                    </td>
                    <td className="px-2 py-3 font-mono text-gray-500">
                      {u.dateOfBirth ?? "--"}
                    </td>
                    <td className="px-2 py-3 font-mono text-gray-500 break-all">
                      {u.cccd ?? "--"}
                    </td>
                    <td className="px-2 py-3 text-gray-500 break-words">
                      {u.address ?? "--"}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[12.5px] font-medium ${
                          u.role === "admin"
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {roleLabel[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[12.5px] font-medium ${
                          u.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {u.isActive ? "Hoạt động" : "Bị khóa"}
                      </span>
                    </td>
                    <td className="px-2 py-3 align-top">
                      {u.role === "admin" ? (
                        <span className="text-gray-400 italic">--</span>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() =>
                              openActionModal({
                                type: "toggle-status",
                                user: u,
                                nextIsActive: !u.isActive,
                              })
                            }
                            disabled={toggleStatus.isPending}
                            className={`w-full px-2 py-1.5 rounded text-[12.5px] font-medium transition-colors whitespace-nowrap ${
                              u.isActive
                                ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                : "bg-green-100 text-green-700 hover:bg-green-200"
                            }`}
                          >
                            {u.isActive ? "Khóa" : "Mở khóa"}
                          </button>
                          <button
                            onClick={() =>
                              openActionModal({
                                type: "reset-password",
                                user: u,
                              })
                            }
                            disabled={resetPassword.isPending}
                            className="w-full px-2 py-1.5 rounded text-[12.5px] font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors whitespace-nowrap"
                          >
                            Reset mật khẩu
                          </button>
                          {/* Temporarily hidden by security policy */}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!users?.items.length && (
              <p className="text-center text-gray-400 py-8">
                Không có người dùng
              </p>
            )}
          </div>
        </div>
      </div>

      {actionModal && activeActionConfig && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
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
