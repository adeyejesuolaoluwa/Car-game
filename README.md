# NITRO X

A 3D browser racing game built with Three.js and Vite. Races run directly in the browser; no backend or account is required.

## Run locally

1. Install Node.js 20.19+ or 22.12+.
2. From this folder, install dependencies and start the dev server:

   ```sh
   npm install
   npm run dev
   ```

3. Open the local URL printed by Vite.

Create a production build with `npm run build`. The deployable static site is written to `dist/`; upload that folder to any static web host. `npm run preview` serves the production build locally.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Accelerate | W / Up Arrow | GO |
| Brake / reverse | S / Down Arrow | BRAKE |
| Steer | A / D or Left / Right Arrows | ◀ / ▶ |
| Drift / handbrake | Space | DRIFT |
| Nitro | Shift | N₂O |
| Change camera | C | CAM button |
| Pause / resume | Escape | PAUSE / RESUME |

The first Quick Race offers a short interactive driving tutorial. Replay it with **HOW TO DRIVE** in the garage. The **Driving Settings** panel includes beginner steering/stability assists, steering sensitivity, touch-button size, and hold-or-toggle mobile acceleration. Settings and tutorial completion are saved in the browser.

Standard gamepads are supported: left stick steers, RT/A accelerates, LT/B brakes, LB drifts, and X/RB activates nitro.

## Included gameplay

- Five event types: Quick Race, Time Trial, Drift Attack, Free Drive, and Career Ladder.
- Three circuits: Neon District, Sunset Run, and Alpine Pass.
- Six vehicles with different top speed, acceleration, grip, and nitro stats; paint colors are selectable.
- Three AI rivals in race and career events, with Easy, Normal, Hard, and Pro pace settings.
- Three-lap finish system, race position, timer, minimap, collision response, roadside cones, nitro, drifting score, and four camera views.
- Credits, XP, wins, and per-circuit Time Trial lap records saved in browser local storage.
- Responsive touch controls and synthesized engine audio (toggle in the race HUD).

## Career progression

Choose **Career Ladder** to race three events in order: Neon Sprint on Neon District, Sunset Run on the desert circuit, and Alpine Apex on the mountain circuit. Win each event to advance and earn its career reward (450, 600, and 800 credits). Completing all three wins permanently unlocks the Apex RS.

Open **Vehicle Upgrades** in the garage to spend credits on the selected car. Engine upgrades increase acceleration and top speed; Handling improves grip; Nitro increases boost power and duration. Each upgrade has three levels, with costs shown in the garage. Career progress, credits, unlocked cars, and upgrades are saved in browser local storage.

The renderer uses procedural geometry and does not require downloaded game assets. A network connection is only needed to load the optional Google Fonts; system-font fallbacks are included.
