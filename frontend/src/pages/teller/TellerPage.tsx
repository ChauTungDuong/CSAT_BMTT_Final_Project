import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { MaskedField } from "../../components/common/MaskedField";
import type { Customer } from "../../types";

interface SearchResult {
  id: string;
  fullName: string;
  email: string;
}

interface TellerCustomer extends Customer {
  balanceRange?: string;
}

export function TellerPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [selected, setSelected] = useState<TellerCustomer | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const { data: allCustomers = [] } = useQuery<SearchResult[]>({
    queryKey: ["teller-all-customers"],
    queryFn: async () => (await api.get("/teller/customers")).data,
  });

  const search = async () => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    setSearchError("");
    setSelected(null);
    try {
      const { data } = await api.get<SearchResult[]>(
        `/teller/search?q=${encodeURIComponent(query)}`,
      );
      setResults(data);
      if (data.length === 0) setSearchError("Không tìm thấy khách hàng.");
    } catch {
      setSearchError("Lỗi khi tìm kiếm.");
    } finally {
      setLoading(false);
    }
  };

  // Customers to show in the list: search results if a search was done, otherwise all
  const displayedList = results ?? allCustomers;

  const viewCustomer = async (id: string) => {
    try {
      const { data } = await api.get<TellerCustomer>(`/teller/customers/${id}`);
      setSelected(data);
    } catch {
      setSearchError("Không thể tải thông tin khách hàng.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Cảnh báo quyền */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <span className="text-orange-500 text-xl">⚠️</span>
          <div className="flex-1">
            <p className="font-medium text-orange-800">
              Quyền truy cập Nhân viên Giao dịch
            </p>
            <p className="text-sm text-orange-600">
              Bạn chỉ thấy thông tin cần thiết cho nghiệp vụ. Dữ liệu nhạy cảm
              đã được che giấu. Mọi tra cứu đều được ghi lại trong hệ thống.
            </p>
          </div>
          <Link
            to="/teller/profile"
            className="text-sm text-orange-700 border border-orange-300 px-3 py-1 rounded-lg hover:bg-orange-100 whitespace-nowrap"
          >
            👤 Hồ sơ của tôi
          </Link>
        </div>

        {/* Tìm kiếm */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="font-semibold mb-4">Tra cứu khách hàng</h2>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Tên khách hàng hoặc email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={search}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Đang tìm…" : "Tìm kiếm"}
            </button>
          </div>

          {searchError && (
            <p className="mt-3 text-sm text-gray-500">{searchError}</p>
          )}

          {displayedList.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-400 mb-2">
                {results
                  ? `Kết quả tìm kiếm: ${results.length} khách hàng`
                  : `Tất cả khách hàng (${allCustomers.length})`}
              </p>
              <div className="divide-y border rounded-lg overflow-hidden">
                {displayedList.map((r) => (
                  <div
                    key={r.id}
                    className="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{r.fullName}</p>
                      <p className="text-sm text-gray-500">{r.email}</p>
                    </div>
                    <button
                      onClick={() => viewCustomer(r.id)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Xem chi tiết
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chi tiết khách hàng */}
        {selected && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Thông tin khách hàng</h2>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                Đã được che giấu theo quyền Teller
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-6">
              <MaskedField
                label="Họ và tên"
                value={selected.fullName}
                isMasked={false}
              />
              <MaskedField
                label="Email"
                value={selected.email}
                isMasked={true}
              />
              <MaskedField
                label="Số điện thoại"
                value={selected.phone}
                isMasked={true}
              />
              <MaskedField
                label="Ngày sinh (năm)"
                value={selected.dateOfBirth}
                isMasked={true}
              />
              <MaskedField label="CCCD" value={selected.cccd} isMasked={true} />
              <MaskedField
                label="Số dư (ước tính)"
                value={selected.balanceRange}
                isMasked={true}
              />
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

export default TellerPage;
