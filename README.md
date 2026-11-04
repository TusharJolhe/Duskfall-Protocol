# Duskfall Protocol — 7 Minutes Left

> *"The last light is fading. You have seven minutes."*

**Duskfall Protocol** (*7 Minutes Left*) is a stylized low-poly 3D third-person survival and wave-defense game built with **Three.js**, **React 19**, and **TypeScript**. Designed for both **Android mobile browsers** and **desktop keyboard/mouse**, it challenges players to defend an emergency power generator inside an abandoned dusk settlement for an intense 7-minute (420-second) countdown.

---

## Game Overview & Objective

You are a lone survivor trapped inside **Settlement Sector 07** at dusk. A mysterious infection has drawn hostile creatures toward the settlement's central emergency power core.

Your objective is to **survive 7 minutes (07:00)** of active gameplay while protecting the central generator:
- **Victory**: Survive until the 420-second extraction countdown reaches `00:00` with both the survivor and the central generator intact.
- **Defeat**: Occurs if the survivor's health drops to `0` (`SURVIVOR OVERWHELMED`) or the central generator's integrity reaches `0%` (`EMERGENCY CORE DESTROYED`).

---

## Implemented Gameplay Features

- **Third-Person Over-the-Shoulder Camera & Combat**: Smooth spring-damped camera with obstacle collision avoidance, camera shake feedback, and synchronized 3D weapon barrel aiming.
- **Energy Pulse Rifle**:
  - `30`-round magazine with `120` maximum reserve energy cells (`1.5s` reload duration).
  - Center-reticle target lock-on assistance with real-time 3D projectile bolts, muzzle flash lighting, and impact bursts.
- **Three Hostile Enemy Archetypes**:
  - **Runner**: Fast, agile hostile that sprints toward the survivor and generator.
  - **Brute**: Large, heavily armored juggernaut with high health that prioritizes smashing the central generator using windup ground-slam attacks.
  - **Stalker**: Agile flanking creature that weaves and circles around the survivor before lunging in for rapid strikes.
- **7-Minute Progressive Wave Director**:
  - Seven 60-second threat phases (*Initial Contact*, *Perimeter Breach*, *Stalker Pack*, *Heavy Siege*, *Relentless Swarm*, *Critical Overload*, and *Final Minute — Total Eclipse*) with escalating spawn frequencies, aggression multipliers, and enemy compositions.
  - Decoupled active gameplay timer that pauses accurately when the game is paused and remains independent of frame-rate limits.
- **Dual-Mode Generator Defense & Repair**:
  - **Repair Kit (`Tap E` / `REPAIR`)**: Consumes `1` Repair Kit charge to immediately restore `+35%` generator integrity.
  - **Emergency Manual Repair (`Hold E` / `REPAIR` for `2.0s`)**: When out of Repair Kits, holding interact within `4.6m` of the generator channels an emergency repair restoring `+15%` integrity (`20s` cooldown).
- **Scavengeable Settlement Supplies**:
  - **Health Pack (Emerald)**: Restores `+35` Survivor HP (capped at `100`).
  - **Energy Cell (Cyan)**: Restores `+24` reserve ammunition (capped at `120`).
  - **Repair Kit (Amber)**: Grants `+1` generator repair charge.
  - Pickups feature bobbing/rotating beacons, automatic collection within `1.35m` (or manual collection within `2.65m`), timed respawns, and wave-start supply drops.
- **Stamina & Evasive Dodge Roll**:
  - Sprinting (`Shift` / `SPRINT`) and dodge rolling (`Space` / `DODGE`) consume stamina (`100` max, regenerating over time with an exhaustion recovery threshold).
  - Dodge rolls provide a fast directional burst and brief invulnerability frames.
- **Procedural Web Audio Synthesizer**:
  - Built-in Web Audio API sound engine generating laser pulse shots, enemy hit/kill effects, footsteps, generator alarms, supply pickups, and UI clicks with zero external audio asset dependencies.
- **Real Graphics Quality Presets & Performance Optimization**:
  - **LOW**: `70%` render scale, `30 FPS` cap (with physics sub-stepping), real-time shadows disabled, simplified lighting and foliage, reduced particle budget (`26`), and `8–10` max active enemies.
  - **MEDIUM**: `85%` render scale, `45 FPS` cap, `512×512` directional shadows, balanced foliage and lighting, `64` max particles, and `14–18` max active enemies.
  - **HIGH**: `100%` render scale (up to `1.5` DPR), `60 FPS` cap, `1536×1536` shadows, full instanced grass and decorative settlement props, volumetric streetlight cones, `120` max particles, and `22–25` max active enemies.
  - **Developer Performance Monitor**: Optional HUD overlay (toggleable in Settings, off by default) displaying live FPS, frame time (`ms`), active enemies, active particles, draw calls, and triangle count.

---

## Controls

### Desktop (Keyboard & Mouse)

| Input | Action |
| :--- | :--- |
| `W` `A` `S` `D` or `Arrow Keys` | Move survivor |
| `Left Shift` / `Right Shift` | Sprint (consumes stamina) |
| `Space` | Evasive dodge roll (consumes `26` stamina, brief invulnerability) |
| `Mouse Move` | Rotate third-person camera & aim (supports pointer lock on canvas click) |
| `Left Mouse Button` (Click / Hold) | Fire Energy Pulse Rifle |
| `R` | Reload energy magazine |
| `E` (Tap) | Use Repair Kit on generator (`+35%` HP) or collect nearby supply pickup |
| `E` (Hold `2.0s` near generator) | Channel Emergency Repair (`+15%` HP when at `0` Repair Kits) |
| `Escape` | Pause / Resume game |

### Android / Mobile Browser (Touch Controls)

| Control | Action |
| :--- | :--- |
| **Left Virtual Analog Stick** | 360° directional survivor movement |
| **SPRINT Button** | Toggle sprint mode on/off |
| **Right-Side Screen Drag** | Rotate third-person camera & aim |
| **FIRE Button** (Hold / Tap) | Continuous or single-shot Energy Pulse Rifle fire |
| **DODGE Button** | Perform evasive dodge roll |
| **RELOAD Button** | Reload energy magazine |
| **INTERACT / REPAIR Button** | Tap to collect supplies or use a Repair Kit; hold `2.0s` near generator for Emergency Repair |
| **PAUSE / AUDIO Buttons** | Pause simulation or toggle audio mute |

---

## Technology Stack

- **3D Rendering & Physics**: [Three.js](https://threejs.org/) (`v0.187`)
- **UI & HUD Layer**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (`@tailwindcss/vite`)
- **Audio**: Native Browser **Web Audio API** (procedural synthesis)
- **Build Tool & Dev Server**: [Vite 8](https://vite.dev/)

---

## Installation & Local Development

### Prerequisites
- **Node.js** `>= 18` or **Bun** `>= 1.0`

### 1. Clone the repository
```bash
git clone <your-github-repo-url>
cd duskfall-protocol
```

### 2. Install dependencies
Using npm:
```bash
npm install
```
Or using Bun:
```bash
bun install
```

### 3. Start the development server
```bash
npm run dev
```
The development server launches at `http://localhost:3000`.

---

## Build & Verification Commands

- **Production Build** (outputs static bundle to `dist/`):
  ```bash
  npm run build
  ```
- **Preview Production Build Locally**:
  ```bash
  npm run preview
  ```
- **TypeScript Type-Checking**:
  ```bash
  npm run lint
  ```

---

## Vercel Deployment Configuration

**Duskfall Protocol** is a pure client-side Vite application and deploys directly to Vercel with zero backend configuration required:

- **Framework Preset**: `Vite`
- **Root Directory**: `./`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Required Production Environment Variables**: None (the game runs entirely client-side using WebGL2 and Web Audio).

---

## Project Structure

```text
duskfall-protocol/
├── index.html                 # HTML entry point & viewport configuration
├── package.json               # Project metadata, scripts & dependencies
├── tsconfig.json              # TypeScript compiler configuration
├── vite.config.ts             # Vite bundler & dev server configuration
├── .env.example               # Environment variable template (placeholder values only)
├── .gitignore                 # Git ignore rules
└── src/
    ├── main.tsx               # React DOM root mount
    ├── App.tsx                # Top-level game container & state bridge
    ├── index.css              # Tailwind CSS v4 imports & typography styles
    ├── components/
    │   ├── GameHUD.tsx        # Tactical HUD, mobile touch controls & perf monitor
    │   └── MenuModals.tsx     # Main Menu, Settings, How to Play, Pause, Victory & Defeat modals
    └── game/
        ├── engine.ts          # Main loop, FPS limiter, telemetry & lifecycle coordinator
        ├── world.ts           # Low-poly settlement environment, lighting, foliage & quality scaling
        ├── player.ts          # Survivor hierarchy, movement, dodge roll & weapon orientation
        ├── camera.ts          # Over-the-shoulder third-person camera & collision clamping
        ├── combat.ts          # Aim raycasting, reticle lock-on & pooled energy projectiles
        ├── enemies.ts         # Pooled Runner, Brute & Stalker meshes, AI & attack systems
        ├── generator.ts       # Central generator core model, health state & dual repair logic
        ├── resources.ts       # Health Pack, Energy Cell & Repair Kit spawner & collection
        ├── waves.ts           # 7-minute (420s) wave progression & preset-aware enemy caps
        ├── particles.ts       # Pooled 3D particle bursts, shockwave rings & ambient dust motes
        ├── input.ts           # Unified desktop keyboard/mouse & mobile multi-touch input manager
        ├── audio.ts           # Procedural Web Audio API sound effects generator
        └── types.ts           # Shared TypeScript interfaces for game state, entities & telemetry
```

---

## Version & Development Status

- **Current Version**: `0.1.0 BETA`
- **Status**: Playable release featuring the complete 7-minute wave defense loop, three enemy archetypes (Runner, Brute, Stalker), dual-mode generator repair, supply scavenging, desktop and mobile touch controls, and `LOW` / `MEDIUM` / `HIGH` graphics quality presets.
