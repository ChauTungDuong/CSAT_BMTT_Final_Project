export interface EncryptedEnvelope {
  kid?: string;
  encryptedKey?: string;
  iv: string;
  tag: string;
  payload: string;
  aad?: string;
}

export type TransportPublicKeyMeta =
  | { enabled: false }
  | { enabled: true; alg: string; kid: string; n: string; e: string };

const META_TTL_MS = 60_000;
const NONCE_BYTES = 16;
const AES_GCM_TAG_BYTES = 16;

const SHA256_INIT = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
  0x1f83d9ab, 0x5be0cd19,
];

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let transportMetaCache: {
  value: TransportPublicKeyMeta;
  expiresAt: number;
} | null = null;
let transportMetaPromise: Promise<TransportPublicKeyMeta> | null = null;

export async function getTransportPublicKeyMeta(): Promise<TransportPublicKeyMeta> {
  const now = Date.now();
  if (transportMetaCache && transportMetaCache.expiresAt > now) {
    return transportMetaCache.value;
  }

  if (!transportMetaPromise) {
    transportMetaPromise = fetch("/api/transport/public-key", {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          return { enabled: false } as TransportPublicKeyMeta;
        }
        const payload: unknown = await response.json();
        return parseTransportMeta(payload);
      })
      .catch(() => ({ enabled: false }) as TransportPublicKeyMeta)
      .finally(() => {
        transportMetaPromise = null;
      });
  }

  const value = await transportMetaPromise;
  transportMetaCache = { value, expiresAt: now + META_TTL_MS };
  return value;
}

export function normalizeApiPath(url: string): string {
  if (!url) {
    return "/api";
  }

  if (/^https?:\/\//i.test(url)) {
    const parsed = new URL(url);
    return sanitizePath(parsed.pathname);
  }

  const rawPath = url.split("?")[0] || "/";
  if (rawPath === "/api" || rawPath.startsWith("/api/")) {
    return sanitizePath(rawPath);
  }
  if (rawPath.startsWith("/")) {
    return sanitizePath(`/api${rawPath}`);
  }

  return sanitizePath(`/api/${rawPath}`);
}

export function buildTransportAad(
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
): string {
  return `${method.toUpperCase()}|${path}|${timestamp}|${nonce}`;
}

export async function prepareEnvelopeRequest(
  method: string,
  url: string,
  payload: unknown,
  shouldEncryptBody: boolean,
): Promise<
  | {
      enabled: false;
    }
  | {
      enabled: true;
      timestamp: string;
      nonce: string;
      aad: string;
      encryptedSessionKey: string;
      sessionKey: Uint8Array;
      body?: EncryptedEnvelope;
    }
> {
  if (!isWebCryptoReady()) {
    return { enabled: false };
  }

  const keyMeta = await getTransportPublicKeyMeta();
  if (!keyMeta.enabled) {
    return { enabled: false };
  }

  const path = normalizeApiPath(url);
  if (path === "/api/transport/public-key") {
    return { enabled: false };
  }

  const timestamp = Date.now().toString();
  const nonce = createNonce();
  const aad = buildTransportAad(method, path, timestamp, nonce);

  const sessionKey = crypto.getRandomValues(new Uint8Array(32));
  const encryptedSessionKey = rsaOaepEncryptSessionKey(sessionKey, keyMeta);

  const base = {
    enabled: true as const,
    timestamp,
    nonce,
    aad,
    encryptedSessionKey,
    sessionKey,
  };

  if (!shouldEncryptBody) {
    return base;
  }

  const envelope = await encryptJsonPayload(payload, sessionKey, aad);
  return {
    ...base,
    body: envelope,
  };
}

export async function decryptEnvelopeResponse(
  data: unknown,
  aad: string,
  sessionKey: Uint8Array,
): Promise<unknown> {
  if (!isEncryptedEnvelope(data)) {
    return data;
  }

  const aesKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(sessionKey),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  const cipherBytes = base64ToBytes(data.payload);
  const tagBytes = base64ToBytes(data.tag);
  const merged = concatBytes(cipherBytes, tagBytes);

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(base64ToBytes(data.iv)),
      additionalData: toArrayBuffer(textEncoder.encode(aad)),
      tagLength: 128,
    },
    aesKey,
    toArrayBuffer(merged),
  );

  const decoded = textDecoder.decode(plaintext);
  return JSON.parse(decoded);
}

function parseTransportMeta(input: unknown): TransportPublicKeyMeta {
  if (!input || typeof input !== "object") {
    return { enabled: false };
  }

  const raw = input as Record<string, unknown>;
  if (raw.enabled !== true) {
    return { enabled: false };
  }

  if (
    typeof raw.alg !== "string" ||
    typeof raw.kid !== "string" ||
    typeof raw.n !== "string" ||
    typeof raw.e !== "string"
  ) {
    return { enabled: false };
  }

  return {
    enabled: true,
    alg: raw.alg,
    kid: raw.kid,
    n: raw.n,
    e: raw.e,
  };
}

function isWebCryptoReady(): boolean {
  return !!globalThis.crypto?.subtle;
}

function rsaOaepEncryptSessionKey(
  sessionKey: Uint8Array,
  keyMeta: Extract<TransportPublicKeyMeta, { enabled: true }>,
): string {
  const n = BigInt(`0x${keyMeta.n}`);
  const e = BigInt(`0x${keyMeta.e}`);
  const k = Math.ceil(bitLength(n) / 8);
  const hLen = 32;

  if (sessionKey.length > k - 2 * hLen - 2) {
    throw new Error("Session key qua dai cho RSA-OAEP");
  }

  const lHash = sha256(new Uint8Array(0));
  const ps = new Uint8Array(k - sessionKey.length - 2 * hLen - 2);
  const db = concat(
    concat(lHash, ps),
    concat(new Uint8Array([0x01]), sessionKey),
  );

  const seed = crypto.getRandomValues(new Uint8Array(hLen));
  const dbMask = mgf1(seed, k - hLen - 1);
  const maskedDb = xor(db, dbMask);
  const seedMask = mgf1(maskedDb, hLen);
  const maskedSeed = xor(seed, seedMask);

  const em = concat(new Uint8Array([0x00]), concat(maskedSeed, maskedDb));
  const m = bytesToBigInt(em);
  const c = modPow(m, e, n);
  return bytesToBase64(bigIntToBytes(c, k));
}

async function encryptJsonPayload(
  payload: unknown,
  sessionKey: Uint8Array,
  aad: string,
): Promise<EncryptedEnvelope> {
  const aesKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(sessionKey),
    {
      name: "AES-GCM",
    },
    false,
    ["encrypt"],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = textEncoder.encode(JSON.stringify(payload ?? null));
  const encryptedRaw = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(textEncoder.encode(aad)),
      tagLength: 128,
    },
    aesKey,
    toArrayBuffer(encoded),
  );

  const encryptedBytes = new Uint8Array(encryptedRaw);
  const payloadBytes = encryptedBytes.slice(0, -AES_GCM_TAG_BYTES);
  const tagBytes = encryptedBytes.slice(-AES_GCM_TAG_BYTES);

  return {
    iv: bytesToBase64(iv),
    tag: bytesToBase64(tagBytes),
    payload: bytesToBase64(payloadBytes),
    aad,
  };
}

function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  return bytesToBase64(bytes);
}

function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  const raw = value as Record<string, unknown>;
  return (
    typeof raw.iv === "string" &&
    typeof raw.tag === "string" &&
    typeof raw.payload === "string"
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const out = new Uint8Array(left.length + right.length);
  out.set(left, 0);
  out.set(right, left.length);
  return out;
}

function concat(left: Uint8Array, right: Uint8Array): Uint8Array {
  const out = new Uint8Array(left.length + right.length);
  out.set(left, 0);
  out.set(right, left.length);
  return out;
}

function xor(left: Uint8Array, right: Uint8Array): Uint8Array {
  if (left.length !== right.length) {
    throw new Error("XOR length mismatch");
  }
  const out = new Uint8Array(left.length);
  for (let i = 0; i < left.length; i += 1) {
    out[i] = left[i] ^ right[i];
  }
  return out;
}

function mgf1(seed: Uint8Array, outputLength: number): Uint8Array {
  const out = new Uint8Array(outputLength);
  let counter = 0;
  let written = 0;

  while (written < outputLength) {
    const c = i2osp(counter, 4);
    const digest = sha256(concat(seed, c));
    const take = Math.min(digest.length, outputLength - written);
    out.set(digest.slice(0, take), written);
    written += take;
    counter += 1;
  }

  return out;
}

function sha256(input: Uint8Array): Uint8Array {
  const padded = padSha256(input);
  const h = SHA256_INIT.slice();
  const w = new Array<number>(64);

  for (let chunkStart = 0; chunkStart < padded.length; chunkStart += 64) {
    for (let i = 0; i < 16; i += 1) {
      const j = chunkStart + i * 4;
      w[i] =
        ((padded[j] << 24) |
          (padded[j + 1] << 16) |
          (padded[j + 2] << 8) |
          padded[j + 3]) >>>
        0;
    }

    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    let f = h[5];
    let g = h[6];
    let hh = h[7];

    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + s1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i += 1) {
    out[i * 4] = (h[i] >>> 24) & 0xff;
    out[i * 4 + 1] = (h[i] >>> 16) & 0xff;
    out[i * 4 + 2] = (h[i] >>> 8) & 0xff;
    out[i * 4 + 3] = h[i] & 0xff;
  }
  return out;
}

function padSha256(input: Uint8Array): Uint8Array {
  const bitLen = input.length * 8;
  const withOne = input.length + 1;
  const mod = withOne % 64;
  const zeroPad = mod <= 56 ? 56 - mod : 120 - mod;
  const totalLen = withOne + zeroPad + 8;

  const out = new Uint8Array(totalLen);
  out.set(input, 0);
  out[input.length] = 0x80;

  const view = new DataView(out.buffer);
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(totalLen - 4, bitLen >>> 0, false);
  return out;
}

function rotr(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  if (modulus === 1n) {
    return 0n;
  }
  let result = 1n;
  let b = ((base % modulus) + modulus) % modulus;
  let e = exponent;
  while (e > 0n) {
    if ((e & 1n) === 1n) {
      result = (result * b) % modulus;
    }
    e >>= 1n;
    b = (b * b) % modulus;
  }
  return result;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  if (bytes.length === 0) {
    return 0n;
  }
  return BigInt(`0x${bytesToHex(bytes)}`);
}

function bigIntToBytes(value: bigint, length: number): Uint8Array {
  if (value < 0n) {
    throw new Error("bigIntToBytes khong ho tro so am");
  }

  let hex = value.toString(16);
  if (hex.length % 2 !== 0) {
    hex = `0${hex}`;
  }

  const raw = hex ? hexToBytes(hex) : new Uint8Array(0);
  if (raw.length > length) {
    throw new Error("bigIntToBytes overflow");
  }

  const out = new Uint8Array(length);
  out.set(raw, length - raw.length);
  return out;
}

function i2osp(value: number, length: number): Uint8Array {
  return bigIntToBytes(BigInt(value), length);
}

function bitLength(value: bigint): number {
  if (value === 0n) {
    return 0;
  }
  return value.toString(2).length;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().replace(/^0x/i, "");
  const padded = normalized.length % 2 === 0 ? normalized : `0${normalized}`;
  const out = new Uint8Array(padded.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(padded.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function sanitizePath(pathname: string): string {
  if (!pathname) {
    return "/";
  }
  const collapsed = pathname.replace(/\/+/g, "/");
  return collapsed.startsWith("/") ? collapsed : `/${collapsed}`;
}