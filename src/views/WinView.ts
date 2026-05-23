import { Share } from '@capacitor/share';
import { createIcon } from '../components/icons';
import { getPuzzleById } from '../game/PuzzleLoader';
import { showConfetti } from '../components/Confetti';
import { t, tn } from '../i18n';
import { clearPuzzleReveals } from '../services/HintService';
import type { Router } from './Router';
import { ACHIEVEMENTS } from '../data/achievements';
import type { WinPayload } from './types';
import { getMonetizationContext } from '../services/MonetizationContext';
import { track } from '../services/AnalyticsService';
import { STORE_URLS } from '../config/legalUrls';

export class WinView {
  readonly element: HTMLDivElement;
  private readonly payload: WinPayload;
  private readonly router: Router;

  constructor(payload: WinPayload, router: Router, onDone: () => void) {
    this.payload = payload;
    this.router = router;

    this.element = document.createElement('div');
    this.element.className = 'view win-view';
    this.element.dataset.stars = String(payload.starRating);

    const shell = document.createElement('div');
    shell.className = 'win-view-shell';

    if (payload.starRating === 3) {
      window.setTimeout(() => {
        showConfetti({
          count: 60,
          duration: 7000,
          colors: ['var(--title-glow)', 'var(--title-color)']
        });
      }, 600);
    }

    const headline = document.createElement('div');
    headline.className = 'win-headline';
    headline.dataset.pristine = String(payload.starRating === 3);

    const starsRow = document.createElement('div');
    starsRow.className = 'win-stars';
    for (let i = 1; i <= 3; i += 1) {
      const star = document.createElement('span');
      star.className = 'win-star';
      star.dataset.filled = String(i <= payload.starRating);
      star.dataset.position = String(i);
      star.textContent = '★';
      starsRow.append(star);
    }
    headline.append(starsRow);

    if (payload.starRating === 3) {
      const label = document.createElement('span');
      label.className = 'win-headline-label';
      label.textContent = t('win.pristine_label');
      headline.append(label);
    } else {
      const subtitle = document.createElement('p');
      subtitle.className = 'view-subtitle';
      subtitle.textContent = t('win.solved_subtitle');
      headline.append(subtitle);
    }

    const title = document.createElement('h2');
    title.className = 'view-title';
    title.textContent = payload.puzzleTitle;

    const time = document.createElement('div');
    time.className = 'win-time';
    time.textContent = formatTime(payload.elapsedSeconds);

    const nextCountdown = document.createElement('p');
    nextCountdown.className = 'win-next-countdown';
    nextCountdown.hidden = !payload.isTodaysDaily;
    if (payload.isTodaysDaily) {
      const updateCountdown = (): void => {
        if (!this.element.isConnected) return;
        nextCountdown.textContent = `${t('menu.daily_next_in', { time: formatTimeUntilMidnight() })}`;
      };
      updateCountdown();
      const countdownId = window.setInterval(() => {
        if (!this.element.isConnected) {
          window.clearInterval(countdownId);
          return;
        }
        updateCountdown();
      }, 1000);
    }

    const newBest = document.createElement('div');
    newBest.className = 'win-new-best';
    newBest.textContent = t('win.new_best');
    newBest.hidden = !payload.wasNewBest;

    const newRating = document.createElement('div');
    newRating.className = 'win-new-rating';
    newRating.textContent = t('win.new_rating');
    newRating.hidden = !payload.wasNewRating;

    const pillRow = document.createElement('div');
    pillRow.className = 'win-pill-row';
    pillRow.append(newBest, newRating);

    const showStreak = payload.currentStreak >= 2;
    const showMistakes = payload.mistakes > 0;
    const showHints = payload.hintsUsed > 0;
    const hasStats = showStreak || showMistakes || showHints;

    let stats: HTMLDivElement | null = null;
    if (hasStats) {
      stats = document.createElement('div');
      stats.className = 'win-stats-line';

      type StatPart = { icon?: 'flame' | 'bulb'; text: string };
      const parts: StatPart[] = [];
      if (showStreak) parts.push({ icon: 'flame', text: t('win.stat_day_streak', { n: payload.currentStreak }) });
      if (showMistakes) parts.push({ text: tn('win.stat_mistake', payload.mistakes) });
      if (showHints) parts.push({ icon: 'bulb', text: tn('win.stat_hint', payload.hintsUsed) });

      parts.forEach((part, i) => {
        if (i > 0) {
          const dot = document.createElement('span');
          dot.textContent = '·';
          stats!.append(dot);
        }
        const wrap = document.createElement('span');
        wrap.className = 'win-stat-part';
        if (part.icon) wrap.append(createIcon(part.icon));
        const text = document.createElement('span');
        text.textContent = part.text;
        wrap.append(text);
        stats!.append(wrap);
      });
    }

    const shareButton = document.createElement('button');
    shareButton.type = 'button';
    shareButton.className = 'win-share-button button-primary';
    shareButton.textContent = t('win.share_button');
    shareButton.addEventListener('click', () => {
      void shareWin(payload, shareButton);
    });

    // Web-only: install CTA row, UA-detected to point at the right store.
    let installCtaRow: HTMLElement | null = null;
    const ctx = getMonetizationContext();
    if (!ctx.isNative) {
      installCtaRow = buildInstallCtaRow();
    }

    const secondaryRow = document.createElement('div');
    secondaryRow.className = 'win-secondary-row';

    const playAgainButton = document.createElement('button');
    playAgainButton.type = 'button';
    playAgainButton.className = 'win-play-again button-secondary';
    playAgainButton.textContent = t('win.play_again');
    playAgainButton.addEventListener('click', () => {
      void this.onPlayAgain();
    });

    const doneLink = document.createElement('button');
    doneLink.type = 'button';
    doneLink.className = 'win-done-link button-tertiary';
    doneLink.textContent = t('win.done_link');
    doneLink.addEventListener('click', onDone);

    secondaryRow.append(playAgainButton, doneLink);

    const achievementsSection =
      payload.unlockedAchievements && payload.unlockedAchievements.length > 0
        ? this.renderAchievementsSection(payload.unlockedAchievements)
        : null;

    const children: HTMLElement[] = [
      headline,
      title,
      time,
      pillRow,
      ...(achievementsSection ? [achievementsSection] : []),
      ...(stats ? [stats] : []),
      shareButton,
      secondaryRow,
      nextCountdown,
      ...(installCtaRow ? [installCtaRow] : []),
    ];

    shell.append(...children);
    this.element.append(shell);

  }

  private renderAchievementsSection(unlockedAchievementIds: string[]): HTMLElement | null {
    const unlockedDefs = unlockedAchievementIds
      .map((id) => ACHIEVEMENTS.find((achievement) => achievement.id === id))
      .filter((def): def is typeof ACHIEVEMENTS[number] => !!def);

    if (unlockedDefs.length === 0) return null;

    const achievementsSection = document.createElement('section');
    achievementsSection.className = 'win-achievements-section';

    const heading = document.createElement('div');
    heading.className = 'win-achievements-heading';
    // Singular vs plural
    heading.textContent = unlockedDefs.length === 1
      ? t('win.achievement_unlocked')
      : t('win.achievements_unlocked');
    achievementsSection.append(heading);

    unlockedDefs.forEach((def, i) => {
      const card = this.renderAchievementCard(def, i);
      achievementsSection.append(card);
    });

    return achievementsSection;
  }

  private renderAchievementCard(def: typeof ACHIEVEMENTS[number], index = 0): HTMLElement {
    const card = document.createElement('div');
    card.className = 'win-achievement-card';
    // Stagger each card's slide-in by 80ms per position.
    card.style.setProperty('--card-delay', `${index * 80}ms`);

    const icon = document.createElement('div');
    icon.className = 'win-achievement-card-icon';
    icon.append(createIcon('trophy'));
    card.append(icon);

    const details = document.createElement('div');
    details.className = 'win-achievement-details';
    const name = document.createElement('div');
    name.className = 'win-achievement-name';
    name.textContent = t(def.nameKey as import('../i18n').StringKey);
    const desc = document.createElement('div');
    desc.className = 'win-achievement-description';
    desc.textContent = t(def.descriptionKey as import('../i18n').StringKey);
    details.append(name, desc);
    card.append(details);
    return card;
  }

  private async onPlayAgain(): Promise<void> {
    const puzzle = getPuzzleById(this.payload.puzzleId);
    if (!puzzle) {
      console.warn('[WinView] could not find puzzle to replay', this.payload.puzzleId);
      return;
    }

    try {
      await clearPuzzleReveals(this.payload.puzzleId);
    } catch (err) {
      console.warn('[WinView] failed to clear hint reveals before replay', err);
    }

    this.router.replace('game', {
      puzzle,
      dayNumber: this.payload.dayNumber,
      isTodaysDaily: this.payload.isTodaysDaily
    });
  }
}

function renderStars(rating: 1 | 2 | 3): string {
  return '★'.repeat(rating) + '☆'.repeat(3 - rating);
}

/** Shared suffix fragments used across variants. */
function hintsSuffix(payload: WinPayload): string {
  if (payload.hintsUsed <= 0) return '';
  return payload.hintsUsed === 1
    ? t('share.suffix_hint_one',  { n: payload.hintsUsed })
    : t('share.suffix_hint_other', { n: payload.hintsUsed });
}

function newBestSuffix(payload: WinPayload): string {
  return payload.wasNewBest ? t('share.suffix_new_best') : '';
}

function statsLine(payload: WinPayload): string {
  const parts: string[] = [];
  if (payload.currentStreak >= 2) parts.push(t('share.stat_day_streak', { n: payload.currentStreak }));
  if (payload.solvedCount    >= 2) parts.push(t('share.stat_solved_count', { n: payload.solvedCount }));
  return parts.join(' · ');
}

/**
 * Build the share text WITHOUT the URL footer. Used when the OS share API
 * can take the URL as its own field (`navigator.share` / Capacitor Share),
 * so the URL isn't doubled — once in the text body, once appended by the OS.
 */
function buildShareBody(payload: WinPayload): string {
  const stars = renderStars(payload.starRating);
  const time  = formatTime(payload.elapsedSeconds);
  const label = payload.starRating === 3
    ? t('share.label_flawless')
    : t('share.label_solved');

  const performanceLine =
    `${stars} ${label} · ${time}${newBestSuffix(payload)}${hintsSuffix(payload)}`;

  const sl = statsLine(payload);

  const lines = [
    t('share.header', { day: payload.dayNumber, title: payload.puzzleTitle }),
    '',
    performanceLine,
  ];
  if (sl) lines.push(sl);
  return lines.join('\n');
}

/**
 * Build the share text WITH the URL footer included. Used when the receiving
 * channel is a plain text dump (clipboard fallback, preview sheet) — the URL
 * has to live inside the text or it gets lost.
 */
function buildShareText(payload: WinPayload): string {
  const body = buildShareBody(payload);
  const url  = buildPuzzleDeepLink(payload.dayNumber);
  return url ? `${body}\n\n${url}` : body;
}

/**
 * Build the deep link a friend should click to land on this specific puzzle.
 * Shape: `{VITE_SHARE_BASE_URL}/{dayNumber}` — e.g. `https://glitchsalad.com/123`.
 * The base URL is kept in an env var so it can change without code edits.
 *
 * Returns an empty string when no base URL is configured (dev builds), which
 * tells buildShareText to omit the footer entirely.
 *
 * NOTE (receive-side, next session): for this link to actually route a friend
 * to puzzle #N on web, three things need to land together —
 *   1. URL parsing on app boot (read the trailing path segment, treat it as
 *      a day number, hand it to PuzzleLoader). main.ts / Router are the
 *      natural homes; today they don't touch window.location at all.
 *   2. Out-of-archive handling for web players: WEB_FREE_DAYS (= 7, see
 *      ArchiveView.ts:9) caps how far back a web player can play. If the
 *      requested day is older than that, show an install/archive-unlock
 *      prompt instead of silently dropping them on today's puzzle.
 *   3. SPA fallback on the host: any path under the base URL must serve
 *      index.html (Vercel rewrites / Netlify _redirects / Cloudflare Pages
 *      _redirects, depending on host). Without it, the browser 404s before
 *      our JS ever sees the URL.
 */
function buildPuzzleDeepLink(dayNumber: number): string {
  const base = import.meta.env.VITE_SHARE_BASE_URL?.trim() ?? '';
  if (!base) return '';
  // Strip any trailing slash so we don't end up with `https://...//123`.
  return `${base.replace(/\/+$/, '')}/${dayNumber}`;
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatTimeUntilMidnight(): string {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const diffMs = Math.max(0, tomorrow.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Build install CTA row for web WinView.
 * UA-detects Android vs iOS and points at the correct store link.
 * Falls back to both links when the platform can't be determined.
 */
function buildInstallCtaRow(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'win-install-cta';

  const label = document.createElement('span');
  label.className = 'win-install-cta-label';
  label.textContent = t('web_cta.get_app');

  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = ua.includes('android');
  const isIos     = /iphone|ipad|ipod/.test(ua);

  const makeLink = (href: string, text: string, store: 'app_store' | 'play_store'): HTMLAnchorElement => {
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'win-install-cta-link button-secondary';
    a.textContent = text;
    a.addEventListener('click', () => {
      track('web_install_cta_tapped', { store });
    });
    return a;
  };

  const links = document.createElement('div');
  links.className = 'win-install-cta-links';

  if (isAndroid) {
    links.append(makeLink(STORE_URLS.playStore, t('web_cta.play_store'), 'play_store'));
  } else if (isIos) {
    links.append(makeLink(STORE_URLS.appStore, t('web_cta.app_store'), 'app_store'));
  } else {
    // Desktop or unknown — show both
    links.append(
      makeLink(STORE_URLS.appStore,  t('web_cta.app_store'),  'app_store'),
      makeLink(STORE_URLS.playStore, t('web_cta.play_store'), 'play_store'),
    );
  }

  row.append(label, links);
  return row;
}

async function shareWin(payload: WinPayload, buttonEl: HTMLButtonElement): Promise<void> {
  track('share_button_tapped', { day: payload.dayNumber });

  // Two text shapes: the body (used when the OS takes the URL as its own
  // field — navigator.share / Capacitor Share) and the full text (used when
  // the URL has to be embedded in the text — clipboard fallback).
  const body    = buildShareBody(payload);
  const fullText = buildShareText(payload);
  const url     = buildPuzzleDeepLink(payload.dayNumber);
  const title   = 'GlitchSalad';

  const { isNative } = getMonetizationContext();

  if (isNative) {
    // Native iOS/Android: route through the Capacitor plugin.
    try {
      await Share.share({ title, text: body, ...(url ? { url } : {}) });
      track('share_string_generated', { share_method: 'native_share' });
    } catch {
      // Share cancelled or unavailable — no fallback needed on native.
    }
    return;
  }

  // Web (mobile AND desktop): try the OS share dialog first when available.
  // We pass title + text + url as SEPARATE fields, not a concatenated blob.
  // Edge mobile Android (and some Android share intents) reject text-only
  // payloads with NotAllowedError; including title + url makes the data
  // shareable across every browser that exposes the API.
  //
  // navigator.canShare() lets us bail out cleanly when the data isn't
  // acceptable to the platform, instead of throwing into the catch and
  // silently dropping into the preview sheet.
  //
  // Heads-up on macOS Safari: it sometimes bundles page imagery into the
  // share payload, which can produce a "Share 2 Items" dialog instead of a
  // plain text share. We accept that tradeoff — the native dialog is the
  // right primary path when it exists.
  const webShareData: ShareData = {
    title,
    text: body,
    ...(url ? { url } : {}),
  };
  const canUseWebShare =
    typeof navigator.share === 'function' &&
    (typeof navigator.canShare !== 'function' || navigator.canShare(webShareData));

  if (canUseWebShare) {
    try {
      await navigator.share(webShareData);
      track('share_string_generated', { share_method: 'native_share' });
      return;
    } catch (err) {
      // AbortError = user dismissed the share sheet intentionally. Not an error.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Other errors (NotAllowedError, etc.) fall through to the preview sheet.
    }
  }

  // Fallback: show a preview sheet so the player can SEE what they're sharing.
  // We also eagerly attempt a clipboard write here, while the user gesture
  // from the Share button is still live — most desktop browsers accept it,
  // so the sheet opens already in "Copied" state. If the write fails
  // (insecure context, locked-down browser), the sheet's Copy button does
  // the work itself with execCommand as the bulletproof fallback.
  let initiallyCopied = false;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(fullText);
      initiallyCopied = true;
    } catch {
      // Clipboard rejected — the sheet's Copy button will try again.
    }
  }

  // buttonEl is unused on the desktop path now (the sheet has its own Copy
  // button), but kept in the signature so native/mobile paths can still flash
  // it if we ever want.
  void buttonEl;

  showSharePreviewSheet({
    text: fullText,
    initiallyCopied,
    onCopied: () => {
      track('share_string_generated', { share_method: 'clipboard' });
    },
  });
}

/** Briefly replace a button's label with a confirmation string, then restore. */
function flashButton(btn: HTMLButtonElement, label: string, durationMs = 1800): void {
  const original = btn.textContent ?? '';
  btn.textContent = label;
  btn.disabled = true;
  window.setTimeout(() => {
    btn.textContent = original;
    btn.disabled = false;
  }, durationMs);
}

/**
 * Show a share preview sheet on desktop web (and as the mobile-web fallback).
 * Displays the formatted share text so the player can see what they're sharing.
 *
 * When `initiallyCopied` is true, the sheet opens with the Copy button already
 * flashed to "Copied ✓" — `shareWin` got a successful clipboard write during
 * the live user gesture before mounting us. When false, the Copy button does
 * the work itself via the three-stage `copyToClipboard` fallback.
 *
 * `onCopied` fires exactly once, regardless of which path landed the text in
 * the clipboard, so analytics aren't double-counted.
 */
function showSharePreviewSheet(opts: {
  text: string;
  initiallyCopied: boolean;
  onCopied: () => void;
}): void {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'share-preview-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'share-preview-header';

  const titleEl = document.createElement('span');
  titleEl.className = 'share-preview-title';
  titleEl.textContent = t('win.share_button');

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'share-preview-close';
  closeBtn.setAttribute('aria-label', t('win.share_fallback_close'));
  closeBtn.textContent = '✕';

  header.append(titleEl, closeBtn);

  const preview = document.createElement('pre');
  preview.className = 'share-preview-text';
  preview.textContent = opts.text;

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'button-primary share-preview-copy';
  copyBtn.textContent = t('win.share_copy');

  const dismiss = (): void => {
    backdrop.classList.remove('sheet-backdrop--visible');
    sheet.classList.remove('share-preview-sheet--visible');
    window.setTimeout(() => backdrop.remove(), 220);
  };

  let hasFiredOnCopied = false;
  const fireOnCopiedOnce = (): void => {
    if (hasFiredOnCopied) return;
    hasFiredOnCopied = true;
    opts.onCopied();
  };

  closeBtn.addEventListener('click', dismiss);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) dismiss(); });

  copyBtn.addEventListener('click', async () => {
    const ok = await copyToClipboard(opts.text, preview);
    if (ok) {
      fireOnCopiedOnce();
      flashButton(copyBtn, t('win.share_copied'));
    }
    // If ok is false, the preview text has been selected — the user can hit
    // ⌘C / Ctrl+C themselves. No further UI action.
  });

  sheet.append(header, preview, copyBtn);
  backdrop.append(sheet);
  document.body.append(backdrop);

  requestAnimationFrame(() => {
    backdrop.classList.add('sheet-backdrop--visible');
    sheet.classList.add('share-preview-sheet--visible');

    if (opts.initiallyCopied) {
      flashButton(copyBtn, t('win.share_copied'));
      fireOnCopiedOnce();
    }
  });
}

/**
 * Robust clipboard write with three layered fallbacks:
 *   1. navigator.clipboard.writeText  — modern async API (requires user gesture
 *      and, in some browsers, an active document focus).
 *   2. document.execCommand('copy')   — legacy synchronous path via a temp
 *      textarea. Deprecated but still implemented in every shipping browser
 *      and works in plenty of cases where (1) silently fails.
 *   3. Manual selection of `selectionFallbackEl` — last-resort UX where the
 *      user has to press ⌘C / Ctrl+C themselves. Returns false in this case
 *      so the caller knows not to claim "Copied ✓".
 */
async function copyToClipboard(text: string, selectionFallbackEl: HTMLElement): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path.
    }
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (ok) return true;
  } catch {
    // execCommand absent or blocked — fall through to manual selection.
  }

  try {
    const range = document.createRange();
    range.selectNodeContents(selectionFallbackEl);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  } catch {
    // Give up silently.
  }
  return false;
}
