# .well-known/ — Deep linking association files

These files MUST be served at the exact paths below for native deep linking
to work. Vite copies the entire `public/` directory to `dist/` at build time,
so they end up at the right URLs when the SPA is deployed.

## Android — `assetlinks.json`

**Served at:** `https://glitchsalad.krisenigma.com/.well-known/assetlinks.json`
**Content-Type:** `application/json` (no charset)

Replace `REPLACE_WITH_SHA256_FINGERPRINT_FROM_PLAY_CONSOLE` with the SHA-256
fingerprint of your **release** signing certificate. Two ways to get it:

1. **Play Console** (recommended): App → Setup → App integrity → App signing →
   copy the SHA-256 certificate fingerprint. This is the canonical one
   because Google re-signs your APK with their own key when you use Play
   App Signing.
2. **Local keystore** (if you sign your own APKs):
   ```
   keytool -list -v -keystore /path/to/release.keystore -alias <alias>
   ```
   Copy the value next to `SHA256:`. Remove the colons — the JSON format
   wants `AA:BB:CC...` literally, so keep the colons in the JSON.

After deploying, verify with:
```
curl -I https://glitchsalad.krisenigma.com/.well-known/assetlinks.json
```
Expect: `HTTP/2 200`, `content-type: application/json`.

Then verify Android can read it:
```
adb shell pm verify-app-links --re-verify app.glitchsalad.game
adb shell pm get-app-links app.glitchsalad.game
```

When the verification succeeds, tapping a `https://glitchsalad.krisenigma.com/123`
link from any other app (Messages, Slack, Gmail) opens GlitchSalad directly.

## iOS — `apple-app-site-association` (deferred)

The iOS native project isn't scaffolded yet (`capacitor add ios` hasn't been
run). When it is, an AASA file will go here too. Format reminder:

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["TEAMID.app.glitchsalad.game"],
        "components": [
          { "/": "/*", "comment": "Match all paths" }
        ]
      }
    ]
  }
}
```

**Served at:** `https://glitchsalad.krisenigma.com/.well-known/apple-app-site-association`
**Content-Type:** `application/json` (no `.json` extension — iOS is picky)

iOS requires `TEAMID` to be your Apple Developer Team ID, which Xcode prints
in the Signing & Capabilities tab for the target. Also requires enabling the
Associated Domains capability and adding `applinks:glitchsalad.krisenigma.com`
to the entitlements file.
