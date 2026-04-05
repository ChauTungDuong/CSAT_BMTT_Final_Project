/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_MOCK_ENABLED?: string;
  readonly VITE_DEV_MOCK_AUTO_LOGIN?: string;
  readonly VITE_MOCK_ROLE?: 'admin' | 'customer';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
