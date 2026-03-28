import { useEffect, useRef } from "react";
import LogEntry from "./LogEntry";
import type { CryptoActionGroup } from "../types/crypto-log";

interface LogColumnProps {
  title: string; // 'Giải Mã' | 'Mã Hóa'
  groups: CryptoActionGroup[];
  operation: "encrypt" | "decrypt";
}

export default function LogColumn({
  title,
  groups,
  operation,
}: LogColumnProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [groups]);

  // Flatten all steps from all groups
  const allLogs = groups.flatMap((group) =>
    group.steps
      .filter((step) => step.operation === operation)
      .map((step) => ({
        ...step,
        groupId: group.id,
      })),
  );

  return (
    <div className="flex flex-col h-full min-h-0 border border-gray-200 rounded-lg bg-white">
      {/* Column Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        <p className="text-xs text-gray-500 mt-1">{allLogs.length} bước log</p>
      </div>

      {/* Scrollable Log Container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto bg-white"
      >
        {allLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            <p>Chưa có log {operation === "encrypt" ? "mã hóa" : "giải mã"}</p>
          </div>
        ) : (
          <div>
            {allLogs.map((log) => (
              <LogEntry key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
