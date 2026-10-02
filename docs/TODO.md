# Ludodex — TODO (parked for later)

Deferred items from the Sep 2026 audit / fix pass. Details and rationale live in
`docs/audit-2026-09-30.md` (section noted per item).

## Decisions needed

- [x] **Ads wired (code, Oct 1 2026)** (§3.3). Rewarded "+1 hint" and win-exit
      interstitials (every 2nd solve, max 2 per launch, skipped with Remove Ads).
      `initAds()`: AdMob.initialize → UMP consent (form if required) → iOS ATT →
      ads only if `canRequestAds`. Runs at boot for returning players and at the
      end of the tutorial on first launch. The "Watch ad" button only shows once
      ads are ready; Settings shows "Ad privacy choices" when UMP requires it.
      The next screen's timer waits until an interstitial is dismissed. Info.plist
      has `NSUserTrackingUsageDescription` + Google's SKAdNetwork list.
      Dev "Native player" mode fakes both ad types with a plain card.

### Ads — release checklist (Kris, needs accounts / device)

- [ ] AdMob: create the two apps (iOS, Android) and four ad units (rewarded +
      interstitial per platform).
- [ ] Put the real **app IDs** (`ca-app-pub-…~…`) in `AndroidManifest.xml`
      (`APPLICATION_ID`) and `Info.plist` (`GADApplicationIdentifier`). They're
      public identifiers, not secrets.
- [ ] Release build env: `VITE_ADMOB_USE_TEST_IDS=false` + the four
      `VITE_ADMOB_*` unit IDs (see `.env.example`).
- [ ] AdMob → Privacy & messaging: publish a **GDPR message** (EEA/UK) and an
      **IDFA explainer** (iOS). Without the GDPR message, EEA users get no ads.
- [ ] `app-ads.txt` at https://ludodex.krisenigma.com/app-ads.txt with the
      line AdMob gives you (`public/app-ads.txt`), and the same domain as the
      developer website in both stores.
- [ ] Privacy policy (/privacy): mention AdMob, advertising ID, consent.
- [ ] App Store privacy labels + Play Data safety form: AdMob data (device
      ID, advertising data, diagnostics); "tracking" = yes on iOS if ATT allowed.
- [ ] iOS `PrivacyInfo.xcprivacy` for the app (Google's SDK ships its own).
- [ ] Optional: Spanish ATT text via `es.lproj/InfoPlist.strings` (needs adding
      to the Xcode project).
- [ ] Device test: consent form with `debugGeography: EEA` + test device ID,
      ATT prompt, rewarded grants exactly 1 hint, interstitial every 2nd solve,
      Remove Ads skips it, Play Again timer starts after the ad closes.

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
- [x] Non-commercial fonts (DooM, AmazDooM → Rip & Tear; Diablo → Lord of
      Terror): **kept as-is by decision (Oct 1 2026)**, accepted risk. Revisit once
      the app earns ~$50: Lord of Terror → license Exocet Heavy (Emigre app +
      web licence; the real Diablo base face, O-with-cross included). Rip & Tear
      has no licensable original (custom logo art); fan fonts only.
- [x] Renamed trademarked skins (Oct 1 2026): Hyrule Vault → Ancient Shrine,
      Mushroom Kingdom → Pipe Dream, Phantom Thieves → Masquerade, Cyber
      Shinobi → Night Blade (ids unchanged). Paleblood, Lord of Terror, Rip & Tear and
      Blue Blur stay (not trademarks).
- [x] Skin descriptions that quoted games rewritten to evoke instead (EN + ES).
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
- [ ] Deep links / App Links open the app. Code side done (Oct 1 2026):
      Android intent filter limited to `/`, `/<day>`, `/p/…`; iOS
      `App.entitlements` (applinks:ludodex.krisenigma.com) wired in both build
      configs; `public/.well-known/apple-app-site-association` (served as JSON by
      the Worker). Kris: replace `REPLACE_WITH_TEAM_ID` (AASA) and the SHA-256 in
      `assetlinks.json` (Play Console → App integrity), enable Associated Domains
      for the App ID, deploy, then test on device.
- [ ] Share on native sends the PNG card (Filesystem cache → Share `files`).
      Needs `pnpm add @capacitor/filesystem` + `npx cap sync`; check on device.
- [ ] Terminal & Phosphor locked on a real native build.
- [ ] App icon change + its status/error messages.
- [ ] iOS: iPhone stays portrait when rotated; iPad still rotates (Info.plist).
- [ ] TalkBack / VoiceOver on device announce "Found WORD. x of y words." on finds.
- [ ] Low-end Android: long swipes feel smooth (hit-testing now measures once per gesture).

Live reload (Capacitor 8):
`npx cap run android --live-reload --host localhost --port 5173 --forwardPorts 5173:5173`
(USB) or `--host <mac-ip>` (Wi-Fi).
