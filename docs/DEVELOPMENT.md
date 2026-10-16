# Build, verification and project records

Use Node 24 and Rust 1.90 or newer (current stable recommended). On Windows use Visual Studio C++ Build Tools and the MSVC target with WebView2 installed; on macOS install Xcode command-line tools. See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
npm ci
npm run check
npm test
npm run test:native
npm run build
npm run test:ui
npm run desktop
npm run desktop:build
```

The first UI test run needs `npx playwright install chromium`. `npm run dev` is an explicitly labelled browser preview: it does not implement native audio, sleep timing or daily alarm delivery. `npm run desktop` runs the real Rust application.

Windows builds use WebView2; macOS builds use system WKWebView. Shared UI source does not mean identical renderer behavior. Platform-native CI builds and unit tests run for Windows x64, macOS Apple Silicon and macOS Intel. Bundles are unsigned development artifacts unless signing is separately configured; no signing credentials are included. macOS GUI, sound-device and sleep behavior still need physical-machine acceptance even after CI passes.

## State and time

State is saved in the Tauri app-data directory as `state-v2.json`, using a temporary file followed by rename. Running timers use a continuous native clock (Windows `GetTickCount64`, macOS `mach_continuous_time`), which includes sleep. The wall deadline is persisted for restart recovery. If the user changes the wall clock while the process is stopped, restart recovery necessarily follows that wall clock; do not promise a monotonic clock across process restarts.

Daily alarm times follow local civil time. The app must remain running; it does not wake a sleeping machine. The active countdown/fullscreen asks the OS to keep the display awake, without preventing an explicit user sleep. Audio is independent of renderer visibility. Tick mute and overall volume are separate choices.

## Reproducible checks

`npm run test:ui` checks controls and visual layouts in a browser. For the Windows native WebView2, start the app with `TEMPO_DEBUG_PORT=9422` and an isolated `TEMPO_DATA_DIR`, then run `TEMPO_CDP=http://127.0.0.1:9422 npm run test:ui`. Debug ports must remain closed during normal use. The script saves the environment label, results and screenshots under ignored `test-results/`.

Native unit tests exclude the desktop host module. This keeps pure timing/audio tests independent of Windows GUI activation contexts and WebView loader placement; the actual executable is separately launched and exercised. This separation was introduced after diagnosing `STATUS_ENTRYPOINT_NOT_FOUND` on a test executable importing the common-controls v6 API without an application manifest.

The local Windows research machine used a project-local Rust GNU toolchain and w64devkit. GCC 16 merges unwind symbols into `libgcc`; a local linker-script alias for `libgcc_eh` was required. This workaround and all toolchains remain ignored, and are not required by the supported MSVC CI workflow. No machine-wide PATH or Git configuration changes are part of the project.

## Records

Keep research evidence in `docs/research`, architectural choices in `docs/decisions`, dated work and failures in `docs/journal`, and repeatable measurement methods in `docs/benchmarks`. Downloaded binaries, private raw analysis and local toolchains belong under `.local/` and must never be committed. Preserve third-party font licenses. Keep `package-lock.json` and `src-tauri/Cargo.lock` in version control.
