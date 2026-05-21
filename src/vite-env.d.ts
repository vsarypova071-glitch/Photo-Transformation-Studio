/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Базовый URL Beget VPS API (например, https://ai-fotosessia.ru или пусто для относительных путей) */
  readonly VITE_API_URL: string
  /** Feature flag: включить реферальную систему */
  readonly VITE_ENABLE_REFERRALS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
