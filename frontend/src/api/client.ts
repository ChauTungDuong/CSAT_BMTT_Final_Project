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

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const method = String(config.method || "get").toUpperCase();
  const hasBody = shouldHaveBody(method, config.data);
  const shouldEncryptBody = hasBody && isJsonLikePayload(config.data);

  // Keep non-JSON payloads untouched (e.g. FormData/file upload)
  if (hasBody && !shouldEncryptBody) {
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
    // Fail open: if transport setup fails, fallback to plaintext request.
  }

  return config;
});

// Interceptor: redirect về login nếu 401 (ngoại trừ verify-pin)
api.interceptors.response.use(
  async (response: AxiosResponse) => {
    await maybeDecryptResponse(response);
    return response;
  },
  async (error: AxiosError) => {
    if (error.response) {
      await maybeDecryptResponse(error.response);
    }

    const url = error.config?.url ?? "";
    if (
      error.response?.status === 401 &&
      !url.includes("verify-pin") &&
      !url.includes("/auth/login")
    ) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

async function maybeDecryptResponse(response: AxiosResponse): Promise<void> {
  const envelopeHeader = readResponseHeader(response, "x-app-envelope");
  if (envelopeHeader !== "1") {
    return;
  }

  const transportAad = (response.config as TransportRequestConfig)
    ._transportAad;
  const transportSessionKey = (response.config as TransportRequestConfig)
    ._transportSessionKey;
  if (!transportAad) {
    return;
  }
  if (!transportSessionKey) {
    return;
  }

  try {
    response.data = await decryptEnvelopeResponse(
      response.data,
      transportAad,
      transportSessionKey,
    );
  } catch {
    // Keep raw data for downstream handlers if decrypt fails.
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

export default api;
