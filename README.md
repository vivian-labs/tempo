# TEMPO

**Time, made tangible. / 时间，有形。**

A tactile desktop clock for Windows and macOS: a mechanical dial, split-flap display, visual countdown, and a crisp, restrained mechanical voice.

TEMPO is being developed openly under vivian-labs. The initial Electron prototype is preserved in `prototypes/electron` as a functional and performance baseline. The next implementation uses Tauri 2, Svelte 5, TypeScript and Rust. Performance and visual claims must be backed by measurements, screenshots and explicit verification status.

## Product principles

- A physical instrument on screen: deliberate proportions, material depth, legible markings and convincing motion.
- Time disappears visibly; urgency rises near the deadline without arbitrary flashing or surprise sound.
- Mechanical and split-flap views share one authoritative time model.
- No account, no remote fonts, no tracking. Daily alarms require the app to remain running.
- Test on real platforms; a cross-platform source tree is not evidence of cross-platform runtime correctness.

## Development and research

- [Current plan](docs/PLAN.md)
- [Build and verification](docs/DEVELOPMENT.md)
- [Research index](docs/research/README.md)
- [Technology decision](docs/decisions/0001-desktop-architecture.md)
- [Development journal](docs/journal/2026-10-16.md)

FliTik is a reference product, not a source-code dependency. Proprietary binaries, extracted media and raw reverse-engineering output stay in the ignored `.local/` directory. Public research distinguishes observed facts from inference.

MIT for TEMPO code. Third-party licenses are retained with their assets.
