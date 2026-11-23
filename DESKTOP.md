# Playquill for Windows

Playquill is a personal game library and journal with a **real desktop app** built on Electron, bundling its own local Next.js server. The app opens in its own Windows window and can create desktop and Start Menu shortcuts.

## Windows downloads

The Windows CI workflow builds two artifacts from the same verified source:

- **Playquill-Setup-0.2.0-x64.exe** — Windows installer (recommended), with Start Menu/Desktop shortcuts and normal removal through Windows Settings.
- **Playquill-Portable-0.2.0-x64.exe** — standalone portable executable without an installer.

Download the `Playquill-Windows-x64-verified` artifact from the successful **Build and verify Playquill for Windows** GitHub Actions run. Both files are unsigned developer builds. Windows SmartScreen may show a warning; inspect the official build source before choosing to proceed.

### Build locally

On Windows x64 with Node.js 22:

```powershell
npm install
npm run desktop:build
```

The build writes both `.exe` files to `dist/`.

### Startup validation

The first Playquill 0.1.0 portable binary sometimes failed to start with **Port 41771 may be occupied**. It launched itself as a second executable to start a Node.js server, which was not reliable for portable EXEs.

The 0.2.0 launcher uses Electron's dedicated `utilityProcess.fork`, chooses a free local loopback port, starts the bundled Next.js server, and **requires valid HTML and CSS** before opening the main window. It records startup information in the user's Electron data folder as `startup.log`. If startup fails, the error dialog gives the log location. The Windows CI pipeline must successfully run the *actual packaged executable* in smoke-test mode before generating downloadable installers.

Developer smoke test after `npm run build && npm run desktop:prepare`:

```powershell
npx electron-builder --win --x64 --dir --publish never
node scripts/smoke-windows.cjs dist/win-unpacked/Playquill.exe
```

A passing build **does not** replace hands-on Windows testing of the notes editor, imports, drag-and-drop, sign-in and shutdown.

## Import your existing web collection

Desktop Playquill uses its own persistent Electron browser profile. Existing data in the Vercel preview stays on that hostname:

1. Open Playquill in the browser and choose **Preferences → Download JSON backup**.
2. Launch the Windows application and choose **Preferences → Import backup**.
3. Select the JSON file and confirm replacement.

Export a JSON backup before switching from browser to desktop or between versions. The desktop app still works for organizing games and local notes without an internet connection after assets are loaded, but external search, remote cover art and optional cloud sign-in need internet access.

## Release guardrails

- The bundled Next.js server listens **only on 127.0.0.1** on a dynamically chosen port; it does not rely on a running Vercel tab.
- Only one Electron instance runs at a time.
- Node.js integration is disabled in the renderer, context isolation is enabled, and untrusted external URLs open in the system browser.
- No remote auto-updater or telemetry is included.
- The cloud account uses public client credentials and private per-user data; Google OAuth and end-to-end cloud testing may require additional configuration and are **not** guaranteed by the desktop smoke test.
- Do not merge, replace production, or mark a public release stable until Windows smoke tests and user acceptance pass.
