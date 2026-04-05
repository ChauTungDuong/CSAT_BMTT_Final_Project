import { Link } from "react-router-dom";

type Props = {
  className?: string;
};

/** Link về dashboard; nhãn « Quay lại », hỗ trợ chuột giữa và focus ring. */
export function BackToDashboardLink({ className = "" }: Props) {
  return (
    <Link
      to="/dashboard"
      className={`group inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${className}`}
    >
      <svg
        className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:-translate-x-0.5 group-hover:text-slate-700"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
        />
      </svg>
      <span>Quay lại</span>
    </Link>
  );
}
