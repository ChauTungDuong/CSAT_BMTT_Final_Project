import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "../../api/client";

interface SystemStats {
  totalUsers: number;
  customers: number;
  tellers: number;
  inactive: number;
}

interface UserRow {
  id: string;
  username: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role: string;
  isActive: boolean;
}

interface PagedUsers {
  items: UserRow[];
  total: number;
}

const ROLES = ["customer", "teller", "admin"] as const;
const roleLabel: Record<string, string> = {
  customer: "Kh\u00e1ch h\u00e0ng",
  teller: "Giao d\u1ecbch vi\u00ean",
  admin: "Qu\u1ea3n tr\u1ecb vi\u00ean",
};

type TabType = "accounts" | "roles";

export function AdminDashboard() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("accounts");
  const [roleError, setRoleError] = useState<string | null>(null);

  const { data: stats } = useQuery<SystemStats>({
    queryKey: ["admin-stats"],
    queryFn: async () => (await api.get("/admin/stats")).data,
  });

  const { data: users } = useQuery<PagedUsers>({
    queryKey: ["admin-users"],
    queryFn: async () => (await api.get("/admin/users?page=1&limit=50")).data,
  });

  const toggleStatus = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      api.patch(`/admin/users/${userId}/status`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(`/admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      setRoleError(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: any) => {
      setRoleError(err?.response?.data?.message ?? "Không thể đổi vai trò");
    },
  });

  const deleteUser = useMutation({
    mutationFn: (userId: string) => api.delete(`/admin/users/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (err: any) => {
      alert(err?.response?.data?.message ?? "Không thể xoá người dùng");
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Warning banner */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <span className="text-red-500 text-xl">🔒</span>
          <p className="text-sm text-red-700">
            <strong>Quản trị viên:</strong> Bạn thấy thông tin định danh đã che
            giấu một phần. <strong>KHÔNG thể xem dữ liệu tài chính</strong> của
            khách hàng. Mọi thao tác đều được ghi nhật ký.
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Tổng người dùng", value: stats?.totalUsers },
            { label: "Khách hàng", value: stats?.customers },
            { label: "Nhân viên", value: stats?.tellers },
            { label: "Tài khoản khóa", value: stats?.inactive },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-xl shadow-sm p-5 text-center"
            >
              <p className="text-3xl font-bold text-gray-800">
                {s.value ?? "\u2026"}
              </p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Quick nav */}
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

        {/* Tabs container */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab("accounts")}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === "accounts"
                  ? "border-b-2 border-blue-600 text-blue-600 bg-blue-50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              🔐 Quản lý tài khoản
            </button>
            <button
              onClick={() => setActiveTab("roles")}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === "roles"
                  ? "border-b-2 border-purple-600 text-purple-600 bg-purple-50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              🛡️ Phân quyền vai trò
            </button>
          </div>

          {/* Account management tab */}
          {activeTab === "accounts" && (
            <div>
              <div className="px-6 py-4 border-b bg-blue-50">
                <h2 className="font-semibold text-gray-800">
                  Quản lý trạng thái tài khoản
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Kích hoạt, khóa hoặc xóa tài khoản người dùng
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
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              u.role === "admin"
                                ? "bg-red-100 text-red-700"
                                : u.role === "teller"
                                  ? "bg-yellow-100 text-yellow-700"
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
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                toggleStatus.mutate({
                                  userId: u.id,
                                  isActive: !u.isActive,
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
                              onClick={() => {
                                if (
                                  confirm(`Xóa người dùng "${u.username}"?`)
                                ) {
                                  deleteUser.mutate(u.id);
                                }
                              }}
                              disabled={deleteUser.isPending}
                              className="px-3 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                            >
                              Xóa
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
          )}

          {/* Roles tab */}
          {activeTab === "roles" && (
            <div>
              <div className="px-6 py-4 border-b bg-purple-50">
                <h2 className="font-semibold text-gray-800">
                  Phân quyền vai trò
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Thay đổi vai trò của người dùng trong hệ thống
                </p>
              </div>
              {roleError && (
                <div className="mx-6 mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  ⚠️ {roleError}
                </div>
              )}
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
                        Vai trò hiện tại
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">
                        Thay đổi vai trò
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
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              u.role === "admin"
                                ? "bg-red-100 text-red-700"
                                : u.role === "teller"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-green-100 text-green-700"
                            }`}
                          >
                            {roleLabel[u.role] ?? u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            defaultValue={u.role}
                            onChange={(e) =>
                              changeRole.mutate({
                                userId: u.id,
                                role: e.target.value,
                              })
                            }
                            disabled={changeRole.isPending}
                            className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {roleLabel[r]}
                              </option>
                            ))}
                          </select>
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
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
