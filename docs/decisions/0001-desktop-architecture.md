# ADR 0001: Tauri 2 + Svelte 5 + Rust

Status: selected, implementation and measurement in progress.

## Requirements

Windows/macOS, a highly polished analogue dial and physical flip animation, reliable background timing, low desktop overhead and crisp mechanical audio. The request prioritizes product fidelity and performance together.

## Options

| Option                        | Benefit                                                                                                             | Cost / limit                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Electron baseline             | Known working behavior, one bundled renderer, straightforward automation                                            | Each app ships Chromium/Node; our baseline also rewrites UI state on a polling render loop                                                                                    |
| Flutter                       | FliTik's shipped Windows artifacts confirm this choice; excellent custom painting and a shared widget model         | Requires Flutter SDK/native toolchains; Flutter's [Impeller documentation](https://docs.flutter.dev/perf/impeller) does not establish a blanket Windows performance advantage |
| Tauri 2 + Svelte 5            | System WebView, Rust native services, compiler-generated small UI updates; CSS transforms suit a split-flap display | Platform WebViews differ; requires native platform QA and Rust toolchains; smaller installer does not automatically imply lower total working set                             |
| Separate SwiftUI / WinUI apps | Maximum platform control                                                                                            | Two implementations and more duplicated product/motion logic                                                                                                                  |

## Decision

Use Tauri 2 as the desktop shell, Svelte 5 + TypeScript for explicit components, Rust for authoritative timing, persistence and audio coordination. The dial is vector based; flip leaf transforms are compositor animations. There is no universal 60 Hz application render loop. Static face detail is cached by the renderer.

The first prototype remains in `prototypes/electron` until parity is tested. Native audio should use a bounded command queue and a dedicated callback without locks/allocations. Window pin/fullscreen and sleep inhibition stay behind a small native API.

## Evidence to collect

Measure complete process trees for idle/clock/countdown; report private working set and CPU over a stated interval, and startup-to-ready time. Record display refresh rate and viewport for animation results. Do not compare an optimized release build to a debug build or count only one process of a multiprocess app.

Primary references: [Tauri architecture](https://v2.tauri.app/concept/architecture/), [Tauri system requirements](https://v2.tauri.app/start/prerequisites/), [Svelte 5 runes](https://svelte.dev/docs/svelte/what-are-runes), [Web Audio timing](https://www.w3.org/TR/webaudio/).
