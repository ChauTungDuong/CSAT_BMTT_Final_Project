interface SearchFilterProps {
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  operationFilter: "all" | "encrypt" | "decrypt" | "mixed";
  onOperationChange: (
    operation: "all" | "encrypt" | "decrypt" | "mixed",
  ) => void;
  total: number;
  onClear: () => Promise<void>;
}

export default function SearchFilter({
  keyword,
  onKeywordChange,
  operationFilter,
  onOperationChange,
  total,
  onClear,
}: SearchFilterProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4 mb-4 grid md:grid-cols-3 gap-3">
      <input
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        placeholder="Tìm theo hành động/nội dung..."
        className="border border-slate-300 rounded-lg px-3 py-2"
      />
      <select
        value={operationFilter}
        onChange={(e) => onOperationChange(e.target.value as any)}
        className="border border-slate-300 rounded-lg px-3 py-2"
      >
        <option value="all">Tất cả hành động</option>
        <option value="encrypt">Mã hóa</option>
        <option value="decrypt">Giải mã</option>
        <option value="mixed">Hỗn hợp</option>
      </select>
      <div className="text-sm text-slate-600 flex items-center justify-start md:justify-end gap-3">
        <span>Tổng: {total} nhóm log</span>
        <button
          onClick={() => onClear().catch(console.error)}
          className="px-3 py-2 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50"
        >
          Xóa log
        </button>
      </div>
    </section>
  );
}
