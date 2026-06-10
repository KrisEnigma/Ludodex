# Skins Roadmap

## Current skins (shipped)
All current skins are **free** (`productId: null`); Neon Horizon & Dot Matrix also
unlock via achievement on native. **33 skins ship.** All are built on the
10-token semantic model with cascade shield (see `docs/making-skins.md §1`).

| ID | Display name | Theme |
|---|---|---|
| void | Void | dark — baseline (cyan), Space Mono |
| lumen | Lumen | light — Void's OS-theme twin |
| neon-horizon | Neon Horizon | dark — retrowave; achieve solve_10 |
| laser-vector | Laser Vector | dark — vector arcade |
| maze-chase | Maze Chase | dark — Pac-Man |
| swarm | Swarm | dark — Space Invaders |
| phantom-thieves | Phantom Thieves | dark — Persona 5 red/black |
| catalyst | Catalyst | dark — Portal |
| paleblood | Paleblood | dark — Bloodborne moon/violet |
| aero | Aero | dark — Windows Vista glass |
| star-hunter | Star Hunter | dark — Metroid / space |
| relic-gold | Relic Gold | dark — Diablo gold |
| puff-star | Puff Star | dark — Kirby pastel |
| mushroom-kingdom | Mushroom Kingdom | dark — Mario; achieve streak_30 |
| cape-16bit | 16-Bit Cape | dark — Batman SNES-era |
| blue-blur | Blue Blur | dark — Sonic |
| dragon-heat | Dragon Heat | dark — Dragon's Lair fire |
| radio-tag | Radio Tag | dark — Jet Set Radio graffiti |
| cyber-shinobi | Cyber Shinobi | dark — Shinobi neon |
| gameboy | Dot Matrix | dark — Game Boy LCD; achieve streak_30 |
| terminal | Terminal | dark — amber CRT; VT323 |
| phosphor | Phosphor | dark — green CRT; VT323 |
| bios | BIOS | dark — PC BIOS blue; VT323 |
| super-16-bit-lilac | Super 16-Bit Lilac | dark — SNES lavender; Silkscreen |
| toaster | Toaster | dark — NES grey/red |
| lord-of-terror | Lord of Terror | dark — Diablo gold/fire; Cinzel + Diablo* |
| test-chamber | Test Chamber | light — Portal blue/orange; Oswald |
| polygon | Polygon | light — Sony PS1 |
| ring-of-light | Ring of Light | light — Xbox 360; Oswald |
| dream-spiral | Dream Spiral | light — Sega Dreamcast |
| rip-tear | Rip & Tear | dark — Doom; DooM* + AmazDooMRight2* |
| blood-darkness | Blood & Darkness | dark — Hades gold/violet; Cinzel |
| crimson | Crimson | dark — molten red; Orbitron |

\* self-hosted font.

**Void ⟷ Lumen** are wired as the OS-theme auto-default (light devices boot Lumen).

---

## Candidate skins

### Classic PC Games
Audience: 90s PC gamers. Strong pack identity.

- **Phobos** *(shipped)* — Doom-inspired. Near-black with brownish warmth, blood red accent, rusty orange secondary, sickly green for found words. Use the Doom pixel font (self-hosted) or Press Start 2P. Name: Phobos (the moon where it starts).
- **Inferno** *(shipped)* — Diablo-inspired. Dark crimson + gold, hellfire feel, ornate. Goes harder than Crimson.
- **Zerg** — StarCraft-inspired. Toxic green on deep purple, very alien. Wild palette.
- **Siege** — Warcraft-inspired. Earthy browns, parchment, blue magic accents. Fantasy RTS feel.

### Nintendo Consoles
Safe angle: reference the hardware aesthetic, not the brand name.

- **Dot Matrix** *(already shipped)* — Game Boy green LCD palette.
- **Pastel** *(shipped)* — SNES-inspired. Soft lavender/purple tones, warm greys, gentle gradients.
- **Pak64** — N64-inspired. Darker grey, primary color accents (red/yellow/green/blue from the controller buttons).
- **Famicom** — NES/Famicom-inspired. Flat grey/black with red and gold accents. *(Shipped as **Toaster** — charcoal + red, the front-loader nickname.)*

### Old Terminals
Audience: developers, retro computing enthusiasts. Very coherent aesthetic.

- **Terminal** *(already shipped)* — Green phosphor on black.
- **Phosphor** — Amber/orange on black. Apple IIe / Fallout terminal feel. Distinct from Terminal.
- **Matrix** — Green rain on black. Brighter, more saturated than Terminal. Cascading feel.
- **BIOS** *(shipped)* — Blue screen / early PC BIOS. Electric blue on dark navy, white text. Chunky.

### Dreamcast Era (32/64-bit consoles)
The underserved nostalgia generation.

- **Spirit** *(shipped)* — Dreamcast-inspired. Clean orange swirl energy, light grey, optimistic. Very different from the dark skins.
- **Polygon** *(shipped)* — PS1-inspired. Cool grey + triangle/circle/cross/square button colors as accents (pink, red, blue, green).
- **Copper** — PS2-inspired. Dark grey with warm copper/bronze accents. Very 2000s.
- **Saturn** — Sega Saturn. Dark grey with a slightly warmer tone, white and muted blue accents.

### Sci-Fi / Modern Games
Riskier on IP but palettes are just colors.

- **Aperture** *(shipped — first light skin)* — Portal-inspired. Clean white + safety orange + electric blue. Modern, minimal.
- **Underworld** *(shipped)* — Hades-inspired. Deep dark bg, gold accents, red energy. Stunning contrast.
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
Bundled via `@fontsource` (in `main.ts`): Space Mono, Orbitron, Press Start 2P,
Silkscreen, VT323, Cinzel, **Oswald**. Self-hosted via `@font-face` in `skins.css`
(files in `src/fonts/`): DooM, AmazDooM*, **Diablo**.

- **Press Start 2P** (bundled) — pixel; in use for Dot Matrix + Toaster tiles.
- **Silkscreen** (bundled) — finer pixel; Pastel (tiles+wordmark), Dot Matrix/Toaster wordmark.
- **Cinzel** (OFL, `@fontsource/cinzel`) — Roman inscriptional caps. In use for Underworld and Inferno **tiles**. First choice for any ancient/fantasy/mythology skin.
- **Oswald** (OFL, `@fontsource/oswald`) — condensed industrial signage. In use for Aperture + Ring. Good for clean/console/modern skins.
- **VT323** (bundled) — terminal/retro; in use for Terminal, Phosphor, BIOS.
- **Orbitron** (bundled) — sci-fi; in use for Neon Horizon, Crimson.
- **Diablo** (self-hosted `.woff`, license **UNVERIFIED**) — ornate dark-fantasy caps; in use for the Inferno **wordmark** (Cinzel handles its tiles). Keep Inferno free until the license is confirmed.
- **AmazDooMRight / AmazDooMRight2** (license TBD — Phobos wordmark) — Doom title-style, self-hosted TTF in `src/fonts/amazdoom-cdnfonts/`.
- **DooM** (license TBD — Phobos tiles) — authentic Doom HUD pixel font, `src/fonts/DooM.ttf`.
- **UnifrakturMaguntia** (Google Fonts) — gothic/blackletter, an alternative for Inferno if a verified-OFL face is wanted.
- **Russo One** — heavy display, good for arcade/Phobos title treatment.

## Font licensing policy
- **OFL (SIL Open Font License) only** — free forever, commercial use allowed.
- Self-host via `@font-face` in `skins.css`, bundled through Vite like existing fonts.
- Keep the font's LICENSE file in the repo.
- Add an "Open Source Licenses" entry in the app's Settings screen — no credits screen needed.
- Do NOT use fonts with ambiguous licenses (e.g. AmazDooM — conflicting CC/commercial claims), even if they look free. Not worth the risk on paid content.
