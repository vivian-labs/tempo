use crate::{audio, clock, engine};
use engine::{Action, Kernel, Saved, Snapshot, TimerStatus};
use std::{
    path::PathBuf,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager};

#[derive(Clone)]
struct Runtime {
    kernel: Arc<Mutex<Kernel>>,
    audio: audio::Audio,
    file: PathBuf,
    storage_error: Arc<Mutex<Option<String>>>,
    fullscreen: Arc<AtomicBool>,
}
impl Runtime {
    fn snapshot(&self) -> Snapshot {
        self.kernel
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .snapshot(
                clock::sample(),
                self.audio.available(),
                self.storage_error
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .clone(),
            )
    }
    fn persist(&self) {
        let result = (|| -> Result<(), Box<dyn std::error::Error>> {
            let snapshot = self.snapshot();
            if let Some(parent) = self.file.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let tmp = self.file.with_extension("tmp");
            let data = serde_json::to_vec_pretty(&snapshot.saved)?;
            std::fs::write(&tmp, data)?;
            std::fs::rename(tmp, &self.file)?;
            Ok(())
        })();
        *self.storage_error.lock().unwrap_or_else(|e| e.into_inner()) =
            result.err().map(|e| e.to_string());
    }
    fn configure_audio(&self) {
        let snapshot = self.snapshot();
        let s = snapshot.saved.settings;
        self.audio
            .send(audio::Command::Configure(audio::SoundConfig {
                enabled: s.sound,
                volume: s.volume,
                tone: match s.tone.as_str() {
                    "ceramic" => 1,
                    "wood" => 2,
                    _ => 0,
                },
            }));
    }
}
#[tauri::command]
fn snapshot(state: tauri::State<Runtime>) -> Snapshot {
    state.snapshot()
}
#[tauri::command]
fn dispatch(
    action: Action,
    state: tauri::State<Runtime>,
    app: tauri::AppHandle,
) -> Result<Snapshot, String> {
    let stop = matches!(action, Action::Dismiss | Action::Snooze);
    state
        .kernel
        .lock()
        .map_err(|_| "计时状态暂不可用")?
        .apply(action, clock::sample())?;
    if stop {
        state.audio.send(audio::Command::Stop);
    }
    state.configure_audio();
    state.persist();
    let value = state.snapshot();
    let _ = app.emit("tempo:snapshot", &value);
    Ok(value)
}
#[tauri::command]
fn preview_sound(state: tauri::State<Runtime>) {
    state.configure_audio();
    state.audio.send(audio::Command::Preview);
}
#[tauri::command]
fn set_fullscreen_awake(enabled: bool, state: tauri::State<Runtime>) {
    state.fullscreen.store(enabled, Ordering::Relaxed);
}
fn worker(runtime: Runtime, app: tauri::AppHandle) {
    std::thread::Builder::new()
        .name("tempo-timekeeper".into())
        .spawn(move || {
            let mut next_ring = Instant::now();
            let mut guard = None;
            let mut last_saved = Instant::now();
            let mut prior = clock::sample();
            let mut previous_ring = false;
            loop {
                let now = clock::sample();
                let changed = runtime
                    .kernel
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .update(now);
                let value = runtime.snapshot();
                let ringing = value.ring.is_some();
                if ringing {
                    let should_sound = {
                        let kernel = runtime.kernel.lock().unwrap_or_else(|e| e.into_inner());
                        kernel
                            .ring_started
                            .is_some_and(|at| now.continuous_ms.saturating_sub(at) < 60_000)
                    };
                    if should_sound && (!previous_ring || Instant::now() >= next_ring) {
                        runtime.audio.send(audio::Command::Alarm);
                        next_ring = Instant::now() + Duration::from_millis(1600);
                    }
                } else if value.saved.settings.sound
                    && (value.saved.mode == "clock"
                        || value.saved.mode == "timer"
                            && value.saved.timer.status == TimerStatus::Running)
                {
                    runtime.audio.send(audio::Command::Tick {
                        flap: value.saved.view == "flip",
                        strength: if value.saved.settings.urgency
                            && value.saved.mode == "timer"
                            && value.remaining_ms <= 60_000
                        {
                            1.2
                        } else {
                            1.
                        },
                    });
                }
                if previous_ring && !ringing {
                    runtime.audio.send(audio::Command::Stop);
                }
                previous_ring = ringing;
                let awake = value.saved.timer.status == TimerStatus::Running
                    || runtime.fullscreen.load(Ordering::Relaxed);
                if awake && guard.is_none() {
                    guard = keepawake::Builder::default()
                        .display(true)
                        .idle(false)
                        .sleep(false)
                        .app_name("TEMPO")
                        .reason("Active timer or fullscreen instrument")
                        .create()
                        .ok();
                }
                if !awake {
                    guard = None;
                }
                let wall_delta = now.wall_ms - prior.wall_ms;
                let mono_delta = now.continuous_ms.saturating_sub(prior.continuous_ms) as i64;
                if changed
                    || last_saved.elapsed() >= Duration::from_secs(15)
                    || (wall_delta - mono_delta).abs() > 2000
                {
                    runtime.persist();
                    last_saved = Instant::now();
                }
                prior = now;
                let _ = app.emit("tempo:snapshot", value);
                let till_second = (1000 - now.wall_ms.rem_euclid(1000)) as u64;
                let remaining = runtime
                    .kernel
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .remaining(clock::sample());
                let wait = if remaining > 0 && remaining < till_second {
                    remaining
                } else {
                    till_second
                };
                std::thread::sleep(Duration::from_millis(wait.clamp(10, 1000)));
            }
        })
        .expect("timekeeper thread");
}
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            snapshot,
            dispatch,
            preview_sound,
            set_fullscreen_awake
        ])
        .setup(|app| {
            let directory = std::env::var_os("TEMPO_DATA_DIR")
                .map(PathBuf::from)
                .unwrap_or(app.path().app_data_dir()?);
            let file = directory.join("state-v2.json");
            let saved = std::fs::read(&file)
                .ok()
                .and_then(|data| serde_json::from_slice::<Saved>(&data).ok())
                .unwrap_or_default();
            let runtime = Runtime {
                kernel: Arc::new(Mutex::new(Kernel::new(saved, clock::sample()))),
                audio: audio::Audio::new(),
                file,
                storage_error: Arc::new(Mutex::new(None)),
                fullscreen: Arc::new(AtomicBool::new(false)),
            };
            runtime.configure_audio();
            app.manage(runtime.clone());
            let builder = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("TEMPO")
            .inner_size(1440., 1000.)
            .min_inner_size(620., 670.)
            .background_color(tauri::window::Color(21, 23, 22, 255));
            #[cfg(windows)]
            let builder = if let Ok(port) = std::env::var("TEMPO_DEBUG_PORT") {
                if let Ok(port) = port.parse::<u16>() {
                    builder.additional_browser_args(&format!("--remote-debugging-port={port}"))
                } else {
                    builder
                }
            } else {
                builder
            };
            builder.build()?;
            worker(runtime, app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                if let Some(runtime) = window.app_handle().try_state::<Runtime>() {
                    runtime.persist();
                    runtime.audio.send(audio::Command::Stop);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("TEMPO desktop runtime");
}
