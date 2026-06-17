import { Capacitor, registerPlugin } from '@capacitor/core';

interface AlternateIconPlugin {
  setIcon(options: { icon: string }): Promise<{ icon: string }>;
  getIcon(): Promise<{ icon: string }>;
}

const AlternateIconPlugin = registerPlugin<AlternateIconPlugin>('AlternateIconPlugin');

export type AppIconId = 'void' | 'lumen' | 'neon-horizon' | 'dot-matrix';

export const APP_ICONS: Array<{ id: AppIconId; name: string; src: string }> = [
  { id: 'void',          name: 'Void',         src: '/icons/icon1.png' },
  { id: 'lumen',         name: 'Lumen',        src: '/icons/icon4.png' },
  { id: 'neon-horizon',  name: 'Neon Horizon',  src: '/icons/icon2.png' },
  { id: 'dot-matrix',    name: 'Dot Matrix',    src: '/icons/icon3.png' },
];

/**
 * Maps a skin ID to the launcher icon variant it should activate.
 * Skins not listed here default to 'void' (the main activity icon).
 */
const SKIN_TO_ICON: Record<string, string> = {
  'neon-horizon': 'neon-horizon',
  'gameboy':      'dot-matrix',
  'lumen':        'lumen',
};

/**
 * Returns the currently active launcher icon ID. No-op on web (returns 'void').
 */
export async function getActiveIcon(): Promise<AppIconId> {
  if (!Capacitor.isNativePlatform()) return 'void';
  try {
    const { icon } = await AlternateIconPlugin.getIcon();
    return (icon as AppIconId) ?? 'void';
  } catch {
    return 'void';
  }
}

/**
 * Sets the launcher icon directly by icon ID. No-op on web.
 */
export async function setActiveIcon(iconId: AppIconId): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AlternateIconPlugin.setIcon({ icon: iconId });
  } catch (e) {
    console.warn('[AlternateIcon] setIcon failed:', e);
  }
}

/**
 * Call after applySkin() on native builds to keep the launcher icon
 * in sync with the active skin. No-op on web.
 */
export async function syncLauncherIcon(skinId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const icon = SKIN_TO_ICON[skinId] ?? 'void';
  try {
    await AlternateIconPlugin.setIcon({ icon });
  } catch (e) {
    // Non-fatal — icon just stays as-is
    console.warn('[AlternateIcon] setIcon failed:', e);
  }
}
