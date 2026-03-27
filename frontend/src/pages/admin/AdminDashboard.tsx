import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function AdminDashboard() {
  const qc = useQueryClient();

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

  const deleteUser = useMutation({
    mutationFn: (userId: string) => api.delete(`/admin/users/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (err: any) => {
      alert(err?.response?.data?.message ?? "Không thể xóa người dùng");
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
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
                            if (confirm(`Xóa người dùng "${u.username}"?`)) {
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
      </div>
    </div>
  );
}

export default AdminDashboard;
