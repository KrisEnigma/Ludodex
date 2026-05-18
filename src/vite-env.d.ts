/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMOB_INTERSTITIAL_ANDROID?: string;
  readonly VITE_ADMOB_INTERSTITIAL_IOS?: string;
  readonly VITE_ADMOB_USE_TEST_IDS?: string;
  readonly VITE_REVENUECAT_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
