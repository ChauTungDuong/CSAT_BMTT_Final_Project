// TypeScript interfaces for crypto logging - mirrored from backend
export interface CryptoStepEntry {
  id: string;
  timestamp: Date;
  actionId: string;
  userId?: string;
  actionName: string;
  operation: "encrypt" | "decrypt";

  // Layer & step info
  layer: string; // HMAC, AES-256, DB, ECB, etc.
  step?: string; // SubBytes, ShiftRows, MixColumns, AddRoundKey
  round?: number; // AES round number

  // Input/Output
  input: string;
  output: string;

  iv?: string;
  tag?: string;
  authTag?: string; // 'true' or 'false' string
  hmac?: string;
  keySnippet?: string;
  status: "success" | "failure";
}

export interface CryptoActionGroup {
  id: string;
  actionName: string;
  operation: "encrypt" | "decrypt" | "mixed";
  status: "success" | "failure";
  startedAt: Date;
  updatedAt: Date;
  steps: CryptoStepEntry[];
}

export interface CryptoLogResponse {
  items: CryptoActionGroup[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}
