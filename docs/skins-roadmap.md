# Skins Roadmap

## Current skins (shipped)
All current skins are free and unlocked through gameplay/achievements.

| ID | Display name |
|---|---|
| void | Void |
| synthwave | Synthwave |
| gameboy | Dot Matrix |
| terminal | Terminal |
| crimson | Crimson |

---

## Candidate skins

### Classic PC Games
Audience: 90s PC gamers. Strong pack identity.

- **Phobos** — Doom-inspired. Near-black with brownish warmth, blood red accent, rusty orange secondary, sickly green for found words. Use the Doom pixel font (self-hosted) or Press Start 2P. Name: Phobos (the moon where it starts).
- **Inferno** — Diablo-inspired. Dark crimson + gold, hellfire feel, ornate. Goes harder than Crimson.
- **Zerg** — StarCraft-inspired. Toxic green on deep purple, very alien. Wild palette.
- **Siege** — Warcraft-inspired. Earthy browns, parchment, blue magic accents. Fantasy RTS feel.

### Nintendo Consoles
Safe angle: reference the hardware aesthetic, not the brand name.

- **Dot Matrix** *(already shipped)* — Game Boy green LCD palette.
- **Pastel** — SNES-inspired. Soft lavender/purple tones, warm greys, gentle gradients.
- **Pak64** — N64-inspired. Darker grey, primary color accents (red/yellow/green/blue from the controller buttons).
- **Famicom** — NES/Famicom-inspired. Flat grey/black with red and gold accents.

### Old Terminals
Audience: developers, retro computing enthusiasts. Very coherent aesthetic.

- **Terminal** *(already shipped)* — Green phosphor on black.
- **Phosphor** — Amber/orange on black. Apple IIe / Fallout terminal feel. Distinct from Terminal.
- **Matrix** — Green rain on black. Brighter, more saturated than Terminal. Cascading feel.
- **BIOS** — Blue screen / early PC BIOS. Electric blue on dark navy, white text. Chunky.

### Dreamcast Era (32/64-bit consoles)
The underserved nostalgia generation.

- **Spirit** — Dreamcast-inspired. Clean orange swirl energy, light grey, optimistic. Very different from the dark skins.
- **Polygon** — PS1-inspired. Cool grey + triangle/circle/cross/square button colors as accents (pink, red, blue, green).
- **Copper** — PS2-inspired. Dark grey with warm copper/bronze accents. Very 2000s.
- **Saturn** — Sega Saturn. Dark grey with a slightly warmer tone, white and muted blue accents.

### Sci-Fi / Modern Games
Riskier on IP but palettes are just colors.

- **Aperture** — Portal-inspired. Clean white + safety orange + electric blue. Modern, minimal.
- **Underworld** — Hades-inspired. Deep dark bg, gold accents, red energy. Stunning contrast.
- **Hollow** — Hollow Knight-inspired. Pale grey/blue on near-black, delicate and eerie.
- **Celeste** — Deep blue/midnight + warm pink. Emotional, clean.

### Neon / Arcade
Colorful, playful, broad appeal.

- **Cobalt** — Sega-blue energy. Punchy, saturated royal blue.
- **Vector** — Arcade vector graphics. Neon outlines on black, Tron/Asteroids feel.
- **Indigo** — Translucent purple plastic, GBA SP / iMac G3 era. Frosted aesthetic.
- **Cabinet** — Classic arcade. Pac-Man yellow, deep black, scanline feel.

### Nature / Ambient
For players who want something calmer.

- **Arctic** — Ice blue and white. Cold, clean, minimal.
- **Obsidian** — Volcanic black with deep orange lava accents.
- **Verdant** — Deep forest green, earthy, warm. Not pixel-y — more organic.

---

## Pack ideas (to define later)
- Packs bundle 3–4 thematically related skins at a discount vs buying individually.
- Individual skin: ~$1.99. Pack: ~$3.99–$4.99. All packs bundle: ~$9.99.
- Free/base skins (Void, maybe one more) serve as the hook.

## Font pairings to explore
- **Press Start 2P** (Google Fonts, already bundled) — pixel, great for retro hardware skins
- **Cinzel** (OFL, Google Fonts, `@fontsource/cinzel`) — Roman inscriptional capitals. Classical, weighty, mythological. In use for Underworld. First choice for any ancient/fantasy/mythology skin.
- **AmazDooMRight / AmazDooMRight2** (license TBD — in use for Phobos wordmark, verify before shipping paid skin) — Doom title-style font, self-hosted TTF in `src/fonts/amazdoom-cdnfonts/`
- **DooM** (license TBD — in use for Phobos tiles, verify before shipping paid skin) — authentic Doom HUD pixel font, self-hosted TTF in `src/fonts/DooM.ttf`
- **Orbitron** (Google Fonts, already bundled) — sci-fi, good for Aperture/Cobalt
- **UnifrakturMaguntia** (Google Fonts) — gothic/blackletter, good for Inferno
- **VT323** (Google Fonts, already bundled in Terminal) — terminal/retro
- **Russo One** — heavy display, good for arcade/Phobos title treatment

## Font licensing policy
- **OFL (SIL Open Font License) only** — free forever, commercial use allowed.
- Self-host via `@font-face` in `skins.css`, bundled through Vite like existing fonts.
- Keep the font's LICENSE file in the repo.
- Add an "Open Source Licenses" entry in the app's Settings screen — no credits screen needed.
- Do NOT use fonts with ambiguous licenses (e.g. AmazDooM — conflicting CC/commercial claims), even if they look free. Not worth the risk on paid content.
