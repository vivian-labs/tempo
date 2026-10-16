# TEMPO development guidance

Keep code and retained engineering knowledge together in this repository.

## Product
Mechanical dial and convincing split-flap views, Windows and macOS, visual time depletion, precise configurable mechanical sound, excellent typography and motion. Treat material/animation fidelity as acceptance criteria, not decoration.

## Engineering
- Prefer event-driven updates. Do not rerender an entire instrument at 30/60 Hz just to change one hand or a second value.
- One authoritative timing engine; renderer state must not decide whether a native alarm has expired.
- Separate persisted wall-clock recovery from active countdown timing. Test clock changes, sleep, pause, restart and duplicate expiry.
- Keep audio work out of the UI thread. Do not allocate or lock in a real-time audio callback.
- Keep UI copy about the user's task; engineering details belong in docs.
- Run focused tests and render affected views before claiming completion.
- Do not claim one stack is fastest, best, or native on every platform without evidence.

## Research and documentation
- `docs/research`: exact input hashes, tool versions, findings, evidence limits, and lessons.
- `docs/decisions`: concrete options, rationale, costs, validation status.
- `docs/benchmarks`: reproducible procedure, machine context, raw metrics and careful comparisons.
- `docs/journal`: dated meaningful development outcomes and unresolved work.
- `.local`: ignored binaries, extraction, local SDKs and raw analysis. Never publish credentials or third-party proprietary media/code.

Public source code and docs must be inspectable and independently buildable. Keep the Electron prototype as a baseline until migration has meaningful parity evidence.
