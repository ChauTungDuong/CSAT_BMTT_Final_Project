import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/client";
import { MaskedField } from "../../components/common/MaskedField";
import { PinModal } from "../../components/common/PinModal";
import type { Account, Customer } from "../../types";

export function DashboardPage() {
  const navigate = useNavigate();
  const [showPinModal, setShowPinModal] = useState(false);
  const [viewToken, setViewToken] = useState<string | null>(null);
  const [showBalance, setShowBalance] = useState<Record<string, boolean>>({});

  const { data: profile } = useQuery<Customer>({
    queryKey: ["my-profile", viewToken],
    queryFn: async () =>
      (
        await api.get("/customers/me", {
          params: viewToken ? { viewToken } : undefined,
        })
      ).data,
  });

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["my-accounts", viewToken],
    queryFn: async () => (await api.get("/accounts/me")).data,
  });

  const handlePinSuccess = (payload?: any) => {
    if (payload?.viewToken) {
      setViewToken(payload.viewToken);
    }
    setShowPinModal(false);
  };

  const pinVerified = !!profile?.isPinVerified;

  useEffect(() => {
    if (profile && profile.hasPin === false) {
      navigate("/pin-setup", { replace: true });
    }
  }, [profile, navigate]);

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
              to="/history"
              className="bg-white text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50"
            >
              Lịch sử
            </Link>
            <Link
              to="/cards"
              className="bg-white text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50"
            >
              Thẻ của tôi
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
                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-bold text-gray-800 mt-1">
                      {showBalance[acc.id]
                        ? acc.balance
                        : (acc.balanceMasked ?? "••••••")}
                    </p>
                    <button
                      onClick={() =>
                        setShowBalance((prev) => ({
                          ...prev,
                          [acc.id]: !prev[acc.id],
                        }))
                      }
                      className="text-gray-400 hover:text-gray-600 mt-1"
                      title={showBalance[acc.id] ? "Ẩn số dư" : "Hiện số dư"}
                    >
                      {showBalance[acc.id] ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.954-.138 2.865-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.774 3.162 10.066 7.5a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m0 0a3 3 0 104.243 4.243m-4.243-4.243L9.88 9.88"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
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
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                🔑 Xem chi tiết
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
              isMasked={!profile?.isPinVerified}
            />
            <MaskedField
              label="Số điện thoại"
              value={profile?.phone}
              isMasked={!profile?.isPinVerified}
            />
            <MaskedField
              label="CCCD"
              value={profile?.cccd}
              isMasked={!profile?.isPinVerified}
            />
            <MaskedField
              label="Ngày sinh"
              value={profile?.dateOfBirth}
              isMasked={!profile?.isPinVerified}
            />
            <MaskedField
              label="Địa chỉ"
              value={profile?.address}
              isMasked={!profile?.isPinVerified}
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
