# 7 MINUTES LEFT — Third-Person 3D Survival & Wave Defense

A stylized low-poly 3D third-person survival and wave-defense game set in an abandoned settlement at dusk, where a lone survivor must defend an emergency power generator against escalating waves of infected creatures for an exact 420-second (7-minute) countdown across both Android mobile touchscreens and desktop keyboard/mouse controls.

### User Review & Critical Decisions

> [!IMPORTANT]
> Updated to incorporate the **3-Phase Incremental Implementation & Verification Strategy** and **Decoupled Active Gameplay Countdown vs. Clamped Physics Delta**:

- **Incremental 3-Phase Execution & Verification**:
  - **Phase 1 — Playable Core**: Three.js dusk settlement environment, articulated survivor character, third-person over-the-shoulder camera, desktop + mobile virtual controls, basic shooting & hit detection, functional Runner enemy AI, generator health & enemy attacks, 420s countdown, and Pause / Defeat / Victory states. Verify compilation and core loop before expanding.
  - **Phase 2 — Gameplay Expansion**: Layer in Brute and Stalker enemy archetypes, collectible resource pickups (`Health Pack`, `Energy Cell`, `Repair Kit`), generator repair mechanics, progressive 7-minute wave director, and full ammunition + stamina management without rewriting Phase 1 foundations.
  - **Phase 3 — Visual and Technical Polish**: Complete cinematic Main Menu, tactical HUD notifications and warnings, procedural limb/generator animations and pooled particle effects, Web Audio synthesizer soundscape, and `LOW` / `MEDIUM` / `HIGH` Android graphics optimization.
- **Decoupled Countdown Timing vs. Physics Delta**:
  - **Active Gameplay Timer**: The 420-second countdown accumulates real elapsed active gameplay time (`activeElapsed += rawDelta` strictly while in `PLAYING` state, capped only against tab-suspension jumps) so the 7-minute clock remains accurate regardless of frame rate and freezes immediately when paused.
  - **Clamped Simulation Step**: Movement, steering, projectile kinematics, and animations use a separately clamped simulation delta (`simDelta = Math.min(rawDelta, 0.05)`) so frame spikes never cause physics tunneling or collision failure.

---

### 1. Overview & Core Concept

- **What It Does**: Places the player in a tense, atmospheric dusk settlement surrounding an emergency power core. Over a real-time 7-minute (420-second) countdown divided into 7 escalating wave phases, hostile creatures (**Runners**, **Brutes**, and **Stalkers**) converge on the player and the central generator. The player moves, sprints, dodges, shoots, reloads, collects supply pickups (**Health Packs**, **Energy Cells**, **Repair Kits**), and repairs the generator until the clock hits `00:00`.
- **Target Audience / Persona**: Mobile browser gamers on Android devices (landscape-first responsive touch controls) as well as desktop players using `WASD` + Mouse controls.
- **Key Value**: Delivers a complete, self-contained 3D action-survival loop with zero external asset dependencies, procedural composite 3D models, Web Audio synthesizer sound effects, and adaptive graphics quality tiers (`LOW`, `MEDIUM`, `HIGH`) tailored for 30–60 FPS stability.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Cinematic Title Screen (`MAIN MENU`)**: Live 3D background camera slowly orbiting the dusk settlement with the glowing central generator, warm orange streetlights, and drifting embers in view. Displays the bespoke SVG lockup for **7 MINUTES LEFT** (*"THE LAST LIGHT IS FADING."*), high-contrast `PLAY`, `HOW TO PLAY`, and `SETTINGS` actions, and a single flat control-hint line.
  2. **Active Survival Gameplay (`PLAYING`)**: Full-viewport 3D canvas with low-occlusion perimeter HUD (`>85%` unobstructed viewport). Top center displays the `07:00` tabular countdown, current wave/phase, and threat level. Top-left displays Player Health, Stamina, and Generator Core integrity bars. Top-right displays Energy Ammunition count, Reload status, Kills, and Score. Bottom zone renders multi-touch virtual controls (left analog joystick + Sprint toggle; right camera touch zone + Fire, Dodge, Reload, and context-sensitive Interact/Repair buttons).
  3. **Tactical Pause & Settings (`PAUSED`)**: Freezes elapsed simulation time, wave spawning, and enemy AI; offers `Resume`, `Settings` (Mouse/Touch Sensitivity, Camera Sensitivity, Sound Volume, Mute, and Graphics Quality `LOW` / `MEDIUM` / `HIGH`), `Restart`, and `Main Menu`.
  4. **Endgame Resolution (`VICTORY` / `DEFEAT`)**:
     - **Victory (`SURVIVED`)**: Triggered when the 420-second timer reaches `00:00` with both player and generator alive. Displays survival time, enemies defeated, generator remaining health, and final score with `Play Again` and `Main Menu` buttons.
     - **Defeat (`THE SETTLEMENT HAS FALLEN.`)**: Triggered if player health or generator health reaches `0`, displaying cause of fall, survival time, enemies defeated, final score, `Restart`, and `Main Menu`.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Atmospheric stylized low-poly dusk survival (inspired by indie survival dioramas with crisp geometric silhouettes and warm-vs-cool lighting contrast).
  - *Color Palette & Mood*:
    - `--background`: Deep Dusk Indigo / Obsidian (`#0B1021` to `#1A162B` sky gradient and matching exponential horizon fog)
    - `--surface`: Translucent tactical slate (`rgba(11, 16, 33, 0.78)`) with thin `1px` borders (`rgba(255, 255, 255, 0.12)`) — no `backdrop-filter` over the active WebGL canvas to preserve mobile GPU fill-rate
    - `--primary`: Generator Cyan / Energy Pulse (`#06B6D4` / `#38BDF8`)
    - `--accent`: Streetlight Warm Amber (`#F59E0B` / `#FB923C`)
    - `--danger`: Infection Crimson (`#EF4444`) and Repair Emerald (`#10B981`)
  - *Typography & Hierarchy*:
    - **Display / HUD Headers**: Geometric tactical display face (`Chakra Petch` / `Oxanium` fallback to system geometric sans) with `text-wrap: balance`.
    - **Body & Controls**: Clean legible sans (`Plus Jakarta Sans` / system sans) for instructions and settings.
    - **Telemetry & Timer**: Monospace numerals (`JetBrains Mono`, `font-variant-numeric: tabular-nums`) for the `07:00` countdown, ammo counter, health readouts, and score.
  - *Component Styling & Layout*:
    - Perimeter-pinned HUD clusters with zero static pills; metadata rendered with clean `·` typographic separators.
    - Minimum `48x48px` touch hitboxes on all mobile buttons (`Fire` button `80x80px`, analog joystick zone `140x140px`).

- **Interactive Feedback & Motion**:
  - Subtle decaying camera shake and red perimeter vignette on player damage; amber alert banner when generator health drops below 35% or is under active attack.
  - Pooled particle bursts on muzzle flash, projectile impact, enemy dissolution, and generator electrical arcs.
  - Floating notification toasts on supply pickup (`+35 HEALTH PACK`, `+24 ENERGY CELL`, `REPAIR KIT ACQUIRED`, `GENERATOR REPAIRED +35%`).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Incremental 3-Phase Build with Compilation & Regression Checks**
  - *Chosen Approach*: Implement and verify **Phase 1 (Playable Core)** first (environment, player, camera, desktop/mobile controls, shooting, Runner AI, generator health, 420s timer, pause/victory/defeat), then extend in place for **Phase 2 (Gameplay Expansion)** (Brute & Stalker enemies, pickups, generator repair, progressive waves, ammo & stamina), and finish with **Phase 3 (Visual & Technical Polish)** (menus, HUD, particles, Web Audio, graphics tiers, Android optimization).
  - *Why*: Guarantees a rock-solid playable core from the start and prevents regressions as features are layered on.

- **Decision 2: Decoupled Active Gameplay Timer vs. Clamped Physics Delta**
  - *Chosen Approach*: Track the 420-second countdown using accumulated unscaled active gameplay time (`activeGameplayTime += rawDelta`, paused whenever the game is paused or window loses focus), while clamping the physics/movement step separately (`simDelta = Math.min(rawDelta, 0.05)`).
  - *Why*: Ensures 7 minutes of survival takes exactly 420 seconds of active play even on devices with fluctuating frame rates, while keeping collision detection and steering stable during frame spikes.

- **Decision 3: Multi-Touch Pointer Tracking & Pooled Three.js Objects**
  - *Chosen Approach*: Track active `pointerId` assignments independently for the left virtual joystick, right-side camera look region, and discrete action buttons (`Fire`, `Dodge`, `Reload`, `Interact`), while pre-allocating reusable `THREE.Vector3` scratchpads and object pools for projectiles and particles.
  - *Why*: Ensures simultaneous movement, camera rotation, and firing on Android touchscreens with zero garbage-collection stutters.

---

### 4. Technical Architecture & Data Strategy

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        React Game Shell (App)                           │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  Title Screen │  │  Gameplay HUD │  │ Pause / Help │  │  Victory  │  │
│  │  (Live 3D Bg) │  │ & Touch Input │  │ & Settings   │  │ / Defeat  │  │
│  └───────┬───────┘  └───────┬───────┘  └──────┬───────┘  └─────┬─────┘  │
└──────────┼──────────────────┼─────────────────┼────────────────┼────────┘
           │                  ▼                 │                │
┌──────────┴────────────────────────────────────┴────────────────┴────────┐
│                     Core 3D Game Engine (Three.js)                      │
│                                                                         │
│  ┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────┐ │
│  │  World & Settlement  │   │  Player & Third-     │   │ Procedural   │ │
│  │  Builder (Houses,    │   │  Person Camera       │   │ Web Audio    │ │
│  │  Vehicles, Barriers, │   │  (Kinematics, Dodge, │   │ Synthesizer  │ │
│  │  Trees, Streetlights)│   │  Limb Animation,     │   │ (Wind, Hum,  │ │
│  │  + Collision AABBs   │   │  Camera Anti-Clip)   │   │ Pulse, Hits) │ │
│  └──────────┬───────────┘   └──────────┬───────────┘   └──────┬───────┘ │
│             │                          │                      │         │
│  ┌──────────▼───────────┐   ┌──────────▼───────────┐   ┌──────▼───────┐ │
│  │  Generator & Supply  │   │  Combat & Pooled     │   │ 7-Minute     │ │
│  │  Resource Manager    │◄──┤  Particle System     │──►│ Wave & AI    │ │
│  │  (Core Health, Kits, │   │  (Pulse Projectiles, │   │ Director     │ │
│  │  Health/Ammo Nodes)  │   │  Raycast/Sphere Hit) │   │ (Runner,     │ │
│  └──────────────────────┘   └──────────────────────┘   │ Brute,Stalker│ │
│                                                        └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Incremental Execution Roadmap**:
  1. **Phase 1 — Playable Core**: Install `three` and `@types/three`, build the settlement environment, player character, third-person camera, desktop/mobile controls, basic shooting, Runner enemy AI, generator health, decoupled 420s countdown, and pause/victory/defeat states, then run `compile_applet` to verify.
  2. **Phase 2 — Gameplay Expansion**: Add Brute and Stalker enemies, collectible Health Packs / Energy Cells / Repair Kits, generator repair mechanics, 7-minute wave progression, and full ammo/stamina systems, then run `compile_applet` to verify.
  3. **Phase 3 — Visual & Technical Polish**: Add cinematic Main Menu, full HUD telemetry/warnings, procedural animations, pooled particle bursts, Web Audio sound effects, and `LOW`/`MEDIUM`/`HIGH` Android performance settings, then run final `compile_applet` verification.
