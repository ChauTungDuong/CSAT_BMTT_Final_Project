import type { ReactNode } from "react";

/** Ô nhập không viền riêng — viền do khung OutlinedFormControl quản lý. */
export const outlinedInputClassName =
  "w-full border-0 bg-transparent p-0 text-base text-gray-900 outline-none focus:ring-0 placeholder:text-gray-400";

export const outlinedSelectClassName = `${outlinedInputClassName} cursor-pointer bg-transparent`;

type OutlinedFormControlProps = {
  id: string;
  /** Mặc định trùng `id` — dùng khi cần gắn nhãn với control khác (vd. radio đầu tiên). */
  labelForId?: string;
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Kiểu outlined: nhãn nằm trên đường viền (nền trùng màu thẻ).
 */
export function OutlinedFormControl({
  id,
  labelForId,
  label,
  required,
  children,
  className = "",
}: OutlinedFormControlProps) {
  const forId = labelForId ?? id;

  return (
    <div className={className}>
      <div className="relative rounded-lg border border-gray-300 bg-white px-3 pb-2.5 pt-5 transition-shadow focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500">
        <label
          htmlFor={forId}
          className="absolute left-2.5 top-0 z-10 -translate-y-1/2 bg-white px-1.5 text-base font-medium leading-tight text-gray-700"
        >
          {label}
          {required ? (
            <span className="text-red-500 ml-0.5" aria-hidden>
              *
            </span>
          ) : null}
        </label>
        <div className="pt-0.5">{children}</div>
      </div>
    </div>
  );
}
