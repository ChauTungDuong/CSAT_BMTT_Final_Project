import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import SearchFilter from "./components/SearchFilter";
import LogColumn from "./components/LogColumn";
import type { CryptoActionGroup } from "./types/crypto-log";

// Lấy backend URL từ env hoặc mặc định localhost:3000
const BACKEND_URL =
  (import.meta as any).env.VITE_BACKEND_URL || "http://localhost:3000";

function App() {
  const [allGroups, setAllGroups] = useState<CryptoActionGroup[]>([]);
  const [decryptGroups, setDecryptGroups] = useState<CryptoActionGroup[]>([]);
  const [encryptGroups, setEncryptGroups] = useState<CryptoActionGroup[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(8);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [operationFilter, setOperationFilter] = useState<
    "all" | "encrypt" | "decrypt" | "mixed"
  >("all");
  const [keyword, setKeyword] = useState("");
  const [connected, setConnected] = useState(false);

  // Separate groups into decrypt and encrypt
  const separateGroups = (groups: CryptoActionGroup[]) => {
    const decrypt = groups.filter((g) => g.operation === "decrypt");
    const encrypt = groups.filter((g) => g.operation === "encrypt");
    setDecryptGroups(decrypt);
    setEncryptGroups(encrypt);
  };

  const fetchGroups = async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (operationFilter !== "all") {
      params.set("operation", operationFilter);
    }
    if (keyword.trim()) {
      params.set("keyword", keyword.trim());
    }

    try {
      const res = await fetch(
        `${BACKEND_URL}/api/crypto/groups?${params.toString()}`,
      );
      const data = await res.json();
      setAllGroups(data.items || []);
      separateGroups(data.items || []);
      setTotalPages(data.pages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch groups:", err);
    }
  };

  useEffect(() => {
    const socket: Socket = io(`${BACKEND_URL}/crypto`);

    socket.on("connect", () => {
      setConnected(true);
      console.log("Connected to crypto monitor");
    });

    socket.on("disconnect", () => {
      setConnected(false);
      console.log("Disconnected from crypto monitor");
    });

    socket.on("initialGroups", (initialGroups: CryptoActionGroup[]) => {
      if (page === 1 && operationFilter === "all" && !keyword.trim()) {
        setAllGroups(initialGroups);
        separateGroups(initialGroups);
      }
    });

    socket.on("newGroup", () => {
      fetchGroups().catch(console.error);
    });

    return () => {
      socket.disconnect();
    };
  }, [page, limit, operationFilter, keyword]);

  useEffect(() => {
    fetchGroups().catch(console.error);
  }, [page, limit, operationFilter, keyword]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4">
        <div className="max-w-full mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Theo Dõi Mã Hóa/Giải Mã
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Nhóm log theo từng hành động backend
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm bg-white">
            <span
              className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
            ></span>
            {connected ? "Đã kết nối realtime" : "Mất kết nối"}
          </div>
        </div>
      </header>

      <div className="px-4 md:px-8 py-4 max-w-full mx-auto">
        {/* Search & Filter Card */}
        <SearchFilter
          keyword={keyword}
          onKeywordChange={(value) => {
            setPage(1);
            setKeyword(value);
          }}
          operationFilter={operationFilter}
          onOperationChange={(value) => {
            setPage(1);
            setOperationFilter(value);
          }}
          total={total}
        />

        {/* 2-Column Layout */}
        <div className="grid grid-cols-2 gap-4 mb-6 bg-white border border-slate-200 rounded-xl overflow-hidden min-h-96">
          <LogColumn
            title="Giải Mã (Decrypt)"
            groups={decryptGroups}
            operation="decrypt"
          />
          <LogColumn
            title="Mã Hóa (Encrypt)"
            groups={encryptGroups}
            operation="encrypt"
          />
        </div>

        {/* Pagination */}
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 border border-slate-300 rounded-lg bg-white disabled:opacity-50 hover:bg-slate-50 transition"
          >
            Trang trước
          </button>
          <span className="text-sm text-slate-600 min-w-32 text-center">
            Trang {page}/{totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 border border-slate-300 rounded-lg bg-white disabled:opacity-50 hover:bg-slate-50 transition"
          >
            Trang sau
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
