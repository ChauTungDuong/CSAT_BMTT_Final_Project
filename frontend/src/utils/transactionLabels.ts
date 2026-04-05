import type { Transaction } from "../types";

const TYPE_VI: Record<string, string> = {
  deposit: "Nạp tiền",
  withdrawal: "Rút tiền",
  payment: "Thanh toán",
  transfer_out: "Chuyển đi",
  transfer_in: "Nhận tiền",
  fee: "Phí giao dịch",
  refund: "Hoàn tiền",
  interest: "Lãi",
  adjustment: "Điều chỉnh số dư",
};

/**
 * Nhãn cột "Loại giao dịch" — map mã API / DB sang tiếng Việt.
 * `transfer` phân nhánh theo `direction` (debit/credit).
 */
export function transactionTypeLabelVi(
  type: string,
  direction: Transaction["direction"],
): string {
  const t = type.trim().toLowerCase();
  if (t === "transfer") {
    return direction === "debit" ? "Chuyển đi" : "Nhận tiền";
  }
  return TYPE_VI[t] ?? "Giao dịch khác";
}
