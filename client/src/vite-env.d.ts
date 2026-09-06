/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the JobRadar API. Defaults to "/api" (Vite dev proxy). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
