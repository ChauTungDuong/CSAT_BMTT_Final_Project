import type { CryptoStepEntry } from "../types/crypto-log";

interface LogEntryProps {
  log: CryptoStepEntry;
}

export default function LogEntry({ log }: LogEntryProps) {
  const timeStr = new Date(log.timestamp).toLocaleTimeString("vi-VN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });

  // Build layer/step/round string
  let layerStr = `<${log.layer}`;
  if (log.step) {
    layerStr += ` ${log.step}`;
  }
  if (log.round !== undefined) {
    layerStr += ` Round ${log.round}`;
  }
  layerStr += ">";

  const statusIcon = log.status === "success" ? "✓" : "✗";
  const statusColor =
    log.status === "success" ? "text-green-600" : "text-red-600";

  return (
    <div className="border-b border-gray-200 p-3 text-sm bg-white hover:bg-gray-50 transition">
      <div className="flex items-start gap-2 mb-1">
        <span className="font-mono text-xs text-gray-500 flex-shrink-0">
          [{log.userId || "N/A"}]
        </span>
        <span className="font-mono text-xs text-gray-400 flex-shrink-0">
          [{timeStr}]
        </span>
        <span className={`font-semibold text-xs ${statusColor} flex-shrink-0`}>
          {statusIcon}
        </span>
      </div>

      <div className="text-gray-700 font-mono text-xs mb-1">{layerStr}</div>

      <div className="text-gray-600 text-xs space-y-1">
        <div>
          <span className="font-semibold">Input:</span>{" "}
          <span className="text-gray-700 break-all">{log.input}</span>
        </div>

        {log.keySnippet && (
          <div>
            <span className="font-semibold">Key:</span>{" "}
            <span className="text-gray-700 break-all">{log.keySnippet}</span>
          </div>
        )}

        <div>
          <span className="font-semibold">Output:</span>{" "}
          <span className="text-gray-700 break-all">{log.output}</span>
        </div>

        {log.authTag && (
          <div>
            <span className="font-semibold">Auth:</span>{" "}
            <span
              className={
                log.authTag === "true" ? "text-green-600" : "text-red-600"
              }
            >
              {log.authTag === "true" ? "Verified" : "Failed"}
            </span>
          </div>
        )}

        {log.tag && (
          <div>
            <span className="font-semibold">Tag:</span>{" "}
            <span className="text-gray-700 break-all">{log.tag}</span>
          </div>
        )}
      </div>
    </div>
  );
}
