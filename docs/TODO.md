# Ludodex — TODO (parked for later)

Deferred items from the Sep 2026 audit / fix pass. Details and rationale live in
`docs/audit-2026-09-30.md` (section noted per item).

## Decisions needed

- [ ] **"Watch ad → +1 hint" button shows on native but does nothing** (§3.3).
      `initAds()` is never called, so `showRewardedAdForHint()` always returns
      `'unavailable'` and the tap is silent. Options:
      - hide it behind a feature flag (e.g. `VITE_ADS_ENABLED`) until ads are wired, or
      - wire ads properly: UMP consent → ATT prompt → `AdMob.initialize`, real ad
        unit IDs, `NSUserTrackingUsageDescription` + `SKAdNetworkItems` in
        Info.plist, real `APPLICATION_ID` in AndroidManifest (currently Google
        test IDs). Same applies to "Remove Ads" copy in the Starter Pack.
      (The reward-grant check itself was fixed — it now uses the Rewarded event.)
- [ ] **Confetti after leaving Win** keeps falling (up to 7 s) over the next
      screen on Play again / Done. Stop it on leave, or keep it?
- [ ] **Hidden "Reset progress" gesture** (3 s hold on the version text in
      Settings → About) ships in production and also wipes purchased hints.
      Keep, move behind a visible button, or remove from production?
- [ ] **Play button label on no-puzzle days** still says "▶ Play" (disabled).
      Show the countdown instead?

## Before launch

- [ ] Add the missing Spanish puzzle text **in the editor** (local
      `puzzles.json` is overwritten from prod on build). Then flip the Spanish
      check in `scripts/validate-puzzles.ts` from WARN to ERROR.
- [ ] Rename env vars if still using the old name: `VITE_REVENUECAT_API_KEY` →
      `VITE_RC_IOS_KEY` / `VITE_RC_ANDROID_KEY` (local `.env` and Cloudflare
      build settings).
- [ ] Deploy the hardened Worker (`pnpm deploy`) and confirm: game still loads
      puzzles; editor saves; `history/` snapshots appear in R2.
- [ ] Replace non-commercial fonts (DooM, Diablo, AmazDooM) and rename
      trademarked skins (§3.2).
- [ ] `og-image.png` is missing — every shared link has a broken preview (§2.5).

## Skin pass (planned)

- [ ] Disabled Play button on Void looks close to the "✓ Solved · Play again"
      state; Lumen's disabled state is very pale.
- [ ] Disabled styling for purchase buttons (hint store Buy, Starter Pack CTA).
      Keep the Share sheet's "Copied!" flash looking enabled.
- [ ] Everything in §2.4 (fewer, deeper skins; backdrop / tile / ribbon layers;
      picker redesign).

## Device-only checks (need an unmanaged machine)

- [ ] Android hardware Back closes sheets/dialogs first (Dev overlay ◀ Back
      covers the logic in the browser).
- [ ] Notifications fire / cancel.
- [ ] Purchases + restore (RevenueCat), rewarded ad grants a hint.
- [ ] Deep links / App Links open the app.
- [ ] Terminal & Phosphor locked on a real native build.
- [ ] App icon change + its status/error messages.
- [ ] iOS: iPhone stays portrait when rotated; iPad still rotates (Info.plist).
- [ ] TalkBack / VoiceOver on device announce "Found WORD. x of y words." on finds.

Live reload (Capacitor 8):
`npx cap run android --live-reload --host localhost --port 5173 --forwardPorts 5173:5173`
(USB) or `--host <mac-ip>` (Wi-Fi).
