use chrono::{Duration as ChronoDuration, Local, LocalResult, TimeZone};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy)]
pub struct Clock {
    pub wall_ms: i64,
    pub continuous_ms: u64,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum TimerStatus {
    #[default]
    Idle,
    Running,
    Paused,
    Finished,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Timer {
    pub duration_ms: u64,
    pub remaining_ms: u64,
    pub deadline_wall_ms: Option<i64>,
    pub status: TimerStatus,
}
impl Default for Timer {
    fn default() -> Self {
        Self {
            duration_ms: 1_500_000,
            remaining_ms: 1_500_000,
            deadline_wall_ms: None,
            status: TimerStatus::Idle,
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Alarm {
    pub time: String,
    pub enabled: bool,
    pub next_at: Option<i64>,
    pub snooze_at: Option<i64>,
}
impl Default for Alarm {
    fn default() -> Self {
        Self {
            time: "09:00".into(),
            enabled: false,
            next_at: None,
            snooze_at: None,
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    pub sound: bool,
    pub volume: f32,
    pub tone: String,
    pub theme: String,
    pub step: bool,
    pub urgency: bool,
    pub hide_chrome: bool,
    pub show_readout: bool,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            sound: false,
            volume: 0.35,
            tone: "steel".into(),
            theme: "dark".into(),
            step: true,
            urgency: true,
            hide_chrome: false,
            show_readout: true,
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Saved {
    pub version: u32,
    pub mode: String,
    pub view: String,
    pub timer: Timer,
    pub alarm: Alarm,
    pub settings: Settings,
}
impl Default for Saved {
    fn default() -> Self {
        Self {
            version: 2,
            mode: "timer".into(),
            view: "dial".into(),
            timer: Timer::default(),
            alarm: Alarm::default(),
            settings: Settings::default(),
        }
    }
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    #[serde(flatten)]
    pub saved: Saved,
    pub now_ms: i64,
    pub remaining_ms: u64,
    pub ring: Option<String>,
    pub audio_available: bool,
    pub storage_error: Option<String>,
}
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Action {
    Start,
    Pause,
    Reset,
    SetDuration { ms: u64 },
    SetMode { mode: String },
    SetView { view: String },
    SetAlarm { time: String, enabled: bool },
    Settings { settings: Settings },
    Dismiss,
    Snooze,
}
pub struct Kernel {
    pub saved: Saved,
    anchor: Option<(u64, u64)>,
    pub ring: Option<String>,
    pub ring_started: Option<u64>,
}
impl Kernel {
    pub fn new(mut saved: Saved, clock: Clock) -> Self {
        saved.version = 2;
        if !["clock", "timer", "alarm"].contains(&saved.mode.as_str()) {
            saved.mode = "timer".into();
        }
        if !["dial", "flip"].contains(&saved.view.as_str()) {
            saved.view = "dial".into();
        }
        if saved.timer.duration_ms == 0 || saved.timer.duration_ms > 86_400_000 {
            saved.timer = Timer::default();
        }
        saved.timer.remaining_ms = saved.timer.remaining_ms.min(saved.timer.duration_ms);
        saved.settings = sanitize_settings(saved.settings);
        if parse_time(&saved.alarm.time).is_none() {
            saved.alarm = Alarm::default();
        }
        let anchor = if saved.timer.status == TimerStatus::Running {
            let remaining = saved
                .timer
                .deadline_wall_ms
                .map(|d| d.saturating_sub(clock.wall_ms).max(0) as u64)
                .unwrap_or(saved.timer.remaining_ms)
                .min(saved.timer.duration_ms);
            saved.timer.remaining_ms = remaining;
            Some((clock.continuous_ms, remaining))
        } else {
            None
        };
        if saved.alarm.enabled && saved.alarm.next_at.is_none() {
            saved.alarm.next_at = next_alarm(&saved.alarm.time, clock.wall_ms);
        }
        Self {
            saved,
            anchor,
            ring: None,
            ring_started: None,
        }
    }
    pub fn remaining(&self, clock: Clock) -> u64 {
        if self.saved.timer.status == TimerStatus::Running {
            self.anchor
                .map(|(start, remaining)| {
                    remaining.saturating_sub(clock.continuous_ms.saturating_sub(start))
                })
                .unwrap_or(0)
        } else {
            self.saved.timer.remaining_ms
        }
    }
    pub fn snapshot(
        &self,
        clock: Clock,
        audio_available: bool,
        storage_error: Option<String>,
    ) -> Snapshot {
        let remaining = self.remaining(clock);
        let mut saved = self.saved.clone();
        saved.timer.remaining_ms = remaining;
        if saved.timer.status == TimerStatus::Running {
            saved.timer.deadline_wall_ms = Some(clock.wall_ms.saturating_add(remaining as i64));
        }
        Snapshot {
            saved,
            now_ms: clock.wall_ms,
            remaining_ms: remaining,
            ring: self.ring.clone(),
            audio_available,
            storage_error,
        }
    }
    pub fn apply(&mut self, action: Action, clock: Clock) -> Result<(), String> {
        match action {
            Action::Start => {
                if self.saved.timer.status != TimerStatus::Running {
                    if self.saved.timer.status == TimerStatus::Finished
                        || self.saved.timer.remaining_ms == 0
                    {
                        self.saved.timer.remaining_ms = self.saved.timer.duration_ms;
                    }
                    self.anchor = Some((clock.continuous_ms, self.saved.timer.remaining_ms));
                    self.saved.timer.status = TimerStatus::Running;
                    self.saved.timer.deadline_wall_ms =
                        Some(clock.wall_ms + self.saved.timer.remaining_ms as i64);
                }
            }
            Action::Pause => {
                if self.saved.timer.status == TimerStatus::Running {
                    self.saved.timer.remaining_ms = self.remaining(clock);
                    self.saved.timer.status = TimerStatus::Paused;
                    self.saved.timer.deadline_wall_ms = None;
                    self.anchor = None;
                }
            }
            Action::Reset => {
                self.saved.timer.remaining_ms = self.saved.timer.duration_ms;
                self.saved.timer.status = TimerStatus::Idle;
                self.saved.timer.deadline_wall_ms = None;
                self.anchor = None;
            }
            Action::SetDuration { ms } => {
                if self.saved.timer.status == TimerStatus::Running {
                    return Err("请先暂停，再修改时长".into());
                }
                if ms == 0 || ms > 86_400_000 {
                    return Err("时长范围为 1 毫秒至 24 小时".into());
                }
                self.saved.timer = Timer {
                    duration_ms: ms,
                    remaining_ms: ms,
                    deadline_wall_ms: None,
                    status: TimerStatus::Idle,
                };
                self.anchor = None;
            }
            Action::SetMode { mode } => {
                if !["timer", "clock", "alarm"].contains(&mode.as_str()) {
                    return Err("未知模式".into());
                }
                self.saved.mode = mode;
            }
            Action::SetView { view } => {
                if !["dial", "flip"].contains(&view.as_str()) {
                    return Err("未知表盘".into());
                }
                self.saved.view = view;
            }
            Action::SetAlarm { time, enabled } => {
                if parse_time(&time).is_none() {
                    return Err("请输入有效的闹钟时间".into());
                }
                self.saved.alarm = Alarm {
                    next_at: if enabled {
                        next_alarm(&time, clock.wall_ms)
                    } else {
                        None
                    },
                    time,
                    enabled,
                    snooze_at: None,
                };
            }
            Action::Settings { settings } => self.saved.settings = sanitize_settings(settings),
            Action::Dismiss => {
                self.ring = None;
                self.ring_started = None;
            }
            Action::Snooze => {
                if self.ring.as_deref() == Some("timer") {
                    return Err("倒计时结束后请重新开始".into());
                }
                self.saved.alarm.snooze_at = Some(clock.wall_ms + 300_000);
                self.ring = None;
                self.ring_started = None;
            }
        }
        Ok(())
    }
    pub fn update(&mut self, clock: Clock) -> bool {
        let mut changed = false;
        if self.saved.timer.status == TimerStatus::Running && self.remaining(clock) == 0 {
            self.saved.timer.remaining_ms = 0;
            self.saved.timer.status = TimerStatus::Finished;
            self.saved.timer.deadline_wall_ms = None;
            self.anchor = None;
            self.ring = Some("timer".into());
            self.ring_started = Some(clock.continuous_ms);
            changed = true;
        }
        if self.saved.alarm.enabled
            && self
                .saved
                .alarm
                .next_at
                .is_some_and(|at| clock.wall_ms >= at)
        {
            let at = self.saved.alarm.next_at.unwrap();
            self.saved.alarm.next_at = next_alarm(&self.saved.alarm.time, clock.wall_ms);
            if clock.wall_ms - at < 86_400_000 {
                self.ring = Some("alarm".into());
                self.ring_started = Some(clock.continuous_ms);
            }
            changed = true;
        }
        if self
            .saved
            .alarm
            .snooze_at
            .is_some_and(|at| clock.wall_ms >= at)
        {
            self.saved.alarm.snooze_at = None;
            self.ring = Some("snooze".into());
            self.ring_started = Some(clock.continuous_ms);
            changed = true;
        }
        changed
    }
}
pub fn sanitize_settings(mut s: Settings) -> Settings {
    if !s.volume.is_finite() {
        s.volume = 0.35;
    }
    s.volume = s.volume.clamp(0., 1.);
    if !["steel", "ceramic", "wood"].contains(&s.tone.as_str()) {
        s.tone = "steel".into();
    }
    if !["dark", "light", "black"].contains(&s.theme.as_str()) {
        s.theme = "dark".into();
    }
    s
}
pub fn parse_time(time: &str) -> Option<(u32, u32)> {
    if time.len() != 5 || time.as_bytes()[2] != b':' {
        return None;
    }
    let h = time[0..2].parse::<u32>().ok()?;
    let m = time[3..5].parse::<u32>().ok()?;
    if h < 24 && m < 60 { Some((h, m)) } else { None }
}
pub fn next_alarm(time: &str, now: i64) -> Option<i64> {
    let (h, m) = parse_time(time)?;
    let now = Local.timestamp_millis_opt(now).single()?;
    for day in 0..3 {
        let date = now
            .date_naive()
            .checked_add_signed(ChronoDuration::days(day))?;
        let value = date.and_hms_opt(h, m, 0)?;
        let candidates = match Local.from_local_datetime(&value) {
            LocalResult::Single(x) => vec![x],
            LocalResult::Ambiguous(a, b) => vec![a, b],
            LocalResult::None => vec![],
        };
        for candidate in candidates {
            if candidate > now {
                return Some(candidate.timestamp_millis());
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    fn c(w: i64, m: u64) -> Clock {
        Clock {
            wall_ms: w,
            continuous_ms: m,
        }
    }
    #[test]
    fn pause_and_resume_preserve_time() {
        let mut k = Kernel::new(Saved::default(), c(1000, 0));
        k.apply(Action::SetDuration { ms: 60000 }, c(1000, 0))
            .unwrap();
        k.apply(Action::Start, c(1000, 0)).unwrap();
        k.apply(Action::Pause, c(11000, 10000)).unwrap();
        assert_eq!(k.remaining(c(999999, 60000)), 50000);
        k.apply(Action::Start, c(999999, 60000)).unwrap();
        assert_eq!(k.remaining(c(1009999, 70000)), 40000);
    }
    #[test]
    fn manual_wall_clock_changes_do_not_change_running_countdown() {
        let mut k = Kernel::new(Saved::default(), c(1000, 0));
        k.apply(Action::Start, c(1000, 0)).unwrap();
        assert_eq!(k.remaining(c(3_601_000, 1000)), 1_499_000);
        assert_eq!(k.remaining(c(-9999, 2000)), 1_498_000);
        let snapshot = k.snapshot(c(-9999, 2000), true, None);
        assert_eq!(
            snapshot.saved.timer.deadline_wall_ms,
            Some(-9999 + 1_498_000)
        );
    }
    #[test]
    fn continuous_clock_accounts_for_sleep() {
        let mut k = Kernel::new(Saved::default(), c(1000, 0));
        k.apply(Action::SetDuration { ms: 10000 }, c(1000, 0))
            .unwrap();
        k.apply(Action::Start, c(1000, 0)).unwrap();
        assert!(k.update(c(21000, 20000)));
        assert_eq!(k.ring.as_deref(), Some("timer"));
        assert!(!k.update(c(22000, 21000)));
    }
    #[test]
    fn persisted_deadline_recovers_after_restart() {
        let mut k = Kernel::new(Saved::default(), c(1000, 0));
        k.apply(Action::Start, c(1000, 0)).unwrap();
        let saved = k.snapshot(c(11000, 10000), true, None).saved;
        let restored = Kernel::new(saved, c(21000, 0));
        assert_eq!(restored.remaining(c(22000, 1000)), 1_479_000);
    }
    #[test]
    fn expiry_is_not_duplicated() {
        let mut k = Kernel::new(Saved::default(), c(0, 0));
        k.apply(Action::SetDuration { ms: 1000 }, c(0, 0)).unwrap();
        k.apply(Action::Start, c(0, 0)).unwrap();
        assert!(k.update(c(1000, 1000)));
        k.apply(Action::Dismiss, c(1001, 1001)).unwrap();
        assert!(!k.update(c(2000, 2000)));
        assert_eq!(k.ring, None);
    }
    #[test]
    fn cannot_reset_duration_while_running() {
        let mut k = Kernel::new(Saved::default(), c(0, 0));
        k.apply(Action::Start, c(0, 0)).unwrap();
        assert!(k.apply(Action::SetDuration { ms: 1000 }, c(1, 1)).is_err());
    }
    #[test]
    fn invalid_times_are_rejected_without_mutating_alarm() {
        let mut k = Kernel::new(Saved::default(), c(0, 0));
        for s in ["99:99", "9:00", "abc", "12:60"] {
            assert!(
                k.apply(
                    Action::SetAlarm {
                        time: s.into(),
                        enabled: true
                    },
                    c(0, 0)
                )
                .is_err()
            );
        }
        assert!(!k.saved.alarm.enabled);
    }
    #[test]
    fn snooze_is_one_shot() {
        let mut k = Kernel::new(Saved::default(), c(0, 0));
        k.ring = Some("alarm".into());
        k.apply(Action::Snooze, c(0, 0)).unwrap();
        assert!(!k.update(c(299999, 299999)));
        assert!(k.update(c(300000, 300000)));
        k.apply(Action::Dismiss, c(300001, 300001)).unwrap();
        assert!(!k.update(c(400000, 400000)));
    }
    #[test]
    fn settings_are_sanitized() {
        let bad = Settings {
            volume: f32::NAN,
            tone: "x".into(),
            ..Settings::default()
        };
        let good = sanitize_settings(bad);
        assert_eq!(good.volume, 0.35);
        assert_eq!(good.tone, "steel");
    }
    #[test]
    fn daily_alarm_fires_once_and_reschedules() {
        let now = Local
            .with_ymd_and_hms(2026, 10, 16, 8, 0, 0)
            .unwrap()
            .timestamp_millis();
        let mut k = Kernel::new(Saved::default(), c(now, 0));
        k.apply(
            Action::SetAlarm {
                time: "09:00".into(),
                enabled: true,
            },
            c(now, 0),
        )
        .unwrap();
        assert!(k.update(c(now + 3_600_000, 3_600_000)));
        let next = k.saved.alarm.next_at.unwrap();
        assert!(next > now + 3_600_000);
        assert!(!k.update(c(now + 3_600_001, 3_600_001)));
    }
}
