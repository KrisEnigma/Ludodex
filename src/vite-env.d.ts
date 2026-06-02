/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMOB_INTERSTITIAL_ANDROID?: string;
  readonly VITE_ADMOB_INTERSTITIAL_IOS?: string;
  readonly VITE_ADMOB_USE_TEST_IDS?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_REVENUECAT_API_KEY?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SHARE_BASE_URL?: string;
  /** Override for the remote puzzle catalog URL. Defaults to
   *  `${VITE_SHARE_BASE_URL}/api/puzzles` when unset. */
  readonly VITE_PUZZLES_URL?: string;
  /** Day-1 anchor for the daily sequence (YYYY-MM-DD). Set to (public launch − 7)
   *  for a 7-puzzle starter archive. Falls back to a code default when unset. */
  readonly VITE_LAUNCH_DATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
