<p align="center"><img src="docs/logo/simuflow-logo.svg" width="320" alt="SimuFlow"></p>

# SimuFlow

[Français](README.fr.md) · English

SimuFlow is a mobile app that turns a business workflow into an interactive, checked walkthrough. Import a draw.io diagram or photograph a process table, see the anomalies, then replay the process step by step by choosing each branch.

> Status: early stage. All screens exist and are linked together (Process, Scanner and Profile tabs; detail, simulation, import, sign-in), but only the Process list, the Process detail, the import screen, the simulation, the sign-in screen and the Scanner (photo, then on-device reading with a native module, Swift with Vision on iPhone, which also crops the photo to the document, and Kotlin with ML Kit on Android, and only the table is kept, found by its header row, then turned into a process with its decisions, actors and delays) are built so far: a short four-page tour opens on first launch (it can be replayed from the Profile tab); they show your processes with their diagnostic, then sample processes in a collapsible section (hidden from the Profile tab if you wish), you can add your own from a draw.io or JSON file (saved on the phone, deletable, and correctable in an editor: steps, decision cases and branches can be changed, added or removed; the app learns reading rules from these corrections, keeps them on your account and reapplies them on the next imports), replay any process step by step while its diagram builds itself on screen, see every case at once with one colour per family of paths, export the diagram as a PDF, a draw.io file or JSON, follow a real request step by step with deadlines in French working days (weekends and public holidays skipped), and create an account (sign in, sign out, reset a forgotten password with a link sent by e-mail, delete it) that keeps your imported processes in sync across devices. The other screens are still placeholders. The simulator features are being built step by step, following the mockup.

## Who it is for

Project managers and analysts who design IT service management (ITSM) workflows with business teams. A static diagram is hard to validate: dead ends, one-way decisions and inconsistent delays show up too late. SimuFlow makes them visible in under a minute.

## Key screens

- **Process**: the list of imported processes with their diagnostic status.
- **Simulation**: the diagram lights up as you walk through it; each decision asks which branch to follow. The "Tous" (All) view shows every path, one colour per family, with the critical path. The diagram can be exported as a PDF, a draw.io file or JSON.
- **Scanner**: photograph a table (step, actor, delay) and turn it into a workflow.
- **Profile**: your account and sync, deadline reminders, the examples switch, learned reading rules, and an "About" section (server status, replay the welcome tour, app version).

The full mockup is in [`docs/maquette/`](docs/maquette/).

## Logo

The logo is an S-shaped path: a starting point, two turns and an arrival arrow. It stands for a process walked through step by step, and draws the S of SimuFlow. Its story, colors and files are in [`docs/logo/`](docs/logo/) (French). It is also the app icon and the splash screen.

## Phone features

- Camera with on-device text recognition (native module in Kotlin and Swift).
- Local notifications (no server): deadline reminders for each step of a process you follow for real: the morning of the deadline, then when it is missed; tapping one opens the request. The switch and a test notification are in the Profile tab.

## Getting started

Requirements: a Mac with Xcode, and Node.js 22.13 or later.

```bash
npm install
npx expo run:ios
```

The app is compiled with Xcode (development build) and opens in the iOS Simulator. To install it on an iPhone plugged in over USB: `npx expo run:ios --device`. The `ios/` folder is generated automatically and is not committed.

`npm run ios:simulateur` and `npm run ios:iphone` do the same, after checking that package versions match the Expo SDK (fix with `npx expo install --fix`, then `cd ios && pod install`). Build files are kept, so the next build only recompiles what changed. `npm run nettoyer` deletes them to free disk space (the next build then starts from scratch); the scripts remind you when less than 10 GB is free.

A new build is only needed when a native module is added. Otherwise, once the app is installed, run `npx expo start` and open the app: changes show up in a few seconds.

**Installable build (no Mac needed).** EAS Build compiles the app on Expo's servers. `npx eas-cli@latest build --platform android --profile preview` produces an Android APK that installs from a link or QR code and runs without a dev server. Installing an EAS build on an iPhone requires a paid Apple Developer account; with a free account, use the Xcode development build above. Once installed, JavaScript changes reach the app without a new build through EAS Update: `npx eas-cli@latest update --channel preview --message "..."`. Details in `docs/technique.md` (French).

Sensitive files (`.env`, keys, certificates) and local Claude Code files (`.claude/`) are kept out of the repository by `.gitignore`.

## Documentation

- [Technical documentation](docs/technique.md) (French): architecture, structure, commands.
- [Features guide](docs/fonctionnalites.md) (French): what the app does, in plain words.
- [Security](docs/securite.md) (French): keys, access rules, accounts, data on the phone.
- [Working with AI](docs/ia.md) (French): what guides the AI (AGENTS.md, CLAUDE.md, MCP) and how we work with it.

## Tech stack

Expo SDK 58, React Native 0.88, Expo Router, TypeScript (strict), Supabase backend (`@supabase/supabase-js`). The simulator core (`src/domain/`) is plain TypeScript, tested with Jest, and key components are tested with React Native Testing Library: `npm test`. An end-to-end test (Maestro, `.maestro/`) simulates a process step by step in the real app on the iOS Simulator: `npm run e2e`. On every pull request and every push to `main`, GitHub Actions checks types, lint and tests (`.github/workflows/verifications.yml`).

## License

See [LICENSE](LICENSE).
