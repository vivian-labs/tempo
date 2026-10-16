use crate::engine::Clock;
pub fn sample() -> Clock {
    Clock {
        wall_ms: chrono::Utc::now().timestamp_millis(),
        continuous_ms: continuous_ms(),
    }
}
#[cfg(windows)]
fn continuous_ms() -> u64 {
    unsafe extern "system" {
        fn GetTickCount64() -> u64;
    }
    unsafe { GetTickCount64() }
}
#[cfg(target_os = "macos")]
fn continuous_ms() -> u64 {
    #[repr(C)]
    struct Timebase {
        numer: u32,
        denom: u32,
    }
    unsafe extern "C" {
        fn mach_continuous_time() -> u64;
        fn mach_timebase_info(info: *mut Timebase) -> i32;
    }
    use std::sync::OnceLock;
    static SCALE: OnceLock<(u64, u64)> = OnceLock::new();
    let &(num, den) = SCALE.get_or_init(|| {
        let mut t = Timebase { numer: 1, denom: 1 };
        unsafe { mach_timebase_info(&mut t) };
        (t.numer as u64, t.denom as u64)
    });
    ((unsafe { mach_continuous_time() } as u128 * num as u128) / (den as u128 * 1_000_000)) as u64
}
#[cfg(not(any(windows, target_os = "macos")))]
fn continuous_ms() -> u64 {
    use std::{sync::OnceLock, time::Instant};
    static START: OnceLock<Instant> = OnceLock::new();
    START.get_or_init(Instant::now).elapsed().as_millis() as u64
}
