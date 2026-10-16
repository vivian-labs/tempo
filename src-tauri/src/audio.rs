use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::{
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
        mpsc,
    },
    time::{Duration, Instant},
};

#[derive(Clone, Copy)]
pub struct SoundConfig {
    pub enabled: bool,
    pub volume: f32,
    pub tone: u8,
}
pub enum Command {
    Configure(SoundConfig),
    Tick { flap: bool, strength: f32 },
    Preview,
    Alarm,
    Stop,
}
#[derive(Clone, Copy)]
enum RenderCommand {
    Play {
        volume: f32,
        tone: u8,
        kind: u8,
        at: Instant,
    },
    Clear,
}
#[derive(Clone)]
pub struct Audio {
    sender: mpsc::Sender<Command>,
    pub available: Arc<AtomicBool>,
}
impl Audio {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::channel();
        let available = Arc::new(AtomicBool::new(true));
        let flag = available.clone();
        std::thread::Builder::new()
            .name("tempo-audio-control".into())
            .spawn(move || run(rx, flag))
            .expect("audio control thread");
        Self {
            sender: tx,
            available,
        }
    }
    pub fn send(&self, c: Command) {
        let _ = self.sender.send(c);
    }
    pub fn available(&self) -> bool {
        self.available.load(Ordering::Relaxed)
    }
}
fn run(rx: mpsc::Receiver<Command>, available: Arc<AtomicBool>) {
    let mut config = SoundConfig {
        enabled: false,
        volume: 0.35,
        tone: 0,
    };
    let mut output: Option<(cpal::Stream, rtrb::Producer<RenderCommand>)> = None;
    let mut playing = false;
    let mut last_play = Instant::now();
    loop {
        let message = if playing && !config.enabled {
            rx.recv_timeout(Duration::from_millis(200))
        } else {
            rx.recv().map_err(|_| mpsc::RecvTimeoutError::Disconnected)
        };
        let message = match message {
            Ok(c) => c,
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
            Err(mpsc::RecvTimeoutError::Timeout) => {
                if last_play.elapsed() > Duration::from_secs(1) {
                    if let Some((stream, _)) = &output {
                        let _ = stream.pause();
                    }
                    playing = false;
                }
                continue;
            }
        };
        let mut requests = [None; 5];
        match message {
            Command::Configure(c) => {
                config = c;
                if c.volume == 0. {
                    if let Some((_, queue)) = &mut output {
                        let _ = queue.push(RenderCommand::Clear);
                    }
                }
                if !c.enabled && playing && last_play.elapsed() > Duration::from_secs(1) {
                    if let Some((stream, _)) = &output {
                        let _ = stream.pause();
                    }
                    playing = false;
                }
                continue;
            }
            Command::Tick { flap, strength } => {
                if !config.enabled || config.volume == 0. {
                    continue;
                }
                requests[0] = Some((0., if flap { 1 } else { 0 }, strength));
            }
            Command::Preview => {
                requests[0] = Some((0., 0, 1.));
                requests[1] = Some((0.5, 1, 1.));
            }
            Command::Alarm => {
                for (i, r) in requests.iter_mut().take(4).enumerate() {
                    *r = Some((i as f32 * 0.16, 2, 1.25));
                }
            }
            Command::Stop => {
                if let Some((_, queue)) = &mut output {
                    let _ = queue.push(RenderCommand::Clear);
                }
                continue;
            }
        }
        if config.volume <= 0. {
            continue;
        }
        if output.is_none() || !available.load(Ordering::Relaxed) {
            output = None;
            playing = false;
            match open_output(available.clone()) {
                Ok(o) => {
                    output = Some(o);
                    available.store(true, Ordering::Relaxed);
                }
                Err(e) => {
                    available.store(false, Ordering::Relaxed);
                    eprintln!("TEMPO audio: {e}");
                    continue;
                }
            }
        }
        if let Some((stream, queue)) = &mut output {
            if !playing {
                if stream.play().is_err() {
                    available.store(false, Ordering::Relaxed);
                    continue;
                }
                playing = true;
            }
            let now = Instant::now();
            for (delay, kind, strength) in requests.into_iter().flatten() {
                let _ = queue.push(RenderCommand::Play {
                    volume: (config.volume * strength).clamp(0., 1.),
                    tone: config.tone,
                    kind,
                    at: now + Duration::from_secs_f32(delay),
                });
            }
            last_play = now;
        }
    }
}
fn open_output(
    available: Arc<AtomicBool>,
) -> Result<(cpal::Stream, rtrb::Producer<RenderCommand>), String> {
    let device = cpal::default_host()
        .default_output_device()
        .ok_or("没有可用的音频输出设备")?;
    let supported = device.default_output_config().map_err(|e| e.to_string())?;
    let config = supported.config();
    let producer = match supported.sample_format() {
        cpal::SampleFormat::F32 => build::<f32>(&device, config, available),
        cpal::SampleFormat::I16 => build::<i16>(&device, config, available),
        cpal::SampleFormat::U16 => build::<u16>(&device, config, available),
        _ => return Err("默认音频格式暂不支持".into()),
    }?;
    Ok(producer)
}
#[derive(Clone, Copy)]
struct Voice {
    active: bool,
    age: f32,
    volume: f32,
    tone: u8,
    kind: u8,
    seed: u32,
}
impl Default for Voice {
    fn default() -> Self {
        Self {
            active: false,
            age: 0.,
            volume: 0.,
            tone: 0,
            kind: 0,
            seed: 0x812734a1,
        }
    }
}
impl Voice {
    fn sample(&mut self, dt: f32) -> f32 {
        let age = self.age;
        self.age += dt;
        if age < 0. {
            return 0.;
        }
        let length = if self.kind == 2 {
            0.15
        } else if self.kind == 1 {
            0.09
        } else {
            0.04
        };
        if age >= length {
            self.active = false;
            return 0.;
        }
        self.seed ^= self.seed << 13;
        self.seed ^= self.seed >> 17;
        self.seed ^= self.seed << 5;
        let noise = (self.seed as f32 / u32::MAX as f32 * 2. - 1.) * (-age / 0.003).exp();
        let base = match self.tone {
            1 => 2450.,
            2 => 1050.,
            _ => 3980.,
        };
        let metal = (std::f32::consts::TAU * base * age).sin() * 0.18
            + (std::f32::consts::TAU * base * 1.493 * age).sin() * 0.09
            + (std::f32::consts::TAU * base * 2.213 * age).sin() * 0.045;
        let mut output = noise * 0.55 + metal * (-age / 0.009).exp();
        if self.kind == 1 && age > 0.035 {
            let x = age - 0.035;
            output +=
                (std::f32::consts::TAU * (230. - x * 1100.) * x).sin() * 0.23 * (-x / 0.012).exp();
        }
        if self.kind == 2 {
            output += ((std::f32::consts::TAU * 1780. * age).sin()
                + (std::f32::consts::TAU * 2830. * age).sin())
                * 0.13
                * (-age / 0.055).exp();
        }
        output * self.volume * 0.65
    }
}
fn build<T>(
    device: &cpal::Device,
    config: cpal::StreamConfig,
    available: Arc<AtomicBool>,
) -> Result<(cpal::Stream, rtrb::Producer<RenderCommand>), String>
where
    T: cpal::SizedSample + cpal::FromSample<f32>,
{
    let (mut producer, mut consumer) = rtrb::RingBuffer::<RenderCommand>::new(64);
    // Fixed voice storage, bounded queue, no heap allocation or mutex in the callback.
    let mut voices = [Voice::default(); 16];
    let channels = config.channels as usize;
    let dt = 1. / config.sample_rate as f32;
    let stream = device
        .build_output_stream(
            config,
            move |output: &mut [T], info: &cpal::OutputCallbackInfo| {
                let now = Instant::now();
                let stamp = info.timestamp();
                let lead = stamp.playback.duration_since(stamp.callback);
                while let Ok(cmd) = consumer.pop() {
                    match cmd {
                        RenderCommand::Clear => voices.fill(Voice::default()),
                        RenderCommand::Play {
                            volume,
                            tone,
                            kind,
                            at,
                        } => {
                            let index = voices.iter().position(|v| !v.active).unwrap_or(0);
                            let age = onset_age(at, now + lead);
                            voices[index] = Voice {
                                active: true,
                                age,
                                volume,
                                tone,
                                kind,
                                seed: 0x1829fa13 ^ (index as u32 * 17),
                            };
                        }
                    }
                }
                for frame in output.chunks_mut(channels) {
                    let mut value = 0.;
                    for voice in &mut voices {
                        if voice.active {
                            value += voice.sample(dt);
                        }
                    }
                    let sample = T::from_sample(value.clamp(-0.95, 0.95));
                    for channel in frame {
                        *channel = sample;
                    }
                }
            },
            move |_error| {
                available.store(false, Ordering::Relaxed);
            },
            None,
        )
        .map_err(|e| e.to_string())?;
    let _ = &mut producer;
    Ok((stream, producer))
}
// A late callback must preserve the attack of a short mechanical transient.
fn onset_age(at: Instant, audible: Instant) -> f32 {
    -at.saturating_duration_since(audible).as_secs_f32()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn late_audio_callbacks_preserve_the_attack() {
        let now = Instant::now();
        assert_eq!(onset_age(now, now + Duration::from_millis(80)), 0.);
        assert!((onset_age(now + Duration::from_millis(50), now) + 0.05).abs() < 0.0001);
    }
    #[test]
    fn synth_is_finite_bounded_and_short() {
        for kind in 0..3 {
            let mut v = Voice {
                active: true,
                volume: 1.,
                kind,
                ..Voice::default()
            };
            let mut peak = 0f32;
            for _ in 0..48000 {
                let x = if v.active { v.sample(1. / 48000.) } else { 0. };
                assert!(x.is_finite());
                peak = peak.max(x.abs());
            }
            assert!(peak > 0.01 && peak < 1.);
            assert!(!v.active);
        }
    }
    #[test]
    fn future_voice_is_silent_until_its_scheduled_time() {
        let mut v = Voice {
            active: true,
            age: -0.1,
            volume: 1.,
            ..Voice::default()
        };
        for _ in 0..100 {
            assert_eq!(v.sample(0.0001), 0.);
        }
    }
}
