import { useRef, useState, KeyboardEvent } from "react";
import api from "../../api/client";

interface PinModalProps {
  customerId?: string;
  title?: string;
  onSuccess: (payload?: any) => void;
  onClose: () => void;
  onConfirm?: (pin: string) => Promise<void>;
}

export function PinModal({
  customerId: _customerId,
  title = "Xác thực PIN",
  onSuccess,
  onClose,
  onConfirm,
}: PinModalProps) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [helper, setHelper] = useState(
    "Nhập mã PIN 6 số để tiếp tục. Bạn có tối đa 5 lần thử.",
  );
  const [locked, setLocked] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    if (locked) return;
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError("");
    if (value && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    if (locked) return;
    const pin = digits.join("");
    if (pin.length < 6) return;
    setIsLoading(true);
    setError("");
    try {
      let payload: any = undefined;
      if (onConfirm) {
        await onConfirm(pin);
      } else {
        const res = await api.post("/customers/me/verify-pin", { pin });
        payload = res.data;
      }
      onSuccess(payload);
    } catch (err: any) {
      const payload = err?.response?.data;
      const message =
        typeof payload?.message === "string"
          ? payload.message
          : "PIN không đúng. Vui lòng thử lại.";
      const remaining =
        typeof payload?.remainingAttempts === "number"
          ? payload.remainingAttempts
          : undefined;
      const isLocked = !!payload?.locked || /bị khóa/i.test(message);

      if (isLocked) {
        setLocked(true);
        setError("Tài khoản đã bị khóa vì nhập sai PIN quá 5 lần.");
        setHelper("Vui lòng liên hệ quản trị viên để được mở khóa tài khoản.");
      } else {
        setError(message);
        if (typeof remaining === "number") {
          setHelper(
            `Bạn còn ${remaining} lần thử trước khi bị khóa tài khoản.`,
          );
        }
        setDigits(Array(6).fill(""));
        setTimeout(() => inputs.current[0]?.focus(), 50);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-[380px] max-w-[92vw]">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">
          {title}
        </h2>
        <p className="text-xs text-gray-500 text-center mb-5">{helper}</p>

        <div className="flex gap-2 justify-center mb-4">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              type="password"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={locked}
              className="w-10 h-12 text-center text-xl border-2 border-gray-300 rounded focus:border-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
            />
          ))}
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center mb-3">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            {locked ? "Đóng" : "Hủy"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={locked || digits.join("").length < 6 || isLoading}
            className="flex-1 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "Đang xác thực…" : "Xác nhận"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PinModal;
