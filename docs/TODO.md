# Ludodex — path to publish

Everything left is manual: accounts, IDs, content, device checks, store
listings. Work top to bottom; each section unblocks the next. The code side is
done (see "Done" at the end). Rationale for older items lives in
`docs/audit-2026-09-30.md`.

Secrets never go in the repo or in chat: signing keys, keystore passwords,
account logins. Public IDs (AdMob app/unit IDs, RevenueCat public SDK keys,
Team ID, cert fingerprints) are fine to commit.

---

## 1. Content

- [ ] Write the puzzles: at least 60 ahead of launch, plus a 7-day starter
      archive (launch day = day 8).
- [ ] Spanish puzzle text for every puzzle, **in the editor** (local
      `puzzles.json` is overwritten from prod on build). Then flip the Spanish
      check in `scripts/validate-puzzles.ts` from WARN to ERROR.
- [ ] Pick the launch date and set `VITE_LAUNCH_DATE` = launch − 7 days
      (local `.env` and the Cloudflare build settings).

## 2. Accounts and agreements

- [ ] **Apple Developer Program** (paid). In App Store Connect: sign the Paid
      Apps agreement, add tax and banking (purchases don't work without it).
- [ ] **Google Play Console** developer account. Personal accounts created
      after Nov 2023 must run a **closed test with 12+ testers for 14 days**
      before production access, so start this early.
- [ ] **AdMob** account (link it to both stores' apps once they exist).
- [ ] **RevenueCat** project with an iOS and an Android app.
- [ ] Optional: **Sentry** project (crash reports) and **PostHog** project
      (analytics). Leave the env vars blank to ship without them.

## 3. Store products

- [ ] Create the products in **App Store Connect** and **Play Console**, ids
      exactly as in `src/services/IAPService.ts` → `PRODUCT_IDS`:
  - consumables: `hints_10`, `hints_50`, `hints_200`, `starter_pack`
  - non-consumables: `remove_ads`, `skin_neon_horizon`, `skin_gameboy`,
    `skin_ring_of_light`, `skin_mushroom_kingdom`, `skin_bundle`
  - not sold for now: `skin_lord_of_terror` (font licence, see §8)
  - fallback prices in code: hints $0.99 / $2.99 / $7.99, starter pack
    $2.99, remove ads $2.99, skins $1.99, bundle $2.99
- [ ] **RevenueCat**: import the products; create one **entitlement per
      non-consumable, named exactly like the product id** (the code checks
      `entitlements.active[productId]`). Starter pack grants the `remove_ads`
      and `skin_neon_horizon` entitlements. Put **every** product, consumables
      included, in the **current offering** (purchase looks packages up there).

## 4. Fill in IDs and config

- [ ] **AdMob**: create two apps (iOS, Android) and four ad units (rewarded +
      interstitial per platform).
  - App IDs (`ca-app-pub-…~…`) → `android/app/src/main/AndroidManifest.xml`
    (`com.google.android.gms.ads.APPLICATION_ID`) and `ios/App/App/Info.plist`
    (`GADApplicationIdentifier`).
  - Unit IDs → the four `VITE_ADMOB_*` vars; set `VITE_ADMOB_USE_TEST_IDS=false`
    for release builds only.
  - Privacy & messaging: publish a **GDPR message** (EEA/UK; without it EEA
    users get no ads) and an **IDFA explainer** (iOS).
- [ ] **RevenueCat** public SDK keys → `VITE_RC_IOS_KEY` (`appl_…`),
      `VITE_RC_ANDROID_KEY` (`goog_…`). Rename any old `VITE_REVENUECAT_API_KEY`
      in local `.env` and Cloudflare build settings.
- [ ] Optional: `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY`.
- [ ] **Deep links**
  - iOS: Apple Team ID → replace `REPLACE_WITH_TEAM_ID` in
    `public/.well-known/apple-app-site-association`; enable **Associated
    Domains** on the App ID (`app.ludodex.game`) in the developer portal.
  - Android: release signing SHA-256 (Play Console → App integrity) →
    `public/.well-known/assetlinks.json`.
- [ ] **Cloud save (iOS)**: enable **iCloud** on the App ID with
      **Key-value storage** (developer portal, and in Xcode → Signing &
      Capabilities → + iCloud → tick "Key-value storage"). The entitlement is
      already in `App.entitlements`.
- [ ] **`public/app-ads.txt`** with the line AdMob gives you; set
      `https://ludodex.krisenigma.com` as the developer website in both stores.
- [ ] **Privacy policy** (`public/privacy.html`): it covers AdMob
      interstitials, Sentry, PostHog, notifications. Add rewarded ads, the
      consent form / "Ad privacy choices", tracking (ATT), and that the save
      is backed up to the player's own iCloud / Google backup.
- [ ] **iOS `PrivacyInfo.xcprivacy`** for the app (UserDefaults via
      Preferences is a "required reason" API; Google's and RevenueCat's SDKs
      ship their own manifests).
- [ ] Optional: Spanish ATT prompt text via `es.lproj/InfoPlist.strings`
      (add the file to the Xcode project).
- [ ] Deploy the Worker + web build (`pnpm run deploy`) so the `.well-known`
      files, `app-ads.txt` and the privacy page are live. Re-check link
      previews (e.g. opengraph.xyz).

## 5. Native builds

- [ ] `pnpm install && npx cap sync` after any dependency change; check
      `ios/App/CapApp-SPM/Package.swift` lists RevenueCat and Sentry.
- [ ] **iOS**: set your signing team in Xcode (Signing & Capabilities), confirm
      the Associated Domains capability shows `applinks:ludodex.krisenigma.com`.
      Archive → upload to App Store Connect → **TestFlight** (no USB needed;
      TestFlight uses the purchase sandbox).
- [ ] **Android**: create an upload keystore (keep it and its passwords out of
      the repo, back it up), build a signed release AAB, upload to **Play
      internal testing**, then the 12-tester closed test. Add yourself as a
      **license tester** so purchases don't charge. Bump `versionCode` in
      `android/app/build.gradle` on every upload. Optional: turn on
      `minifyEnabled` once a release build is verified.
- [ ] If the work Mac blocks signing or uploads: a cloud build (Codemagic,
      Xcode Cloud, GitHub Actions) with the signing keys stored as that
      service's secrets, never in the repo.

## 6. Device checks (TestFlight / internal testing)

- [ ] **Ads**: consent form shows in the EEA (test with
      `debugGeography: EEA` + your test device ID), ATT prompt after the
      tutorial; rewarded ad grants exactly 1 hint; interstitial every 2nd
      solve, max 2 per launch; Remove Ads skips it; Play Again's timer starts
      only after the ad closes; "Ad privacy choices" appears in Settings (EEA).
- [ ] **Purchases**: buy a skin, a hint pack and the Starter Pack (exactly 30
      hints, once); Ask to Buy / pending payment in sandbox unlocks later;
      restore purchases on a second device; prices show in local currency.
- [ ] **Deep links**: a `/<day>` link opens that puzzle in the app;
      `/privacy` opens in the browser. Also after choosing an alternate app
      icon on Android (it disables `MainActivity`, which holds the link filter).
- [ ] **Share** attaches the PNG card (and still sends text if it can't).
- [ ] **Cloud save**: first build compiles `CloudSavePlugin.swift`. Solve a
      puzzle, buy something, background the app; delete and reinstall (or a
      second iPhone on the same Apple ID) → progress, streak, skin and hints
      come back (may take a few seconds; the app reloads once). "Reset stats"
      stays reset after a reinstall. Android: `adb shell bmgr backupnow
      app.ludodex.game`, reinstall, check the save is restored.
- [ ] Notifications fire and cancel.
- [ ] Android hardware Back closes sheets/dialogs first.
- [ ] Terminal & Phosphor stay locked until earned.
- [ ] App icon change + its status/error messages.
- [ ] iPhone stays portrait; iPad still rotates.
- [ ] VoiceOver / TalkBack: board, tiles and hint slots are labelled; finds
      announce "Found WORD. x of y words."
- [ ] Low-end Android: long swipes feel smooth.

Live reload (when a device can connect):
`npx cap run android --live-reload --host localhost --port 5173 --forwardPorts 5173:5173`
(USB) or `--host <mac-ip>` (Wi-Fi).

## 7. Store listings and review

- [ ] Both stores: name, subtitle / short description, full description
      (EN + ES), keywords, category (Word / Puzzle), support URL, privacy
      policy URL (`https://ludodex.krisenigma.com/privacy`), screenshots for
      the required device sizes, app icon.
- [ ] **App Store**: privacy labels (AdMob: device ID, advertising data,
      diagnostics; tracking = yes if ATT can be granted; plus Sentry/PostHog if
      enabled), age rating, IAP products attached to the first version with
      review screenshots.
- [ ] **Play**: Data safety form (same data as above), content rating
      questionnaire, target audience, "Contains ads" declaration, ads ID
      declaration.
- [ ] Submit for review; once approved, release on the launch date so day 8
      lines up with `VITE_LAUNCH_DATE`.

## 8. After launch / optional

- [ ] Drop `patches/@capacitor-community__admob@8.0.0.patch` (and its line in
      `pnpm-workspace.yaml`) once AdMob ships a release without
      `proguard-android.txt` (still there in 8.1.0). The AGP "option setting …
      is deprecated" warnings come from Capacitor 8's compatibility flags in
      `android/gradle.properties`; leave them until Capacitor's next major.

- [ ] Once the app earns ~$50: license **Exocet Heavy** (Emigre app + web
      licence) for Lord of Terror's wordmark, then make it purchasable again
      (`productId` + `bundleProductId` in `src/skins/registry.ts`). Rip & Tear's
      DooM/AmazDooM fan fonts stay an accepted risk (no licensable original).
- [ ] Optional: live sync between devices (merge progress) on top of the
      cloud backup.
- [ ] Per-skin sound presets, find / endgame FX variants.

---

## Done (Oct 1–2 2026, for reference)

- Ads wired: consent → ATT → AdMob; rewarded hint + win-exit interstitials;
  dev "Native player" mode fakes ads.
- IAP: earn-or-buy skins, store prices, pending purchases, consumable ledger,
  cancel detection; RevenueCat 13.7 + Sentry Capacitor 4.4 (SPM).
- Cloud save (restore on reinstall / new phone): iOS iCloud key-value store
  via `CloudSavePlugin.swift` + `CloudSaveService.ts`; Android Auto Backup
  scoped to the Preferences file.
- Native share sends the PNG card; deep-link plumbing (scoped Android filter,
  iOS entitlements, AASA served as JSON).
- Keyboard play (arrows + Space) and accessibility labels; hint UX and
  tutorial rebuilt from real game pieces.
- Skin pass (33 skins), 4 trademarked skins renamed, quoted descriptions
  rewritten; fonts kept by decision.
- Visible "Reset stats" (keeps hints); live countdown on no-puzzle days;
  confetti after Win kept by decision.
- Hardened Worker deployed; `og-image.png` added.
