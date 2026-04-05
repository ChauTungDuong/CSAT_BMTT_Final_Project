/** Mã ACCOUNT_TYPE từ API/DB → nhãn tiếng Việt */
export function accountTypeLabel(accountType: string): string {
  const map: Record<string, string> = {
    saving: "Tiết kiệm",
    checking: "Thanh toán",
    credit: "Tín dụng",
  };
  return map[accountType] ?? accountType;
}
