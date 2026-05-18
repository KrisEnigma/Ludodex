import { Preferences } from '@capacitor/preferences';

const SOLVED_IDS_KEY = 'solved_ids';

export async function getSolvedIds(): Promise<string[]> {
  const { value } = await Preferences.get({ key: SOLVED_IDS_KEY });
  if (!value) return [];
  try {
    return JSON.parse(value) as string[];
  } catch {
    return [];
  }
}

export async function markSolved(id: string) {
  const solved = new Set(await getSolvedIds());
  solved.add(id);
  await Preferences.set({
    key: SOLVED_IDS_KEY,
    value: JSON.stringify(Array.from(solved))
  });
}
