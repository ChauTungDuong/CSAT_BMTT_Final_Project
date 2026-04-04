import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/client";
import { MaskedField } from "../../components/common/MaskedField";
import { PinModal } from "../../components/common/PinModal";
import type { Account, Customer } from "../../types";
import { accountTypeLabel } from "../../utils/accountLabels";

function formatAccountDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function HeroSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl bg-blue-600 p-6 sm:p-7">
      <div className="h-10 w-3/4 max-w-md rounded-lg bg-white/30" />
      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 rounded-xl border border-white/40 bg-white/90 shadow-md" />
        ))}
      </div>
    </div>
  );
}

function AccountCardsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6"
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-stretch md:gap-8">
            <div className="flex min-h-0 min-w-0 flex-col gap-1.5 md:h-full">
              <div className="flex min-h-11 w-full items-center justify-between gap-2">
                <div className="h-3 w-28 rounded bg-slate-200" />
                <div className="h-7 w-20 shrink-0 rounded-full bg-slate-200" />
              </div>
              <div className="min-h-16 w-full flex-1 rounded-xl border border-slate-100 bg-slate-100" />
            </div>
            <div className="flex min-h-0 min-w-0 flex-col gap-1.5 md:h-full">
              <div className="flex min-h-11 items-center">
                <div className="h-3 w-36 rounded bg-slate-200" />
              </div>
              <div className="min-h-16 w-full flex-1 rounded-xl border border-slate-100 bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-100 bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <div className="mb-4 h-6 w-48 rounded bg-slate-200" />
      <div className="space-y-4 rounded-xl bg-slate-50 p-4">
        <div className="h-4 w-32 rounded bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-12 rounded-lg bg-slate-200" />
          <div className="h-12 rounded-lg bg-slate-200" />
        </div>
      </div>
    </div>
  );
}

const quickActions = [
  {
    to: "/transfer",
    label: "Chuyển tiền",
    primary: true,
    outline: false,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    to: "/history",
    label: "Lịch sử",
    primary: false,
    outline: false,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    to: "/cards",
    label: "Thẻ",
    primary: false,
    outline: false,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
  {
    to: "/profile",
    label: "Hồ sơ",
    primary: false,
    outline: true,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
] as const;

export function DashboardPage() {
  const navigate = useNavigate();
  const [showPinModal, setShowPinModal] = useState(false);
  const [viewToken, setViewToken] = useState<string | null>(null);
  const [showBalance, setShowBalance] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: profile, isPending: profilePending } = useQuery<Customer>({
    queryKey: ["my-profile", viewToken],
    queryFn: async () =>
      (
        await api.get("/customers/me", {
          params: viewToken ? { viewToken } : undefined,
        })
      ).data,
  });

  const { data: accounts, isPending: accountsPending } = useQuery<Account[]>({
    queryKey: ["my-accounts", viewToken],
    queryFn: async () => (await api.get("/accounts/me")).data,
  });

  const handlePinSuccess = (payload?: { viewToken?: string }) => {
    if (payload?.viewToken) {
      setViewToken(payload.viewToken);
    }
    setShowPinModal(false);
  };

  const pinVerified = !!profile?.isPinVerified;

  const copyAccountNumber = useCallback(async (accountId: string, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    try {
      await navigator.clipboard.writeText(digits);
      setCopiedId(accountId);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (profile && profile.hasPin === false) {
      navigate("/pin-setup", { replace: true });
    }
  }, [profile, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100/90 to-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {profilePending && !profile ? (
          <HeroSkeleton />
        ) : (
          <section className="relative mb-8 overflow-hidden rounded-2xl bg-blue-600 px-5 py-6 text-white shadow-lg shadow-blue-600/30 ring-1 ring-white/10 sm:px-7 sm:py-7">
            <div className="relative">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Xin chào
                {profile?.fullName ? `, ${profile.fullName}` : ""}
              </h1>

              <nav
                className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3"
                aria-label="Thao tác nhanh"
              >
                {quickActions.map(({ to, label, primary, outline, icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`flex min-h-[3rem] items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-center text-sm font-semibold shadow-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600 ${
                      outline
                        ? "border-2 border-blue-200/90 bg-white text-blue-800 hover:border-blue-300 hover:bg-blue-50"
                        : primary
                          ? "bg-white text-blue-800 shadow-lg shadow-blue-950/20 ring-2 ring-white/90 hover:bg-blue-50"
                          : "border border-slate-200/90 bg-white text-blue-800 hover:border-slate-300 hover:bg-slate-50 hover:shadow-lg"
                    }`}
                  >
                    <span className="shrink-0 opacity-95">{icon}</span>
                    <span className="leading-tight">{label}</span>
                  </Link>
                ))}
              </nav>
            </div>
          </section>
        )}

        <section className="mb-8" aria-label="Danh sách tài khoản">
          {accountsPending && !accounts ? (
            <AccountCardsSkeleton />
          ) : (
            <div className="grid gap-5">
              {accounts?.map((acc) => (
                <article
                  key={acc.id}
                  className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-6"
                >
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-stretch md:gap-8">
                    <div className="flex min-h-0 min-w-0 flex-col gap-1.5 md:h-full">
                      <div className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Số tài khoản
                        </p>
                        <span
                          className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                            acc.accountType === "saving"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-sky-100 text-sky-800"
                          }`}
                        >
                          {accountTypeLabel(acc.accountType)}
                        </span>
                      </div>
                      <div className="flex w-full min-w-0 flex-1 flex-col justify-center rounded-xl border border-slate-100 bg-slate-50/90 p-4 sm:p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-base font-semibold tracking-wide text-slate-900 sm:text-lg">
                            {formatAccountDisplay(acc.accountNumber)}
                          </p>
                          <button
                            type="button"
                            onClick={() => copyAccountNumber(acc.id, acc.accountNumber)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                            </svg>
                            {copiedId === acc.id ? "Đã chép" : "Sao chép"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex min-h-0 min-w-0 flex-col gap-1.5 md:h-full">
                      <div className="flex min-h-11 items-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Số dư khả dụng
                        </p>
                      </div>
                      <div className="flex min-h-0 w-full flex-1 flex-col justify-center rounded-xl border border-slate-100 bg-slate-50/90 p-4 sm:p-5">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <p className="min-w-0 flex-1 text-left text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
                            {showBalance[acc.id]
                              ? acc.balance
                              : (acc.balanceMasked ?? "••••••")}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setShowBalance((prev) => ({
                                ...prev,
                                [acc.id]: !prev[acc.id],
                              }))
                            }
                            className="inline-flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-200/80 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            aria-pressed={!!showBalance[acc.id]}
                            aria-label={showBalance[acc.id] ? "Ẩn số dư" : "Hiện số dư"}
                          >
                            {showBalance[acc.id] ? (
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.954-.138 2.865-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.774 3.162 10.066 7.5a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m0 0a3 3 0 104.243 4.243m-4.243-4.243L9.88 9.88" />
                              </svg>
                            ) : (
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                            {showBalance[acc.id] ? "Ẩn số dư" : "Hiện số dư"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}

              {accounts && accounts.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-6 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v17.25c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125v-9.75m-8.25-3v9.75c0 .621.504 1.125 1.125 1.125h9.75" />
                    </svg>
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-700">Chưa có tài khoản</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Khi có tài khoản gắn với hồ sơ, thông tin sẽ hiển thị tại đây.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {profilePending && !profile ? (
          <ProfileSkeleton />
        ) : (
          <section
            className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:p-7"
            aria-labelledby="profile-heading"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="profile-heading" className="text-lg font-semibold text-slate-800">
                  Thông tin cá nhân
                </h2>
              </div>
              {!pinVerified && (
                <button
                  type="button"
                  onClick={() => setShowPinModal(true)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H3v-4.875l6.75-6.75a1.875 1.875 0 011.563-.43c.356.061.698.098 1.029.11a6 6 0 01-1.11-3.75" />
                  </svg>
                  Xem chi tiết
                </button>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-slate-700">Thông tin cơ bản</h3>
              <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1 md:grid-cols-2">
                <MaskedField label="Họ và tên" value={profile?.fullName} isMasked={false} />
                <MaskedField label="Ngày sinh" value={profile?.dateOfBirth} isMasked={false} />
                <div className="md:col-span-2">
                  <MaskedField label="Địa chỉ" value={profile?.address} isMasked={false} />
                </div>
              </dl>
            </div>

            <div className="mt-4 rounded-xl border border-amber-200/90 bg-amber-50/70 p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-amber-900">Thông tin nhạy cảm</h3>
              <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1 md:grid-cols-2">
                <MaskedField label="Email" value={profile?.email} isMasked={!profile?.isPinVerified} />
                <MaskedField label="Số điện thoại" value={profile?.phone} isMasked={!profile?.isPinVerified} />
                <MaskedField label="CCCD" value={profile?.cccd} isMasked={!profile?.isPinVerified} />
              </dl>
            </div>
          </section>
        )}
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
