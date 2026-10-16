# TEMPO implementation plan

Create a polished offline Windows/macOS time instrument with original visuals and synthesized audio. Same UI and timer engine on both platforms. No third-party proprietary code or assets.

## Acceptance
- Mechanical dial with readable minute markings, animated physical hands, drag-to-set countdown, disappearing time sector and escalating final-minute visual treatment.
- Split-flap view with actual layered perspective animation, available for clock and countdown.
- Clock, countdown, daily local-time alarm; start/pause/reset, custom duration, snooze, persisted settings, recovery after restart.
- Crisp short metallic tick with independent volume, preview and mute. No unexpected sound on first launch.
- Fullscreen, always-on-top, keyboard shortcuts, light and dark studio backgrounds, responsive resizing.
- Cross-platform Electron desktop shell with restricted preload bridge, offline assets and display-sleep inhibition while timing/fullscreen.
- Windows application tested here. macOS bundles assembled from official platform runtimes, with explicit untested/signing status; no claim of macOS runtime verification on Windows.

## Order
1. Inspect REA and FliTik public artifacts; record evidence and limits in RESEARCH.md.
2. Write time-engine tests for drift, pause/resume, expiry, restore, alarm and snooze.
3. Build engine, visual components, original sound synthesis and settings.
4. Exercise desktop app, inspect screenshots at desktop/small sizes and verify transitions/audio.
5. Package Windows and both macOS architectures, include source and user instructions.

## Boundaries
Alarms work while TEMPO is running, including minimized. They do not power on a sleeping/closed computer. On waking, elapsed countdowns complete and due alarms are handled. Fullscreen cannot be confused with hiding the app. Sound begins only after interaction. System time changes affect wall-clock deadlines; this is intentional for persisted countdown recovery.
