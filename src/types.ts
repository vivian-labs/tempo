export type Mode = 'clock' | 'timer' | 'alarm';
export type View = 'dial' | 'flip';
export type Theme = 'dark' | 'light' | 'black';
export type Tone = 'steel' | 'ceramic' | 'wood';
export interface Settings {
  sound: boolean;
  volume: number;
  tone: Tone;
  theme: Theme;
  step: boolean;
  urgency: boolean;
  hideChrome: boolean;
  showReadout: boolean;
}
export interface Snapshot {
  version: number;
  mode: Mode;
  view: View;
  timer: {
    durationMs: number;
    remainingMs: number;
    deadlineWallMs: number | null;
    status: 'idle' | 'running' | 'paused' | 'finished';
  };
  alarm: {
    time: string;
    enabled: boolean;
    nextAt: number | null;
    snoozeAt: number | null;
  };
  settings: Settings;
  nowMs: number;
  remainingMs: number;
  ring: 'timer' | 'alarm' | 'snooze' | null;
  audioAvailable: boolean;
  storageError: string | null;
}
export type Action =
  | { type: 'start' | 'pause' | 'reset' | 'dismiss' | 'snooze' }
  | { type: 'setDuration'; ms: number }
  | { type: 'setMode'; mode: Mode }
  | { type: 'setView'; view: View }
  | { type: 'setAlarm'; time: string; enabled: boolean }
  | { type: 'settings'; settings: Settings };
export const defaults: Snapshot = {
  version: 2,
  mode: 'timer',
  view: 'dial',
  timer: {
    durationMs: 1500000,
    remainingMs: 1500000,
    deadlineWallMs: null,
    status: 'idle',
  },
  alarm: { time: '09:00', enabled: false, nextAt: null, snoozeAt: null },
  settings: {
    sound: false,
    volume: 0.35,
    tone: 'steel',
    theme: 'dark',
    step: true,
    urgency: true,
    hideChrome: false,
    showReadout: true,
  },
  nowMs: Date.now(),
  remainingMs: 1500000,
  ring: null,
  audioAvailable: true,
  storageError: null,
};
