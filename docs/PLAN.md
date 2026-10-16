# TEMPO next implementation

## Outcome

Turn the working desktop prototype into a maintained public project in `vivian-labs/tempo`. Local development lives at `D:\Code\personal\Personal\tempo`, as requested. Retain the design process, research and validation in the repository; keep downloaded targets and toolchains private in `.local/`.

## Acceptance

1. REA analyzes real FliTik release artifacts, including Flutter build identification and Dart AOT inspection. Findings include verifiable evidence and explicit limitations. Static tokens never become invented function semantics.
2. Document the clock/flip/motion/sound/urgency design and the desktop architecture tradeoff.
3. Migrate to a typed, modular Tauri/Svelte/Rust implementation. Separate native timing and audio from the UI, keep updates event-driven, and preserve functional clock/countdown/alarm behavior.
4. Tests cover timing, clock changes, suspend/restart, single expiry, daily alarm and snooze. Render the mechanical, flip, settings and warning states at desktop/small sizes.
5. Build and run on Windows locally; run platform-native macOS CI where available. Report any platform/build limitations honestly.
6. Create and push the public repository only after inspecting tracked files for accidental artifacts/credentials. No paid signing certificates or account changes are required to publish source.

## Work sequence

- [x] Confirm GitHub owner `vivian-labs` and establish the requested local path.
- [x] Preserve the 0.1 Electron implementation as a baseline.
- [ ] Deep artifact research and design synthesis.
- [ ] Native timer and sound engine, typed component UI.
- [ ] Functional, visual and resource-use verification.
- [ ] Public repository, CI and build documentation.

## Evidence and limits

No product can be certified as objectively the most beautiful or fastest without a defined comparison. Use measurable acceptance gates: instrument updates only when necessary, compositor-driven flip motion, bounded audio work, startup/working-set/CPU/frame metrics with methodology. Do not invent runtime measurements or macOS verification.
