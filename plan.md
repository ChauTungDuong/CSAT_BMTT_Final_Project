# Kế Hoạch Refactor: Chuyển Tiền & Monitor Mã Hóa

## 📋 **Tóm Tắt Yêu Cầu**

### **Yêu Cầu 1: Sửa Chuyển Tiền**

- Mặc định chọn tài khoản hiện tại (thay vì dropdown)
- Mỗi user chỉ có 1 số tài khoản → không cần chọn
- Auto-select first account khi page load

### **Yêu Cầu 2: Redesign Monitor Page**

- Layout 2 cột: phía trái = Giải mã (Decrypt), phía phải = Mã hóa (Encrypt)
- Log format mới chi tiết: `[ID] [Thời gian] <Tầng><Bước><Round> Input/Output/Key/Tag`
- Tầng: HMAC, AES-256, DB, etc.
- Bước: subBytes, shiftRows, mixColumns, addRoundKey (chỉ AES)
- Round: số vòng hiện tại
- Mỗi log lưu thời gian để track
- Hiển thị tiếng Việt có dấu

---

## 🎯 **Danh Sách File Cần Sửa/Tạo**

### **Phase 1: Transfer Page (Nhanh)**

| File                                           | Loại | Mục đích                             |
| ---------------------------------------------- | ---- | ------------------------------------ |
| `frontend/src/pages/customer/TransferPage.tsx` | Edit | Auto-select account, remove dropdown |

**Thay đổi cụ thể:**

- Thêm `useEffect` hook để auto-select first account từ `accounts[0].id`
- Thay dropdown `<select>` bằng `<div>` display-only hiển thị `accounts[0].accountNumber (accounts[0].accountType)`
- Giữ form logic cũ không thay đổi

---

### **Phase 2: Crypto Log Infrastructure (Foundation)**

| #   | File                                                          | Loại          | Mục đích                                               |
| --- | ------------------------------------------------------------- | ------------- | ------------------------------------------------------ |
| 2   | `backend/src/crypto/interfaces/crypto.interface.ts`           | Edit          | Thêm fields (userId, layer, step, round, input/output) |
| 3   | `backend/src/crypto/services/crypto-log.service.ts`           | Edit          | Cập nhật CryptoStepEntry structure + userId tracking   |
| 4   | `backend/src/crypto/services/crypto-trace-context.service.ts` | Edit (nếu có) | Thêm getUserId() method                                |

**New CryptoStepEntry Structure:**

```typescript
interface CryptoStepEntry {
  id: string; // Random 7-char ID
  timestamp: Date; // Auto-generated
  actionId: string; // Groups related steps
  userId?: string; // NEW: User ID for operation
  actionName: string; // description
  operation: "encrypt" | "decrypt";

  // NEW: Detailed layer & step info
  layer: string; // 'HMAC', 'AES-256', 'DB', 'ECB', etc.
  step?: string; // subBytes, shiftRows, mixColumns, addRoundKey
  round?: number; // vòng hiện tại (AES chỉ)

  // RENAMED: plaintext/ciphertext → input/output
  input: string; // plaintext (encrypt lần đầu) hoặc encrypted (các bước sau)
  output: string; // encrypted (encrypt) hoặc plaintext (decrypt cuối)

  iv?: string; // base64
  tag?: string; // GCM auth tag
  authTag?: string; // NEW: Auth verification result (true/false)
  hmac?: string; // HMAC value nếu có
  keySnippet?: string; // Partial key
  status: "success" | "failure";
}
```

---

### **Phase 3: Enhanced AES Logging (Complexity)**

| #   | File                                         | Loại | Mục đích                               |
| --- | -------------------------------------------- | ---- | -------------------------------------- |
| 5   | `backend/src/crypto/services/aes.service.ts` | Edit | Log chi tiết từng AES step             |
| 6   | `backend/src/crypto/aes-gcm/index.ts`        | Edit | Export logging functions cho từng step |

**Đối với encrypt:**

- Log input plaintext + round 0
- Log sau SubBytes → output (still encrypted state)
- Log sau ShiftRows
- Log sau MixColumns
- Log sau AddRoundKey (= end of round)
- Lặp lại cho round 1-13, final round 14 không có MixColumns

**Đối với decrypt:**

- Log input encrypted
- Verify HMAC → log đúng/sai
- Log unencrypted (giải mã từng bước)
- Log output plaintext khi hoàn thành

---

### **Phase 4: Monitor Page Redesign (UI)**

| #   | File                                      | Loại    | Mục đích                                      |
| --- | ----------------------------------------- | ------- | --------------------------------------------- |
| 7   | `monitor/src/App.tsx`                     | Rewrite | Main layout 2 cột + state management          |
| 8   | `monitor/src/components/Header.tsx`       | Edit    | Title "Theo Dõi Mã Hóa/Giải Mã" + Status      |
| 9   | `monitor/src/components/SearchFilter.tsx` | Edit    | Tiếng Việt labels + filter by layer/operation |
| 10  | `monitor/src/components/LogColumn.tsx`    | Create  | Reusable column container (L/R)               |
| 11  | `monitor/src/components/LogEntry.tsx`     | Create  | Single log renderer (new format)              |
| 12  | `monitor/src/components/Pagination.tsx`   | Edit    | Next/Prev buttons                             |
| 13  | `monitor/src/types/crypto-log.ts`         | Create  | TypeScript interfaces mirrored from backend   |

**App Layout Structure:**

```
┌─────────────────────────────────────────────────┐
│  Header: "Theo Dõi Mã Hóa/Giải Mã" | ● Connected │
├──────────────────┬──────────────────────────────┤
│                  │                              │
│  GIẢI MÃ (L)     │  MÃ HÓA (R)                 │
│  Decrypt Logs    │  Encrypt Logs              │
│  Scroll: auto    │  Scroll: auto              │
│                  │                              │
│  [Log Entry]     │  [Log Entry]               │
│  [Log Entry]     │  [Log Entry]               │
│  [...]           │  [...]                     │
│                  │                              │
├──────────────────┼──────────────────────────────┤
│ Search | Filter (Full Width)     │ Page Info    │
└──────────────────┴──────────────────────────────┘
```

**LogEntry Display Format:**

```
[user-id] [14:32:15.487]
<AES-256 Round 1> SubBytes
Input: 63761d7a... (encrypted)
Output: 7c778915... (encrypted)
Key: abcd...
```

Or for completion:

```
[user-id] [14:32:18.123]
<AES-256>
Input: 63761d7a... (encrypted)
Output: plaintext_result
Status: ✓ Success
```

---

## 🔧 **Thực Hiện Chi Tiết**

### **Step 1: TransferPage.tsx**

```typescript
// ADD: useEffect import
import { useEffect } from "react";

// ADD: useEffect hook after useQuery
useEffect(() => {
  if (accounts && accounts.length > 0 && !form.fromAccountId) {
    setForm((prev) => ({ ...prev, fromAccountId: accounts[0].id }));
  }
}, [accounts, form.fromAccountId]);

// REPLACE: Dropdown section
// OLD:
// <select value={form.fromAccountId} ...>
//   <option value="">— Chọn tài khoản —</option>
//   {accounts?.map((a) => (...))}
// </select>

// NEW:
<div className="w-full border rounded-lg px-3 py-2 bg-gray-100 text-gray-700">
  {accounts?.[0]?.accountNumber} ({accounts?.[0]?.accountType})
</div>
```

---

### **Step 2: Crypto Interfaces**

**File: `backend/src/crypto/interfaces/crypto.interface.ts`**

Replace CryptoStepEntry interface:

```typescript
export interface CryptoStepEntry {
  id: string;
  timestamp: Date;
  actionId: string;
  userId?: string; // NEW
  actionName: string;
  operation: "encrypt" | "decrypt";
  layer: string; // NEW: HMAC, AES-256, DB
  step?: string; // NEW: SubBytes, ShiftRows, etc
  round?: number; // NEW: Round number
  input: string; // CHANGED: was plaintext
  output: string; // CHANGED: was ciphertext
  iv?: string;
  tag?: string;
  authTag?: string; // NEW
  hmac?: string;
  keySnippet?: string;
  status: "success" | "failure";
}
```

---

### **Step 3: CryptoLogService**

**File: `backend/src/crypto/services/crypto-log.service.ts`**

Update `addLog()` signature and internal tracking:

```typescript
addLog(entry: Omit<CryptoStepEntry, 'id' | 'timestamp'>) {
  // Entry will have userId optionally from trace context
  const log: CryptoStepEntry = {
    id: generateId(7),
    timestamp: new Date(),
    ...entry,
  };

  // Group by actionId
  if (!this.logs.has(entry.actionId)) {
    this.logs.set(entry.actionId, {
      id: entry.actionId,
      actionName: entry.actionName,
      operation: entry.operation,
      status: entry.status,
      startedAt: log.timestamp,
      updatedAt: log.timestamp,
      steps: [],
    });
  }

  const group = this.logs.get(entry.actionId)!;
  group.steps.push(log);
  group.updatedAt = log.timestamp;

  this.logSubject.next(group);
}
```

---

### **Step 4: AES Service Enhanced Logging**

**File: `backend/src/crypto/services/aes.service.ts`**

For encrypt, add detailed round logging in `encryptBlock()` equivalent:

```typescript
async encrypt(plaintext: string): Promise<CellValue> {
  const actionId = ...; // existing
  const userId = this.traceContext.getUserId();

  const iv = crypto.randomBytes(12);
  const plainBytes = Buffer.from(plaintext, 'utf8');

  // Log: Input plaintext
  this.cryptoLog.addLog({
    actionId,
    userId,
    actionName: 'encrypt',
    operation: 'encrypt',
    layer: 'AES-256',
    step: 'plaintext_input',
    round: 0,
    input: plaintext,
    output: plaintext,
    keySnippet: ...,
    status: 'success',
  });

  // Call encryptGCM - could pass callback for round logging
  const { ciphertext, authTag } = encryptGCM(
    this.masterKey,
    iv,
    plainBytes,
    // Optional: callback per round
  );

  // Log: Output encrypted
  this.cryptoLog.addLog({
    actionId,
    userId,
    actionName: 'encrypt',
    operation: 'encrypt',
    layer: 'AES-256',
    round: 14, // final
    input: plaintext,
    output: payloadB64,
    iv: ivB64,
    tag: tagB64,
    keySnippet: ...,
    status: 'success',
  });

  // Log: HMAC
  const hmac = crypto.createHmac(...).digest('hex');
  this.cryptoLog.addLog({
    actionId,
    userId,
    actionName: 'encrypt',
    operation: 'encrypt',
    layer: 'HMAC',
    input: payloadB64,
    output: hmac,
    // keySnippet omitted if not relevant
    status: 'success',
  });

  return { ... };
}
```

For decrypt:

```typescript
async decrypt(cell: CellValue): Promise<string | null> {
  if (cell.type === 'clear') return cell.data;

  const actionId = ...;
  const userId = this.traceContext.getUserId();

  // Log: Input encrypted
  this.cryptoLog.addLog({
    actionId,
    userId,
    actionName: 'decrypt',
    operation: 'decrypt',
    layer: 'AES-256',
    input: enc.payload,
    output: enc.payload, // output still= input at this step
    iv: enc.iv,
    tag: enc.tag,
    status: 'success',
  });

  // Verify HMAC
  const expectedHmac = crypto.createHmac(...).digest('hex');
  const hmacOk = expectedHmac === enc.hmac;

  this.cryptoLog.addLog({
    actionId,
    userId,
    actionName: 'decrypt',
    operation: 'decrypt',
    layer: 'HMAC',
    input: enc.hmac,
    output: expectedHmac,
    authTag: hmacOk ? 'valid' : 'invalid',
    status: hmacOk ? 'success' : 'failure',
  });

  if (!hmacOk) return null;

  // Decrypt
  try {
    const plaintextBytes = decryptGCM(...);
    const plaintext = Buffer.from(plaintextBytes).toString('utf8');

    this.cryptoLog.addLog({
      actionId,
      userId,
      actionName: 'decrypt',
      operation: 'decrypt',
      layer: 'AES-256',
      input: enc.payload,
      output: plaintext,
      iv: enc.iv,
      tag: enc.tag,
      status: 'success',
    });

    return plaintext;
  } catch (err) {
    this.cryptoLog.addLog({
      actionId,
      userId,
      actionName: 'decrypt',
      operation: 'decrypt',
      layer: 'AES-256',
      input: enc.payload,
      output: '', // failed
      status: 'failure',
    });
    return null;
  }
}
```

---

### **Step 5: Monitor App Layout**

**File: `monitor/src/App.tsx`**

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Header from './components/Header';
import SearchFilter from './components/SearchFilter';
import LogColumn from './components/LogColumn';
import Pagination from './components/Pagination';
import type { CryptoActionGroup } from './types/crypto-log';

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const [allGroups, setAllGroups] = useState<CryptoActionGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOp, setFilterOp] = useState<'all' | 'encrypt' | 'decrypt'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const s = io('http://localhost:3000', { path: '/crypto' });

    s.on('connect', () => setIsConnected(true));
    s.on('disconnect', () => setIsConnected(false));

    s.on('initialGroups', (groups: CryptoActionGroup[]) => {
      setAllGroups(groups);
    });

    s.on('newGroup', (group: CryptoActionGroup) => {
      setAllGroups((prev) => [group, ...prev].slice(0, 120));
    });

    setSocket(s);
    return () => s.disconnect();
  }, []);

  // Filter logic
  const filtered = allGroups.filter((g) => {
    const matchOp = filterOp === 'all' || g.operation === filterOp;
    const matchSearch = searchQuery === '' ||
      g.actionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.steps.some(s => s.input?.includes(searchQuery) || s.output?.includes(searchQuery));
    return matchOp && matchSearch;
  });

  const decryptLogs = filtered.filter(g => g.operation === 'decrypt');
  const encryptLogs = filtered.filter(g => g.operation === 'encrypt');

  const maxPages = Math.ceil(Math.max(decryptLogs.length, encryptLogs.length) / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;

  const decryptPageLogs = decryptLogs.slice(start, start + itemsPerPage);
  const encryptPageLogs = encryptLogs.slice(start, start + itemsPerPage);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header isConnected={isConnected} />

      <div className="p-6 max-w-7xl mx-auto">
        <SearchFilter
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterOp={filterOp}
          setFilterOp={setFilterOp}
          totalLogs={filtered.length}
        />

        <div className="grid grid-cols-2 gap-6 mt-6 mb-6 min-h-96">
          <LogColumn
            title="Giải Mã (Decrypt)"
            logs={decryptPageLogs}
            operation="decrypt"
          />
          <LogColumn
            title="Mã Hóa (Encrypt)"
            logs={encryptPageLogs}
            operation="encrypt"
          />
        </div>

        <Pagination
          currentPage={currentPage}
          maxPages={maxPages}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
```

---

### **Step 6: LogEntry Component**

**File: `monitor/src/components/LogEntry.tsx`** (Create)

```typescript
import type { CryptoStepEntry } from '../types/crypto-log';

interface LogEntryProps {
  log: CryptoStepEntry;
}

export default function LogEntry({ log }: LogEntryProps) {
  const timeStr = new Date(log.timestamp).toLocaleTimeString('vi-VN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });

  const stepLabel = log.step ? `${log.step}` : '';
  const roundLabel = log.round !== undefined ? ` Round ${log.round}` : '';
  const layerRound = `<${log.layer}${stepLabel ? ` ${stepLabel}` : ''}${roundLabel}>`;

  return (
    <div className={`p-3 mb-2 rounded bg-white border-l-4 ${
      log.status === 'success' ? 'border-l-green-500' : 'border-l-red-500'
    }`}>
      <div className="text-xs text-gray-500 mb-1">
        {log.userId && `[${log.userId.slice(0, 8)}]`} [{timeStr}]
      </div>

      <div className="text-sm font-mono text-gray-800 mb-2">
        {layerRound}
      </div>

      <div className="text-xs text-gray-600 space-y-1">
        {log.input && (
          <div>
            <span className="font-semibold">Input:</span> {log.input.slice(0, 20)}...
          </div>
        )}
        {log.output && (
          <div>
            <span className="font-semibold">Output:</span> {log.output.slice(0, 20)}...
          </div>
        )}
        {log.keySnippet && (
          <div>
            <span className="font-semibold">Key:</span> {log.keySnippet}
          </div>
        )}
        {log.iv && (
          <div>
            <span className="font-semibold">IV:</span> {log.iv.slice(0, 16)}...
          </div>
        )}
        {log.tag && (
          <div>
            <span className="font-semibold">Tag:</span> {log.tag.slice(0, 16)}...
          </div>
        )}
        {log.authTag && (
          <div>
            <span className="font-semibold">Auth:</span> {log.authTag}
          </div>
        )}
      </div>

      {log.status === 'failure' && (
        <div className="text-xs text-red-600 mt-2">✗ Lỗi</div>
      )}
    </div>
  );
}
```

---

### **Step 7: LogColumn Component**

**File: `monitor/src/components/LogColumn.tsx`** (Create)

```typescript
import LogEntry from './LogEntry';
import type { CryptoActionGroup } from '../types/crypto-log';

interface LogColumnProps {
  title: string;
  logs: CryptoActionGroup[];
  operation: 'encrypt' | 'decrypt';
}

export default function LogColumn({ title, logs, operation }: LogColumnProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-bold text-gray-800 mb-4">{title}</h2>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-gray-400 text-sm text-center py-8">
            Chưa có logs {operation === 'decrypt' ? 'giải mã' : 'mã hóa'}
          </div>
        ) : (
          logs.map((group) =>
            group.steps.map((step) => (
              <LogEntry key={step.id} log={step} />
            ))
          )
        )}
      </div>
    </div>
  );
}
```

---

## 📦 **TypeScript Types**

**File: `monitor/src/types/crypto-log.ts`** (Create)

```typescript
export interface CryptoStepEntry {
  id: string;
  timestamp: Date;
  actionId: string;
  userId?: string;
  actionName: string;
  operation: "encrypt" | "decrypt";
  layer: string;
  step?: string;
  round?: number;
  input: string;
  output: string;
  iv?: string;
  tag?: string;
  authTag?: string;
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
```

---

## ✅ **Checklist Implementasi**

### Phase 1: Transfer Page

- [ ] Edit `TransferPage.tsx` - Add useEffect + change dropdown to div
- [ ] Test: Verify accountId auto-filled on page load

### Phase 2: Backend Infrastructure

- [ ] Edit `crypto.interface.ts` - Update CryptoStepEntry
- [ ] Edit `crypto-log.service.ts` - Update addLog signature
- [ ] Edit `aes.service.ts` - Add userId tracking + detailed logging

### Phase 3: Frontend Types

- [ ] Create `monitor/src/types/crypto-log.ts`
- [ ] Create `monitor/src/components/LogEntry.tsx`
- [ ] Create `monitor/src/components/LogColumn.tsx`

### Phase 4: Monitor App Redesign

- [ ] Rewrite `monitor/src/App.tsx` - 2-column layout
- [ ] Edit `header/SearchFilter.tsx` - Tiếng Việt labels
- [ ] Test: Real-time socket updates, filter/search, pagination

### Phase 5: Testing & Polish

- [ ] Test transfer flow: no dropdown, account auto-selected
- [ ] Test encryption/decryption logs in 2-column layout
- [ ] Verify tiếng Việt diacritics display correctly
- [ ] Check timestamps accuracy and formatting
- [ ] Performance: Ensure 120-group limit maintained

---

## 🚀 **Implementation Order**

**Recommended order for least merge conflicts:**

1. **TransferPage.tsx** (isolated, quick)
2. **crypto.interface.ts** (foundation)
3. **crypto-log.service.ts** (depends on #2)
4. **aes.service.ts** (depends on #2, #3, uses logs)
5. **monitor/types/** (isolated, no deps)
6. **monitor/components/** (depends on #5)
7. **monitor/App.tsx** (depends on #6)

---

## 📝 **Notes**

- **AES Detailed Logging**: Optional to log every SubBytes/ShiftRows step if performance concerned - can batch into round-level logs
- **User Context**: Ensure CryptoTraceContextService has getUserId() method; if missing, add it
- **Socket.io**: Verify gateway still works with new structure; may need update if field names change significantly
- **Timestamps**: Format: HH:MM:SS.mmm (milliseconds for precise tracking)
- **Tiếng Việt**: Use proper diacritics in labels: "Giải Mã", "Mã Hóa", "Theo Dõi", "Lỗi", etc.
