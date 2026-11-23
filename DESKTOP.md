# Playquill for Windows

Playquill is a personal game library and journal. The Windows edition is a **portable desktop application** powered by Electron and a bundled local Next.js server.

## Build a portable Windows EXE

On a Windows 10/11 x64 machine with Node.js 22 installed:

```powershell
npm install
npm run desktop:build
```

The generated executable is written to `dist/Playquill-0.1.0-x64.exe`.

GitHub Actions can also build it on the `feature/work-catchup-2026-11-20` branch using **Actions → Build Playquill Windows EXE**. Download the `Playquill-Windows-Portable` workflow artifact and extract the executable.

The executable bundles the local Next.js server, Electron runtime, and app assets. **It does not require the Vercel website** to open your saved games, categories, and notes. Internet access is still required for searching online game databases and loading remote cover images.

## Your existing browser library

The desktop application has a separate local storage profile from your web browser. To migrate existing data:

1. Open your existing Playquill preview in the browser.
2. Open Preferences and **export the JSON library backup**.
3. Launch the Windows version.
4. Import the JSON backup from Preferences.

Keep a backup before major changes. Playquill currently saves data locally, not to a cloud account.

## Implementation and limitations

- Launches one local Next.js server on `127.0.0.1:41771` and opens it in a dedicated Electron window.
- Prevents a second copy of the desktop app from launching.
- Refuses to load if another service already occupies that port.
- Opens external web links in the default browser rather than inside a privileged Electron page.
- Uses browser isolation: Node integration disabled and context isolation enabled.
- This portable build is **unsigned** and Windows SmartScreen may ask for confirmation. Inspect the source and build logs before running.
- The Windows build and packaging workflow must pass and the resulting executable must be tested on Windows before calling the desktop release stable.
- No GitHub merge or Vercel production deployment is part of this Windows build.

See `electron/main.cjs`, `scripts/prepare-desktop.cjs`, `next.config.mjs`, and `electron-builder.json` for implementation details.
