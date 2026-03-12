import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { MaskedField } from "../../components/common/MaskedField";
import { PinModal } from "../../components/common/PinModal";
import type { Account, Customer } from "../../types";

export function DashboardPage() {
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);

  const { data: profile } = useQuery<Customer>({
    queryKey: ["my-profile", pinVerified],
    queryFn: async () =>
      (await api.get(`/customers/me${pinVerified ? "?pinVerified=true" : ""}`))
        .data,
  });

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["my-accounts", pinVerified],
    queryFn: async () =>
      (await api.get(`/accounts/me${pinVerified ? "?pinVerified=true" : ""}`))
        .data,
  });

  const handlePinSuccess = () => {
    setPinVerified(true);
    setShowPinModal(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white mb-6">
          <h1 className="text-2xl font-bold">Xin chào, {profile?.fullName}</h1>
          <p className="text-blue-200 text-sm mt-1">
            {pinVerified
              ? "🔓 Đang xem thông tin đầy đủ"
              : "🔒 Thông tin đang được bảo vệ"}
          </p>
          <div className="flex gap-3 mt-4">
            <Link
              to="/transfer"
              className="bg-white text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50"
            >
              Chuyển tiền
            </Link>
            <Link
              to="/profile"
              className="border border-white text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              Hồ sơ
            </Link>
          </div>
        </div>

        {/* Tài khoản */}
        <div className="grid gap-4 mb-6">
          {accounts?.map((acc) => (
            <div key={acc.id} className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">
                    Số tài khoản
                  </p>
                  <p className="font-mono font-semibold">{acc.accountNumber}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium
                  ${
                    acc.accountType === "saving"
                      ? "bg-green-100 text-green-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {acc.accountType === "saving" ? "Tiết kiệm" : "Thanh toán"}
                </span>
              </div>

              {/* Số dư */}
              <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Số dư khả dụng</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">
                    {pinVerified
                      ? acc.balance
                      : (acc.balanceMasked ?? "••••••")}
                  </p>
                </div>
                {!pinVerified && (
                  <button
                    onClick={() => setShowPinModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                  >
                    🔑 Xem số dư
                  </button>
                )}
              </div>
            </div>
          ))}

          {accounts?.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
              Bạn chưa có tài khoản nào.
            </div>
          )}
        </div>

        {/* Thông tin cá nhân */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Thông tin cá nhân</h2>
            {!pinVerified && (
              <button
                onClick={() => setShowPinModal(true)}
                className="text-sm text-blue-600 hover:underline"
              >
                🔑 Nhập PIN để xem đầy đủ
              </button>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-6">
            <MaskedField
              label="Họ và tên"
              value={profile?.fullName}
              isMasked={false}
            />
            <MaskedField
              label="Email"
              value={profile?.email}
              isMasked={!pinVerified}
            />
            <MaskedField
              label="Số điện thoại"
              value={profile?.phone}
              isMasked={!pinVerified}
            />
            <MaskedField
              label="CCCD"
              value={profile?.cccd}
              isMasked={!pinVerified}
            />
            <MaskedField
              label="Ngày sinh"
              value={profile?.dateOfBirth}
              isMasked={!pinVerified}
            />
            <MaskedField
              label="Địa chỉ"
              value={profile?.address}
              isMasked={!pinVerified}
            />
          </dl>
        </div>
      </div>

      {showPinModal && (
        <PinModal
          customerId={profile?.id}
          onSuccess={handlePinSuccess}
          onClose={() => setShowPinModal(false)}
        />
      )}
    </div>
  );
}

export default DashboardPage;
