<p align="center"><img src="docs/logo/simuflow-logo.svg" width="320" alt="SimuFlow"></p>

# SimuFlow

[Français](README.fr.md) · English

SimuFlow is a mobile app that turns a business workflow into an interactive, checked walkthrough. Import a draw.io diagram or photograph a process table, see the anomalies, then replay the process step by step by choosing each branch.

> Status: early stage. All screens exist and are linked together (Process, Scanner and Profile tabs; detail, simulation, import, sign-in), but only the Process list, the Process detail, the import screen and the simulation are built so far: they show sample processes with their diagnostic, you can add your own from a draw.io or JSON file (saved on the phone, and deletable), replay any process step by step while its diagram builds itself on screen, see every case at once with one colour per family of paths, and export the diagram as a PDF, a draw.io file or JSON. The other screens are still placeholders. The simulator features are being built step by step, following the mockup.

## Who it is for

Project managers and analysts who design IT service management (ITSM) workflows with business teams. A static diagram is hard to validate: dead ends, one-way decisions and inconsistent delays show up too late. SimuFlow makes them visible in under a minute.

## Key screens

- **Process**: the list of imported processes with their diagnostic status.
- **Simulation**: the diagram lights up as you walk through it; each decision asks which branch to follow. The "Tous" (All) view shows every path, one colour per family, with the critical path. The diagram can be exported as a PDF, a draw.io file or JSON.
- **Scanner**: photograph a table (step, actor, delay) and turn it into a workflow.

The full mockup is in [`docs/maquette/`](docs/maquette/).

## Logo

The logo is an S-shaped path: a starting point, two turns and an arrival arrow. It stands for a process walked through step by step, and draws the S of SimuFlow. Its story, colors and files are in [`docs/logo/`](docs/logo/) (French).

## Phone features

- Camera with on-device text recognition (native module in Kotlin and Swift).
- Notifications when a shared process is validated or commented.

## Getting started

Requirements: a Mac with Xcode, and Node.js 22.13 or later.

```bash
npm install
npx expo run:ios
```

The app is compiled with Xcode (development build) and opens in the iOS Simulator. To install it on an iPhone plugged in over USB: `npx expo run:ios --device`. The `ios/` folder is generated automatically and is not committed.

`npm run ios:simulateur` and `npm run ios:iphone` do the same, after checking that package versions match the Expo SDK (fix with `npx expo install --fix`, then `cd ios && pod install`). Build files are kept, so the next build only recompiles what changed. `npm run nettoyer` deletes them to free disk space (the next build then starts from scratch); the scripts remind you when less than 10 GB is free.

A new build is only needed when a native module is added. Otherwise, once the app is installed, run `npx expo start` and open the app: changes show up in a few seconds.

Sensitive files (`.env`, keys, certificates) and local Claude Code files (`.claude/`) are kept out of the repository by `.gitignore`.

## Documentation

- [Technical documentation](docs/technique.md) (French): architecture, structure, commands.
- [Features guide](docs/fonctionnalites.md) (French): what the app does, in plain words.

## Tech stack

Expo SDK 58, React Native 0.88, Expo Router, TypeScript (strict), Supabase backend (`@supabase/supabase-js`). The simulator core (`src/domain/`) is plain TypeScript, tested with Jest: `npm test`.

## License

See [LICENSE](LICENSE).
