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
- [x] **Confetti after leaving Win** keeps falling (up to 7 s) over the next
      screen on Play again / Done. Decided (Oct 1 2026): keep it.
- [x] **Hidden "Reset progress" gesture** replaced (Oct 1 2026) by a visible
      "Reset stats" button under Settings → About, with a confirm. Keeps the
      hint balance (incl. purchased) and today's ad-grant count; an earned skin
      that re-locks falls back to Void. The dev overlay ⟲ Reset still wipes all.
- [x] **Play button label on no-puzzle days** now shows a live "Next puzzle in
      h:mm:ss" (inactive style); the card head drops its duplicate countdown.

## Before launch

- [ ] Add the missing Spanish puzzle text **in the editor** (local
      `puzzles.json` is overwritten from prod on build). Then flip the Spanish
      check in `scripts/validate-puzzles.ts` from WARN to ERROR.
- [ ] Rename env vars if still using the old name: `VITE_REVENUECAT_API_KEY` →
      `VITE_RC_IOS_KEY` / `VITE_RC_ANDROID_KEY` (local `.env` and Cloudflare
      build settings).
- [x] Deploy the hardened Worker (`pnpm run deploy`, Oct 1 2026) and confirm: game still loads
      puzzles; editor saves; `history/` snapshots appear in R2.
- [ ] Replace non-commercial fonts (DooM, Diablo, AmazDooM) and rename
      trademarked skins (§3.2).
- [ ] Rewrite skin descriptions that quote games verbatim ("This was a triumph",
      "Stay a while and listen", "Rip and tear until it is done", "Gotta go fast",
      "Seek Paleblood…", "It's showtime", "Wakka wakka"…) — evoke, don't quote.
- [x] `og-image.png` added (1200×630, Void style). After deploying, re-check link
      previews (e.g. opengraph.xyz) — some apps cache old previews for days.

## Skin pass (done Oct 1 2026)

- [x] Disabled buttons: one dashed-outline "inactive" look for every skin (Play
      on no-puzzle days, busy purchase buttons); the Share "Copied!" flash keeps
      its enabled look (`data-flash`).
- [x] §2.4, revised with Kris: all 33 skins kept and individually reworked
      (evoke through colour/type, no overlays on text or selections); layer
      tokens; dev skin gallery (`?skins`); picker = mini-screen cards grouped
      Yours / Earn / Buy with unlock progress.
- [ ] Optional later: per-skin sound presets (§2.4), find / endgame FX variants.

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
- [ ] Low-end Android: long swipes feel smooth (hit-testing now measures once per gesture).

Live reload (Capacitor 8):
`npx cap run android --live-reload --host localhost --port 5173 --forwardPorts 5173:5173`
(USB) or `--host <mac-ip>` (Wi-Fi).
