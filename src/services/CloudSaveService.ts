/**
 * Cloud save: restore progress, hints and purchases on a reinstall or a new
 * phone. Not live sync — each device plays on its own save; the cloud copy is
 * just the latest backup.
 *
 *  - iOS: the save (selected Preferences keys, one JSON string) is mirrored to
 *    the iCloud key-value store via the local CloudSavePlugin (Swift). It
 *    follows the player's Apple ID.
 *  - Android: nothing to do here. Auto Backup copies the Preferences file
 *    (res/xml/data_extraction_rules.xml) and restores it before first launch.
 *  - Web: no cloud save.
 *
 * Rules that keep it safe:
 *  - Restore only when this device has no progress and the cloud copy does
 *    (fresh install). Never merges, never overwrites real local progress.
 *  - Never push a progress-less save over a cloud copy that has progress —
 *    except right after "Reset stats" (forced), so a reset sticks.
 *  - iCloud can deliver the copy a few seconds after first launch; the
 *    "changed" event re-runs the restore check and reloads once.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';

interface CloudSavePlugin {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  addListener(event: 'changed', listener: () => void): Promise<PluginListenerHandle>;
}

const CloudSave = registerPlugin<CloudSavePlugin>('CloudSave');

const CLOUD_KEY = 'ludodex.save.v1';

/** Preferences keys that make up the save. Device-only state is left out. */
const SAVE_KEYS = [
  // progress
  'solved_ids', 'solved_times', 'solved_ratings', 'puzzles_solved_count',
  'current_streak', 'best_streak', 'last_played_date',
  'ludodex.first_solve_times', 'ludodex.daily_solve_dates', 'ludodex.first_play_lost',
  'ludodex.pristine_count', 'ludodex.consecutive_pristine_count', 'ludodex.archive_solves_count',
  'ludodex.last_seen_day_stamp', 'ludodex.install_date',
  'ludodex.achievements_earned',
  'ludodex.streak_freezes', 'ludodex.freeze_used_dates', 'ludodex.freeze_win_progress',
  // hints and purchases
  'ludodex.hint_state', 'ludodex.ad_hint_grants', 'ludodex.iap.credited_tx',
  'ludodex.starter_pack.shown_at',
  // preferences worth carrying over
  'active_skin', 'ludodex.language', 'ludodex.sound', 'tutorial_seen', 'streak_banner_dismissed',
];
/** Per-puzzle revealed hint letters. */
const SAVE_PREFIXES = ['ludodex.hint_reveals.'];

type SaveFile = { v: 1; savedAt: string; data: Record<string, string> };

function isAvailable(): boolean {
  return Capacitor.getPlatform() === 'ios' && Capacitor.isNativePlatform();
}

async function readLocal(): Promise<Record<string, string>> {
  const { keys } = await Preferences.keys();
  const wanted = keys.filter((k) => SAVE_KEYS.includes(k) || SAVE_PREFIXES.some((p) => k.startsWith(p)));
  const data: Record<string, string> = {};
  await Promise.all(
    wanted.map(async (key) => {
      const { value } = await Preferences.get({ key });
      if (value !== null) data[key] = value;
    })
  );
  return data;
}

function hasProgress(data: Record<string, string>): boolean {
  const nonEmptyArray = (raw: string | undefined): boolean => {
    if (!raw) return false;
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  };
  return nonEmptyArray(data['solved_ids']) || nonEmptyArray(data['ludodex.iap.credited_tx']);
}

async function readCloud(): Promise<SaveFile | null> {
  try {
    const { value } = await Promise.race([
      CloudSave.get({ key: CLOUD_KEY }),
      new Promise<{ value: null }>((resolve) => window.setTimeout(() => resolve({ value: null }), 1500)),
    ]);
    if (!value) return null;
    const parsed = JSON.parse(value) as SaveFile;
    return parsed?.v === 1 && parsed.data ? parsed : null;
  } catch {
    return null;
  }
}

/** Fresh install + cloud copy with progress → write it locally. Returns true if restored. */
async function restoreIfFresh(): Promise<boolean> {
  const cloud = await readCloud();
  if (!cloud || !hasProgress(cloud.data)) return false;
  if (hasProgress(await readLocal())) return false;
  await Promise.all(Object.entries(cloud.data).map(([key, value]) => Preferences.set({ key, value })));
  return true;
}

/**
 * Boot step (before i18n / progress are read). Restores a cloud save on a
 * fresh install, then keeps the cloud copy current. No-op off iOS.
 */
export async function initCloudSave(): Promise<void> {
  if (!isAvailable()) return;
  try {
    await restoreIfFresh();
  } catch (err) {
    console.warn('[CloudSave] restore failed', err);
  }

  // iCloud data that arrives after launch (new phone, first minute).
  let reloaded = false;
  void CloudSave.addListener('changed', () => {
    if (reloaded) return;
    void restoreIfFresh().then((restored) => {
      if (restored) {
        reloaded = true;
        window.location.reload();
      }
    });
  });

  void App.addListener('pause', () => void pushCloudSave());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void pushCloudSave();
  });
}

let lastPushed = '';
let pushTimer: number | null = null;

/** Debounced push, e.g. after a solve or a purchase. */
export function scheduleCloudSave(): void {
  if (!isAvailable()) return;
  if (pushTimer !== null) window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    pushTimer = null;
    void pushCloudSave();
  }, 1500);
}

/**
 * Write the current save to iCloud. `force` (Reset stats) allows replacing
 * a cloud copy that has progress with one that doesn't.
 */
export async function pushCloudSave(options: { force?: boolean } = {}): Promise<void> {
  if (!isAvailable()) return;
  try {
    const data = await readLocal();
    if (!options.force && !hasProgress(data)) {
      // Fresh device: never clobber a cloud save that hasn't been restored yet.
      const cloud = await readCloud();
      if (cloud && hasProgress(cloud.data)) return;
    }
    const body = JSON.stringify(data);
    if (body === lastPushed && !options.force) return;
    const file: SaveFile = { v: 1, savedAt: new Date().toISOString(), data };
    await CloudSave.set({ key: CLOUD_KEY, value: JSON.stringify(file) });
    lastPushed = body;
  } catch (err) {
    console.warn('[CloudSave] push failed', err);
  }
}
