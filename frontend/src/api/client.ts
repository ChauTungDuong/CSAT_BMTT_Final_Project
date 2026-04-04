import axios, {
  AxiosError,
  AxiosHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import {
  decryptEnvelopeResponse,
  prepareEnvelopeRequest,
} from "./transportEnvelope";

type TransportRequestConfig = InternalAxiosRequestConfig & {
  _transportAad?: string;
  _transportSessionKey?: Uint8Array;
};

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

const TRANSPORT_STRICT =
  (import.meta as any).env.VITE_TRANSPORT_STRICT !== "false";

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const method = String(config.method || "get").toUpperCase();
  const requestUrl = String(config.url || "");
  const strictRequired = isStrictTransportRequired(requestUrl);
  const hasBody = shouldHaveBody(method, config.data);
  const shouldEncryptBody = hasBody && isJsonLikePayload(config.data);

  // Keep non-JSON payloads untouched (e.g. FormData/file upload)
  if (hasBody && !shouldEncryptBody) {
    if (strictRequired) {
      throw new Error(
        "Strict transport crypto đang bật: không cho phép gửi payload non-JSON ở dạng plaintext.",
      );
    }
    return config;
  }

  try {
    const prepared = await prepareEnvelopeRequest(
      method,
      config.url || "",
      config.data,
      shouldEncryptBody,
    );

    if (!prepared.enabled) {
      if (strictRequired) {
        throw new Error(
          "Strict transport crypto đang bật: không thể thiết lập envelope mã hóa cho request.",
        );
      }
      return config;
    }

    setHeader(config, "X-App-Envelope", "1");
    setHeader(config, "X-App-Timestamp", prepared.timestamp);
    setHeader(config, "X-App-Nonce", prepared.nonce);
    setHeader(config, "X-App-Session-Key", prepared.encryptedSessionKey);

    (config as TransportRequestConfig)._transportAad = prepared.aad;
    (config as TransportRequestConfig)._transportSessionKey =
      prepared.sessionKey;
    if (prepared.body) {
      config.data = prepared.body;
    }
  } catch {
    if (strictRequired) {
      throw new Error(
        "Strict transport crypto đang bật: request bị chặn vì không thể mã hóa payload.",
      );
    }

    // Non-strict mode: if transport setup fails, fallback to plaintext request.
  }

  return config;
});

// Interceptor: redirect về login nếu 401 (ngoại trừ verify-pin)
api.interceptors.response.use(
  async (response: AxiosResponse) => {
    try {
      await maybeDecryptResponse(response);
    } catch {
      forceSecurityLogout("decrypt-failed");
      throw new Error(
        "Phản hồi nhạy cảm không thể giải mã hợp lệ. Phiên đã bị đóng vì lý do bảo mật.",
      );
    }
    return response;
  },
  async (error: AxiosError) => {
    if (error.response) {
      try {
        await maybeDecryptResponse(error.response);
      } catch {
        forceSecurityLogout("decrypt-failed");
        return Promise.reject(error);
      }
    }

    const message = (error.response?.data as any)?.message;
    if (error.response?.status === 401 && message === "ADMIN_LOCKED") {
      sessionStorage.removeItem("auth");
      window.location.href = "/login?reason=admin-locked";
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && message === "SESSION_REVOKED") {
      sessionStorage.removeItem("auth");
      window.location.href = "/login?reason=session-revoked";
      return Promise.reject(error);
    }

    const url = error.config?.url ?? "";
    if (
      error.response?.status === 401 &&
      !url.includes("verify-pin") &&
      !url.includes("/auth/login")
    ) {
      sessionStorage.removeItem("auth");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

async function maybeDecryptResponse(response: AxiosResponse): Promise<void> {
  const sensitiveHeader = readResponseHeader(response, "x-app-sensitive");
  const sensitiveByPath = isSensitiveResponsePath(String(response.config.url || ""));
  const sensitiveRequired = sensitiveHeader === "1" || sensitiveByPath;

  const envelopeHeader = readResponseHeader(response, "x-app-envelope");
  if (envelopeHeader !== "1") {
    if (sensitiveRequired) {
      throw new Error("Sensitive response missing encrypted envelope header");
    }
    return;
  }

  const transportAad = (response.config as TransportRequestConfig)
    ._transportAad;
  const transportSessionKey = (response.config as TransportRequestConfig)
    ._transportSessionKey;
  if (!transportAad) {
    if (sensitiveRequired) {
      throw new Error("Sensitive response missing transport AAD");
    }
    return;
  }
  if (!transportSessionKey) {
    if (sensitiveRequired) {
      throw new Error("Sensitive response missing transport session key");
    }
    return;
  }

  try {
    response.data = await decryptEnvelopeResponse(
      response.data,
      transportAad,
      transportSessionKey,
    );
  } catch {
    if (sensitiveRequired) {
      throw new Error("Sensitive response decryption failed");
    }
  }
}

function shouldHaveBody(method: string, data: unknown): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return false;
  }
  return data !== undefined;
}

function isJsonLikePayload(data: unknown): boolean {
  if (data === null || data === undefined) {
    return true;
  }

  if (typeof data === "string") {
    return false;
  }

  if (typeof FormData !== "undefined" && data instanceof FormData) {
    return false;
  }

  if (
    typeof URLSearchParams !== "undefined" &&
    data instanceof URLSearchParams
  ) {
    return false;
  }

  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return false;
  }

  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    return false;
  }

  return true;
}

function setHeader(
  config: InternalAxiosRequestConfig,
  name: string,
  value: string,
): void {
  if (!(config.headers instanceof AxiosHeaders)) {
    config.headers = new AxiosHeaders(config.headers);
  }
  config.headers.set(name, value);
}

function readResponseHeader(
  response: AxiosResponse,
  name: string,
): string | undefined {
  const normalized = name.toLowerCase();
  const headerValue =
    response.headers?.[normalized] ?? response.headers?.[name] ?? undefined;

  if (Array.isArray(headerValue)) {
    return headerValue.length > 0 ? String(headerValue[0]) : undefined;
  }

  if (headerValue === undefined || headerValue === null) {
    return undefined;
  }

  return String(headerValue);
}

function isStrictTransportRequired(url: string): boolean {
  if (!TRANSPORT_STRICT) {
    return false;
  }

  return !isBootstrapTransportPath(url);
}

function isBootstrapTransportPath(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes("/transport/public-key");
}

function isSensitiveResponsePath(url: string): boolean {
  const normalized = normalizePathForMatching(url);
  return (
    normalized === "/api/auth/me" ||
    normalized === "/api/customers/me" ||
    normalized === "/api/customers/me/verify-pin" ||
    normalized === "/api/customers/me/pin/change/request-otp" ||
    normalized === "/api/customers/me/pin/change/confirm" ||
    normalized === "/api/customers/me/setup-pin"
  );
}

function normalizePathForMatching(url: string): string {
  const raw = url.split("?")[0] || "";
  const withApiPrefix = raw.startsWith("/api")
    ? raw
    : raw.startsWith("/")
      ? `/api${raw}`
      : `/api/${raw}`;
  return withApiPrefix.replace(/\/+/g, "/").toLowerCase();
}

function forceSecurityLogout(reason: "decrypt-failed" | "session-revoked") {
  sessionStorage.removeItem("auth");
  window.location.href = `/login?reason=${reason}`;
}

export default api;
