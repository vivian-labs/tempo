import { isTauri, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow, UserAttentionType } from '@tauri-apps/api/window';
import { defaults, type Snapshot, type Action } from '../types';
export const native = isTauri();
let preview = structuredClone(defaults),
  previewDeadline: number | null = null,
  previewMono = 0,
  previewRemaining = 0;
export async function connect(
  receive: (snapshot: Snapshot) => void,
): Promise<() => void> {
  if (native) {
    const stop = await listen<Snapshot>('tempo:snapshot', (e) =>
      receive(e.payload),
    );
    receive(await invoke<Snapshot>('snapshot'));
    return stop;
  }
  // Explicit development preview. Native desktop timing never uses this adapter.
  receive(preview);
  const id = setInterval(() => {
    preview.nowMs = Date.now();
    if (preview.timer.status === 'running') {
      preview.remainingMs = Math.max(
        0,
        previewRemaining - (performance.now() - previewMono),
      );
      if (preview.remainingMs <= 0) {
        preview.timer.status = 'finished';
        preview.ring = 'timer';
      }
    }
    receive(structuredClone(preview));
  }, 1000);
  return () => clearInterval(id);
}
export async function dispatch(action: Action): Promise<Snapshot> {
  if (native) return invoke<Snapshot>('dispatch', { action });
  switch (action.type) {
    case 'setMode':
      preview.mode = action.mode;
      break;
    case 'setView':
      preview.view = action.view;
      break;
    case 'settings':
      preview.settings = action.settings;
      break;
    case 'setDuration':
      preview.timer = {
        durationMs: action.ms,
        remainingMs: action.ms,
        deadlineWallMs: null,
        status: 'idle',
      };
      preview.remainingMs = action.ms;
      break;
    case 'start':
      if (preview.timer.status === 'finished')
        preview.remainingMs = preview.timer.durationMs;
      previewRemaining = preview.remainingMs;
      previewMono = performance.now();
      previewDeadline = Date.now() + previewRemaining;
      preview.timer.status = 'running';
      preview.timer.deadlineWallMs = previewDeadline;
      break;
    case 'pause':
      preview.timer.status = 'paused';
      preview.timer.remainingMs = preview.remainingMs;
      break;
    case 'reset':
      preview.timer.status = 'idle';
      preview.remainingMs = preview.timer.durationMs;
      break;
    case 'setAlarm':
      preview.alarm = {
        time: action.time,
        enabled: action.enabled,
        nextAt: null,
        snoozeAt: null,
      };
      break;
    case 'dismiss':
    case 'snooze':
      preview.ring = null;
      break;
  }
  return structuredClone(preview);
}
export async function previewSound() {
  if (native) await invoke('preview_sound');
}
export async function setFullscreen(): Promise<boolean> {
  if (native) {
    const w = getCurrentWindow();
    const enabled = !(await w.isFullscreen());
    await w.setFullscreen(enabled);
    await invoke('set_fullscreen_awake', { enabled });
    return enabled;
  }
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return false;
  }
  await document.documentElement.requestFullscreen();
  return true;
}
export async function leaveFullscreen() {
  if (native) {
    await getCurrentWindow().setFullscreen(false);
    await invoke('set_fullscreen_awake', { enabled: false });
  } else if (document.fullscreenElement) await document.exitFullscreen();
}
export async function setPinned(): Promise<boolean> {
  if (!native) return false;
  const w = getCurrentWindow(),
    value = !(await w.isAlwaysOnTop());
  await w.setAlwaysOnTop(value);
  return value;
}
export async function attention() {
  if (native)
    await getCurrentWindow().requestUserAttention(
      UserAttentionType.Informational,
    );
}
