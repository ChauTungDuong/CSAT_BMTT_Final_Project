import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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

type ActionType = "toggle-status" | "reset-password" | "view-details";

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
  "view-details": {
    title: "Mở phiên xem thông tin nhạy cảm",
    reasonLabel: "Lý do xem thông tin",
    submitLabel: "Mở phiên xem",
    description:
      "Phiên xem chỉ tồn tại 2 phút. Toàn bộ thao tác mở/đóng phiên đều được ghi audit.",
  },
};

function parseApiMessage(err: any, fallback: string) {
  const msg = err?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  return typeof msg === "string" ? msg : fallback;
}

export function AdminDashboard() {
  const qc = useQueryClient();
  const [actionModal, setActionModal] = useState<ActionModalState | null>(null);
  const [adminPin, setAdminPin] = useState("");
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [viewDetails, setViewDetails] = useState<{
    userId: string;
    username: string;
    email: string;
    phone: string;
    cccd: string;
    dateOfBirth: string;
    address: string;
    viewToken: string;
    expiresAt: string;
  } | null>(null);

  const { data: stats } = useQuery<SystemStats>({
    queryKey: ["admin-stats"],
    queryFn: async () => (await api.get("/admin/stats")).data,
  });

  const { data: users } = useQuery<PagedUsers>({
    queryKey: ["admin-users"],
    queryFn: async () => (await api.get("/admin/users?page=1&limit=50")).data,
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

  const openSensitiveView = useMutation({
    mutationFn: ({
      userId,
      adminPin,
      reason,
    }: {
      userId: string;
      adminPin: string;
      reason: string;
    }) => api.post(`/admin/users/${userId}/view-details`, { adminPin, reason }),
  });

  const isActionSubmitting =
    toggleStatus.isPending ||
    resetPassword.isPending ||
    openSensitiveView.isPending;

  const activeActionConfig = useMemo(
    () => (actionModal ? actionConfig[actionModal.type] : null),
    [actionModal],
  );

  useEffect(() => {
    if (!viewDetails) return;
    const remain = new Date(viewDetails.expiresAt).getTime() - Date.now();
    if (remain <= 0) {
      setViewDetails(null);
      return;
    }

    const timer = setTimeout(() => {
      api
        .post("/admin/view-sessions/close", {
          viewToken: viewDetails.viewToken,
        })
        .catch(() => undefined);
      setViewDetails(null);
    }, remain);

    return () => clearTimeout(timer);
  }, [viewDetails]);

  const closeViewModal = async () => {
    if (viewDetails?.viewToken) {
      await api
        .post("/admin/view-sessions/close", {
          viewToken: viewDetails.viewToken,
        })
        .catch(() => undefined);
    }
    setViewDetails(null);
  };

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
        await toggleStatus.mutateAsync({
          userId: actionModal.user.id,
          isActive: !!actionModal.nextIsActive,
          adminPin,
          reason: reason.trim(),
        });
        setFeedback({
          type: "success",
          message: actionModal.nextIsActive
            ? "Đã mở khóa tài khoản thành công."
            : "Đã khóa tài khoản thành công.",
        });
      }

      if (actionModal.type === "reset-password") {
        await resetPassword.mutateAsync({
          userId: actionModal.user.id,
          adminPin,
          reason: reason.trim(),
        });
        setFeedback({
          type: "success",
          message:
            "Đã reset mật khẩu và gửi mật khẩu tạm thời qua email người dùng.",
        });
      }

      if (actionModal.type === "view-details") {
        const res = await openSensitiveView.mutateAsync({
          userId: actionModal.user.id,
          adminPin,
          reason: reason.trim(),
        });

        setViewDetails({
          userId: actionModal.user.id,
          username: actionModal.user.username,
          email: res.data.details.email,
          phone: res.data.details.phone,
          cccd: res.data.details.cccd,
          dateOfBirth: res.data.details.dateOfBirth,
          address: res.data.details.address,
          viewToken: res.data.viewToken,
          expiresAt: res.data.expiresAt,
        });
      }

      closeActionModal();
    } catch (err: any) {
      setActionError(parseApiMessage(err, "Không thể thực hiện thao tác."));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
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
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mb-6">
          <Link
            to="/admin/audit"
            className="bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 shadow-sm"
          >
            📋 Xem Audit Log
          </Link>
          <Link
            to="/admin/profile"
            className="bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 shadow-sm"
          >
            👤 Hồ sơ của tôi
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-blue-50">
            <h2 className="font-semibold text-gray-800">Quản lý tài khoản</h2>
            <p className="text-xs text-gray-500 mt-1">
              Kích hoạt, khóa hoặc xóa tài khoản. Thông tin CCCD, ngày sinh, địa
              chỉ được hiển thị ở mức đã che.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Tên đăng nhập
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Họ tên
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Email (đã che)
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    SĐT (đã che)
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Ngày sinh (đã che)
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    CCCD (đã che)
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Địa chỉ (đã che)
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Vai trò
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Trạng thái
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users?.items.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">
                      {u.username}
                    </td>
                    <td className="px-4 py-3">
                      {u.fullName ?? (
                        <span className="text-gray-400 italic">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {u.email ?? "--"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {u.phone ?? "--"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {u.dateOfBirth ?? "--"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {u.cccd ?? "--"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[220px] truncate">
                      {u.address ?? "--"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          u.role === "admin"
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {roleLabel[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          u.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {u.isActive ? "Hoạt động" : "Bị khóa"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() =>
                            openActionModal({
                              type: "toggle-status",
                              user: u,
                              nextIsActive: !u.isActive,
                            })
                          }
                          disabled={toggleStatus.isPending}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
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
                          className="px-3 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                        >
                          Reset mật khẩu
                        </button>
                        <button
                          onClick={() =>
                            openActionModal({
                              type: "view-details",
                              user: u,
                            })
                          }
                          disabled={openSensitiveView.isPending}
                          className="px-3 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                        >
                          Xem chi tiết
                        </button>
                      </div>
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

      {viewDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b">
              <h3 className="text-lg font-semibold text-gray-800">
                Hồ sơ chi tiết người dùng: {viewDetails.username}
              </h3>
              <button
                onClick={closeViewModal}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Đóng
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Email
                </p>
                <p className="mt-1 font-medium text-slate-800 break-all">
                  {viewDetails.email}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Số điện thoại
                </p>
                <p className="mt-1 font-medium text-slate-800">
                  {viewDetails.phone}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  CCCD
                </p>
                <p className="mt-1 font-medium text-slate-800">
                  {viewDetails.cccd}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Ngày sinh
                </p>
                <p className="mt-1 font-medium text-slate-800">
                  {viewDetails.dateOfBirth}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 md:col-span-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Địa chỉ
                </p>
                <p className="mt-1 font-medium text-slate-800">
                  {viewDetails.address}
                </p>
              </div>
            </div>

            <p className="px-6 pb-6 text-xs text-amber-600">
              Phiên xem tự đóng sau 2 phút hoặc khi bạn bấm Đóng.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
