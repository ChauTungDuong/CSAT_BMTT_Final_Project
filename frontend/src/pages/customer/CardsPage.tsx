import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../api/client";
import { BackToDashboardLink } from "../../components/common/BackToDashboardLink";
import { PinModal } from "../../components/common/PinModal";
import type { Account, Card } from "../../types";

export function CardsPage() {
  const queryClient = useQueryClient();
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinAction, setPinAction] = useState<"create" | "reveal" | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showRevealModal, setShowRevealModal] = useState(false);
  const [revealedCard, setRevealedCard] = useState<{
    cardNumber: string;
    cvv: string;
    expiry: string;
  } | null>(null);

  useEffect(() => {
    if (!showRevealModal || !revealedCard) return;
    const timer = setTimeout(
      () => {
        setShowRevealModal(false);
        setRevealedCard(null);
      },
      2 * 60 * 1000,
    );

    return () => clearTimeout(timer);
  }, [showRevealModal, revealedCard]);

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["my-accounts"],
    queryFn: async () => (await api.get("/accounts/me")).data,
  });

  const { data: cards, isLoading } = useQuery<Card[]>({
    queryKey: ["my-cards"],
    queryFn: async () => (await api.get("/cards/me")).data,
  });

  const createCardMutation = useMutation({
    mutationFn: async ({
      accountId,
      pin,
    }: {
      accountId: string;
      pin: string;
    }) => api.post("/cards", { accountId, pin }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-cards"] });
      setShowPinModal(false);
      setPinAction(null);
    },
  });

  const revealCardMutation = useMutation({
    mutationFn: async ({ cardId, pin }: { cardId: string; pin: string }) =>
      (await api.post(`/cards/${cardId}/reveal`, { pin })).data,
    onSuccess: (data) => {
      setRevealedCard(data);
      setShowPinModal(false);
      setShowRevealModal(true);
      setPinAction(null);
    },
  });

  const handleCreateClick = () => {
    if (!accounts || accounts.length === 0) return;
    setPinAction("create");
    setShowPinModal(true);
  };

  const handleRevealClick = (cardId: string) => {
    setSelectedCardId(cardId);
    setPinAction("reveal");
    setShowPinModal(true);
  };

  const handlePinConfirm = async (pin: string) => {
    if (pinAction === "create") {
      await createCardMutation.mutateAsync({
        accountId: accounts![0].id, // Mặc định tài khoản đầu tiên
        pin,
      });
    } else if (pinAction === "reveal" && selectedCardId) {
      await revealCardMutation.mutateAsync({
        cardId: selectedCardId,
        pin,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100/90 to-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="space-y-8 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6 md:p-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <BackToDashboardLink className="mb-3" />
              <h1 className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">
                Thẻ của tôi
              </h1>
            </div>
            {(cards?.length ?? 0) < 1 && (
              <button
                type="button"
                onClick={handleCreateClick}
                className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
              >
                + Mở thẻ mới
              </button>
            )}
          </header>

          {isLoading ? (
            <div className="py-16 text-center text-slate-500">
              Đang tải danh sách thẻ...
            </div>
          ) : cards?.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 p-12 text-center">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-10 h-10 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-800">
              Chưa có thẻ ảo
            </h3>
            <p className="mx-auto mb-6 max-w-sm text-slate-600">
              Mỗi người dùng chỉ có 1 thẻ đang hoạt động để giảm rủi ro lộ thông
              tin khi giao dịch trực tuyến.
            </p>
            <button
              onClick={handleCreateClick}
              className="bg-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-blue-700 transition"
            >
              Mở thẻ ngay
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {cards?.map((card) => (
              <div
                key={card.id}
                className="relative bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-xl overflow-hidden h-56 flex flex-col justify-between"
              >
                {/* Chip & Logo */}
                <div className="flex justify-between items-start">
                  <div className="w-12 h-9 bg-yellow-400/80 rounded-md shadow-inner relative overflow-hidden">
                    <div className="absolute inset-0 border border-black/10 grid grid-cols-2">
                      <div className="border-r border-b border-black/10"></div>
                      <div className="border-b border-black/10"></div>
                      <div className="border-r border-black/10"></div>
                      <div></div>
                    </div>
                  </div>
                  <div className="italic font-black text-xl tracking-tighter opacity-80">
                    BANK DEMO
                  </div>
                </div>

                {/* Card Number */}
                <div className="relative mt-4">
                  <p className="text-xs text-blue-100 mb-1 uppercase tracking-widest opacity-70">
                    Card Number
                  </p>
                  <p className="text-2xl font-mono tracking-[0.2em] font-semibold drop-shadow-md">
                    {card.cardNumber}
                  </p>
                </div>

                {/* Bottom section */}
                <div className="flex justify-between items-end">
                  <div className="flex gap-8">
                    <div>
                      <p className="text-[10px] text-blue-100 uppercase opacity-70">
                        Expiry
                      </p>
                      <p className="font-mono text-sm">{card.expiry}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-blue-100 uppercase opacity-70">
                        CVV
                      </p>
                      <p className="font-mono text-sm">***</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRevealClick(card.id)}
                    className="relative z-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-lg text-xs font-medium transition"
                  >
                    Xem chi tiết
                  </button>
                </div>

                {/* Decorative circles */}
                <div className="pointer-events-none absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
              </div>
            ))}
          </div>
        )}

          <div className="flex gap-4 rounded-xl border border-blue-100 bg-blue-50/90 p-5 text-sm text-blue-900 sm:p-6">
            <div className="mt-0.5 text-2xl">💡</div>
            <div>
              <h4 className="mb-1 font-bold text-blue-950">Lưu ý bảo mật</h4>
              <p className="text-blue-900/90">
                Tuyệt đối không chia sẻ số thẻ, mã CVV và mã PIN cho bất kỳ ai.
                Nhân viên ngân hàng sẽ không bao giờ yêu cầu bạn cung cấp những
                thông tin này.
              </p>
            </div>
          </div>
        </div>
      </div>

      {showPinModal && (
        <PinModal
          title={
            pinAction === "create"
              ? "Xác nhận mở thẻ"
              : "Xác nhận để xem chi tiết"
          }
          onSuccess={() => {}} // Mutations handles visibility
          onClose={() => {
            setShowPinModal(false);
            setPinAction(null);
          }}
          onConfirm={handlePinConfirm}
        />
      )}

      {showRevealModal && revealedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Thông tin thẻ
            </h3>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500">Số thẻ</p>
                <p className="font-mono text-lg tracking-wider text-gray-900">
                  {revealedCard.cardNumber.match(/.{1,4}/g)?.join(" ")}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500">Ngày hết hạn</p>
                  <p className="font-mono text-gray-900">
                    {revealedCard.expiry}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">CVV</p>
                  <p className="font-mono text-gray-900">{revealedCard.cvv}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowRevealModal(false);
                  setRevealedCard(null);
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Đóng
              </button>
            </div>
            <p className="mt-3 text-xs text-amber-600">
              Thông tin thẻ sẽ tự ẩn sau 2 phút.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default CardsPage;
