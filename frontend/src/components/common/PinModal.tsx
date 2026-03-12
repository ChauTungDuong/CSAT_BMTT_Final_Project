import { useRef, useState, KeyboardEvent } from "react";
import api from "../../api/client";

interface PinModalProps {
  customerId?: string;
  title?: string;
  onSuccess: () => void;
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
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
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
    const pin = digits.join("");
    if (pin.length < 6) return;
    setIsLoading(true);
    setError("");
    try {
      if (onConfirm) {
        await onConfirm(pin);
      } else {
        await api.post("/customers/me/verify-pin", { pin });
      }
      onSuccess();
    } catch {
      setError("PIN không đúng. Vui lòng thử lại.");
      setDigits(Array(6).fill(""));
      setTimeout(() => inputs.current[0]?.focus(), 50);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-80">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">
          {title}
        </h2>

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
              className="w-10 h-12 text-center text-xl border-2 border-gray-300 rounded focus:border-blue-500 outline-none"
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
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={digits.join("").length < 6 || isLoading}
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
