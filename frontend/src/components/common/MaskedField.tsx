interface MaskedFieldProps {
  label: string;
  value: string | undefined;
  isMasked?: boolean;
}

export function MaskedField({ label, value, isMasked }: MaskedFieldProps) {
  const masked =
    isMasked ??
    (!value ||
      value.includes("*") ||
      value.includes("•") ||
      value === "••••••");

  return (
    <div className="py-2">
      <dt className="text-xs text-gray-500 font-medium uppercase tracking-wide">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-sm ${
          masked ? "font-mono text-gray-400 tracking-widest" : "text-gray-900"
        }`}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}

export default MaskedField;
