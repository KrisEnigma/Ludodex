/**
 * Reusable puzzle tag pills — category and difficulty.
 *
 * All tags share the same neutral color. Difficulty is communicated
 * through star count only — no color differences.
 *
 * Usage:
 *   el.append(buildPuzzleTags({ category: 'characters', difficulty: 'hard' }));
 *   el.append(buildDifficultyTag('hard'));
 *   el.append(buildCategoryTag('studios'));
 */

function makeTag(text: string): HTMLElement {
  const tag = document.createElement('span');
  tag.className = 'puzzle-tag';
  tag.textContent = text;
  return tag;
}

export function buildCategoryTag(category: string): HTMLElement {
  return makeTag(category);
}

export function buildDifficultyTag(difficulty: string): HTMLElement {
  return makeTag(difficulty);
}

/**
 * Returns a .puzzle-tags container with both pills.
 * Pass only what you have — either can be omitted.
 */
export function buildPuzzleTags({
  category,
  difficulty,
}: {
  category?: string | null;
  difficulty?: string | null;
}): HTMLElement {
  const container = document.createElement('div');
  container.className = 'puzzle-tags';
  if (category) container.append(buildCategoryTag(category));
  if (difficulty) container.append(buildDifficultyTag(difficulty));
  return container;
}
