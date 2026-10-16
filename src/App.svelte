<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Maximize,
    SlidersHorizontal,
    Volume2,
    VolumeX,
    RotateCcw,
    Play,
    Pause,
    Pin,
    Clock3,
    PanelsTopLeft,
    ArrowUpRight,
  } from '@lucide/svelte';
  import Dial from './components/Dial.svelte';
  import FlipClock from './components/FlipClock.svelte';
  import SettingsPanel from './components/Settings.svelte';
  import {
    defaults,
    type Snapshot,
    type Action,
    type Settings,
    type Mode,
    type View,
  } from './types';
  import {
    connect,
    dispatch,
    native,
    previewSound,
    setFullscreen,
    leaveFullscreen,
    setPinned,
    attention,
  } from './lib/transport';
  import {
    formatDuration,
    durationParts,
    pad,
    parseDuration,
    scaleMinutes,
  } from './lib/time';
  let model = $state<Snapshot>(structuredClone(defaults)),
    settingsOpen = $state(false),
    pinned = $state(false),
    fullscreen = $state(false),
    toast = $state(''),
    immersed = $state(false);
  let custom: HTMLDialogElement,
    ring: HTMLDialogElement,
    durationInput: HTMLInputElement,
    durationText = $state('25:00'),
    inputError = $state(''),
    alarmTime = $state('09:00');
  let toastTimer: ReturnType<typeof setTimeout>,
    hideTimer: ReturnType<typeof setTimeout>;
  let running = $derived(model.timer.status === 'running'),
    date = $derived(new Date(model.nowMs));
  let warning = $derived(
    model.settings.urgency &&
      model.mode === 'timer' &&
      running &&
      model.remainingMs / model.timer.durationMs <= 0.2,
  );
  let urgent = $derived(
    model.settings.urgency &&
      model.mode === 'timer' &&
      running &&
      model.remainingMs <= 60000,
  );
  let values = $derived<[string, string, string]>(
    model.mode === 'timer'
      ? durationParts(model.remainingMs)
      : model.mode === 'alarm'
        ? [model.alarm.time.slice(0, 2), model.alarm.time.slice(3), '00']
        : [
            pad(date.getHours()),
            pad(date.getMinutes()),
            pad(date.getSeconds()),
          ],
  );
  let display = $derived(
    model.mode === 'timer'
      ? formatDuration(model.remainingMs)
      : model.mode === 'alarm'
        ? model.alarm.time
        : values.join(':'),
  );
  let badge = $derived(
    model.mode === 'clock'
      ? '此刻，当下'
      : model.mode === 'alarm'
        ? model.alarm.enabled
          ? '每日提醒已开启'
          : '闹钟未开启'
        : {
            idle: '准备就绪',
            paused: '已暂停',
            running: urgent
              ? '最后一分钟'
              : warning
                ? '时间正在收紧'
                : '专注进行中',
            finished: '时间到了',
          }[model.timer.status],
  );
  let caption = $derived(
    model.mode === 'clock'
      ? date.toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
        })
      : model.mode === 'alarm'
        ? model.alarm.snoozeAt
          ? '稍后提醒 · ' +
            new Date(model.alarm.snoozeAt).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : model.alarm.enabled && model.alarm.nextAt
            ? '下次响铃 · ' +
              new Date(model.alarm.nextAt).toLocaleString('zh-CN', {
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '保持应用运行，约定的提醒才会响起。'
        : running
          ? urgent
            ? '每一秒，都在靠近终点。'
            : '此刻，只做这一件事。'
          : model.timer.status === 'paused'
            ? '短暂停留，随时继续。'
            : '留给重要的事，一段完整的时间。',
  );
  function notify(message: string) {
    toast = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = ''), 2600);
  }
  async function act(action: Action) {
    try {
      model = await dispatch(action);
    } catch (e) {
      notify(String(e));
    }
  }
  function activity() {
    immersed = false;
    clearTimeout(hideTimer);
    if (model.settings.hideChrome)
      hideTimer = setTimeout(() => {
        if (!settingsOpen && !custom?.open && !ring?.open) immersed = true;
      }, 4500);
  }
  async function changeSettings(settings: Settings) {
    await act({ type: 'settings', settings });
    activity();
  }
  async function toggleSound() {
    await changeSettings({ ...model.settings, sound: !model.settings.sound });
    if (model.settings.sound) await previewSound();
  }
  async function full() {
    try {
      fullscreen = await setFullscreen();
    } catch {
      notify('当前环境暂不支持全屏');
    }
  }
  async function pin() {
    if (!native) return notify('置顶功能请使用桌面版');
    pinned = await setPinned();
    notify(pinned ? '窗口已置顶' : '已取消置顶');
  }
  function editDuration() {
    if (running) return notify('请先暂停，再修改时长');
    durationText = formatDuration(model.timer.durationMs);
    inputError = '';
    custom.showModal();
    durationInput.select();
  }
  async function confirmDuration(e: SubmitEvent) {
    e.preventDefault();
    const ms = parseDuration(durationText);
    if (ms === null) {
      inputError = '请输入有效时长，范围为 1 秒至 24 小时。';
      return;
    }
    await act({ type: 'setDuration', ms });
    custom.close();
  }
  function key(e: KeyboardEvent) {
    activity();
    if (e.key === 'Escape') {
      if (settingsOpen) {
        settingsOpen = false;
        return;
      }
      if (!custom?.open && !ring?.open) {
        leaveFullscreen();
        fullscreen = false;
      }
      return;
    }
    if (
      e.repeat ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      settingsOpen ||
      custom?.open ||
      ring?.open ||
      ['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'].includes(
        (e.target as HTMLElement)?.tagName,
      )
    )
      return;
    switch (e.key.toLowerCase()) {
      case ' ':
        if (model.mode === 'timer') {
          e.preventDefault();
          act({ type: running ? 'pause' : 'start' });
        }
        break;
      case 'r':
        if (model.mode === 'timer') act({ type: 'reset' });
        break;
      case 'f':
        full();
        break;
      case 'm':
        toggleSound();
        break;
      case 'p':
        pin();
        break;
      case '1':
        act({ type: 'setView', view: 'dial' });
        break;
      case '2':
        act({ type: 'setView', view: 'flip' });
        break;
      case ',':
        settingsOpen = true;
        break;
    }
  }
  $effect(() => {
    if (model.ring && ring && !ring.open) {
      immersed = false;
      ring.showModal();
      attention();
    } else if (!model.ring && ring?.open) ring.close();
  });
  let alarmValue = $derived(model.alarm.time);
  $effect(() => {
    alarmTime = alarmValue;
  });
  onMount(() => {
    let disposed = false,
      stop: () => void = () => {};
    connect((value) => (model = value))
      .then((unsubscribe) => {
        if (disposed) unsubscribe();
        else stop = unsubscribe;
      })
      .catch((e) => notify(String(e)));
    return () => {
      disposed = true;
      stop();
      clearTimeout(toastTimer);
      clearTimeout(hideTimer);
    };
  });
</script>

<svelte:window
  onkeydown={key}
  onpointermove={activity}
  onpointerdown={activity}
/>
<div
  class="app-shell"
  data-theme={model.settings.theme}
  data-mode={model.mode}
  data-view={model.view}
  class:urgent
  class:warning
  class:running
  class:immersed
  class:ringing={!!model.ring}
>
  <header class="topbar chrome">
    <button
      class="brand"
      onclick={() => act({ type: 'setMode', mode: 'timer' })}
      aria-label="TEMPO 首页"
      ><span class="brand-mark">✳</span><span
        >TEMPO<span class="brand-period">.</span></span
      ></button
    >
    <nav class="mode-switch" aria-label="计时模式">
      {#each [['clock', '时钟'], ['timer', '倒计时'], ['alarm', '闹钟']] as [mode, label]}<button
          class:selected={model.mode === mode}
          aria-pressed={model.mode === mode}
          onclick={() => act({ type: 'setMode', mode: mode as Mode })}
          >{label}</button
        >{/each}
    </nav>
    <div class="header-actions">
      <button
        id="pin"
        class="icon-button"
        class:active={pinned}
        aria-label="窗口置顶"
        title="置顶 · P"
        onclick={pin}><Pin /></button
      ><button
        id="fullscreen"
        class="icon-button"
        class:active={fullscreen}
        aria-label="全屏"
        title="全屏 · F"
        onclick={full}><Maximize /></button
      ><button
        class="icon-button"
        aria-label="声音与外观设置"
        title="设置 · ,"
        onclick={() => (settingsOpen = true)}><SlidersHorizontal /></button
      >
    </div>
  </header>
  <main>
    <section class="instrument-heading chrome">
      <div>
        <span class="eyebrow">THE ART OF KEEPING TIME</span>
        <h1>
          {model.mode === 'clock'
            ? '让时间，慢慢走。'
            : model.mode === 'alarm'
              ? '为下一刻，定个约。'
              : '让每一刻，有分量。'}
        </h1>
      </div>
      <div class="view-switch" aria-label="表盘外观">
        {#each [['dial', '机械'], ['flip', '翻页']] as [view, label]}<button
            class:selected={model.view === view}
            aria-pressed={model.view === view}
            onclick={() => act({ type: 'setView', view: view as View })}
            >{#if view === 'dial'}<Clock3 size={13} />{:else}<PanelsTopLeft
                size={13}
              />{/if}{label}</button
          >{/each}
      </div>
    </section>
    <section class="stage" aria-label="时间仪表">
      <aside class="annotation annotation-left chrome">
        <span class="annotation-number">02 / INSTRUMENT</span><span
          class="hairline"
        ></span><strong
          >{model.mode === 'timer'
            ? '机械倒计时'
            : model.mode === 'clock'
              ? '机械时钟'
              : '每日闹钟'}</strong
        >
        <p>
          {model.mode === 'timer' ? '旋转指针，给此刻' : '一秒，一次落点。'}<br
          />{model.mode === 'timer' ? '一个明确的期限。' : '时间有自己的步调。'}
        </p>
        <span class="annotation-detail"
          >{model.mode === 'timer'
            ? scaleMinutes(model.timer.durationMs) + ' MIN'
            : '12 HOUR'} · PRECISION DIAL</span
        >
      </aside>
      {#if model.view === 'dial'}{#key model.mode}<Dial
            mode={model.mode}
            nowMs={model.nowMs}
            remainingMs={model.remainingMs}
            durationMs={model.timer.durationMs}
            step={model.settings.step}
            {running}
            onset={(ms) => act({ type: 'setDuration', ms })}
            onblocked={() => notify('请先暂停，再旋转指针')}
          />{/key}{:else}<FlipClock
          {values}
          date={date
            .toLocaleDateString('en-GB', {
              weekday: 'short',
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
            .toUpperCase()}
        />{/if}
      <aside class="annotation annotation-right chrome">
        <span class="live-status"
          ><i></i>{model.mode === 'timer'
            ? running
              ? urgent
                ? 'MAKE IT COUNT'
                : 'TIME IS MOVING'
              : 'READY WHEN YOU ARE'
            : model.mode === 'clock'
              ? 'LOCAL TIME'
              : model.alarm.enabled
                ? 'ALARM ARMED'
                : 'ALARM OFF'}</span
        ><strong id="status-number"
          >{model.mode === 'timer'
            ? Math.ceil(model.remainingMs / 60000)
            : model.mode === 'clock'
              ? pad(date.getHours())
              : model.alarm.time}<span
            >{model.mode === 'timer'
              ? 'min'
              : model.mode === 'clock'
                ? 'hour'
                : ''}</span
          ></strong
        ><span class="hairline"></span>
        <p>
          {running && model.mode === 'timer'
            ? `已流逝 ${Math.floor((1 - model.remainingMs / model.timer.durationMs) * 100)}%`
            : '时间正在等待'}<br />{running
            ? '让注意力，回到此刻。'
            : '你的开始。'}
        </p>
        <div class="mini-meter">
          <i
            style:width={`${Math.min(100, (model.remainingMs / model.timer.durationMs) * 100)}%`}
          ></i>
        </div>
      </aside>
    </section>
    <section class="readout">
      <span class="state-badge"><i></i><span>{badge}</span></span
      >{#if model.settings.showReadout}<div
          id="time-readout"
          class="time-readout"
          aria-live="off"
        >
          {display}
        </div>{/if}
      <p id="readout-caption">{caption}</p>
    </section>
    <section class="control-deck chrome" aria-label="计时控制">
      {#if model.mode === 'timer'}<div class="timer-controls">
          <div class="preset-row">
            <span class="deck-label">DURATION</span
            >{#each [5, 15, 25, 45] as minutes}<button
                class:selected={model.timer.durationMs === minutes * 60000}
                onclick={() =>
                  act({ type: 'setDuration', ms: minutes * 60000 })}
                >{minutes}<span>分钟</span></button
              >{/each}<button id="custom-duration" onclick={editDuration}
              >自定义 <ArrowUpRight size={11} /></button
            >
          </div>
          <div class="transport">
            <button
              id="reset"
              class="icon-button reset-button"
              aria-label="重置倒计时"
              title="重置 · R"
              onclick={() => act({ type: 'reset' })}><RotateCcw /></button
            ><button
              id="start"
              class="start-button"
              onclick={() => act({ type: running ? 'pause' : 'start' })}
              >{#if running}<Pause />{:else}<Play />{/if}<span
                >{running
                  ? '暂停片刻'
                  : model.timer.status === 'paused'
                    ? '继续专注'
                    : model.timer.status === 'finished'
                      ? '再来一轮'
                      : '开始专注'}</span
              ><kbd>SPACE</kbd></button
            >
          </div>
        </div>
      {:else if model.mode === 'alarm'}<div class="alarm-controls">
          <div>
            <span class="deck-label">DAILY ALARM</span><label for="alarm-time"
              >每天，于此刻响起</label
            >
          </div>
          <input
            id="alarm-time"
            type="time"
            bind:value={alarmTime}
            aria-label="每日闹钟时间"
            onchange={() =>
              act({
                type: 'setAlarm',
                time: alarmTime,
                enabled: model.alarm.enabled,
              })}
          /><button
            id="alarm-toggle"
            class="start-button"
            onclick={() =>
              act({
                type: 'setAlarm',
                time: alarmTime,
                enabled: !model.alarm.enabled,
              })}>{model.alarm.enabled ? '关闭闹钟' : '开启闹钟'}</button
          >
        </div>
      {:else}<div class="clock-controls">
          <span class="deck-label">LOCAL TIME</span><span
            >{date.toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}</span
          ><span class="clock-note">把时间，留在眼前。</span>
        </div>{/if}
    </section>
  </main>
  <footer class="chrome">
    <span
      ><i class="footer-dot"></i>{native
        ? model.mode === 'timer'
          ? 'MECHANICAL COUNTDOWN'
          : model.mode === 'clock'
            ? 'MECHANICAL CLOCK'
            : 'DAILY ALARM'
        : 'BROWSER PREVIEW'}</span
    ><span class="footer-shortcuts"
      >F 全屏 <b>·</b> M 滴答 <b>·</b> 1 / 2 切换表盘</span
    ><button
      id="sound-toggle"
      class="sound-toggle"
      class:enabled={model.settings.sound}
      aria-label={model.settings.sound ? '关闭机械滴答声' : '开启机械滴答声'}
      onclick={toggleSound}
      >{#if model.settings.sound}<Volume2 />{:else}<VolumeX />{/if}<span
        >机械声 · {model.settings.sound ? '开启' : '关闭'}</span
      ></button
    >
  </footer>
  {#if model.storageError}<div class="storage-warning" role="status">
      设置暂时无法保存，请检查磁盘空间或目录权限。
    </div>{/if}
  {#if settingsOpen}<SettingsPanel
      settings={model.settings}
      onchange={changeSettings}
      onclose={() => (settingsOpen = false)}
      onpreview={previewSound}
      audioAvailable={model.audioAvailable}
    />{/if}
  <dialog bind:this={custom} id="duration-dialog">
    <form onsubmit={confirmDuration}>
      <span class="eyebrow">SET YOUR INTENTION</span>
      <h2>给自己，多长时间？</h2>
      <label for="duration-input">分钟，或 分:秒 / 时:分:秒</label><input
        bind:this={durationInput}
        id="duration-input"
        type="text"
        inputmode="numeric"
        bind:value={durationText}
        autocomplete="off"
        maxlength="10"
      />
      <p id="duration-error" role="alert">{inputError}</p>
      <div class="dialog-actions">
        <button type="button" class="text-button" onclick={() => custom.close()}
          >取消</button
        ><button type="submit" class="start-button">设置时长</button>
      </div>
    </form>
  </dialog>
  <dialog
    bind:this={ring}
    id="ring-dialog"
    oncancel={(e) => {
      e.preventDefault();
      act({ type: 'dismiss' });
    }}
  >
    <div class="ring-icon">✳</div>
    <span class="eyebrow">A MOMENT, COMPLETE.</span>
    <h2>{model.ring === 'timer' ? '时间到了。' : '约定的时刻，到了。'}</h2>
    <p>这一刻，告一段落。</p>
    <div class="dialog-actions">
      {#if model.ring !== 'timer'}<button
          class="text-button"
          onclick={() => act({ type: 'snooze' })}>5 分钟后提醒</button
        >{/if}<button
        class="start-button"
        onclick={() => act({ type: 'dismiss' })}>结束铃声</button
      >
    </div>
  </dialog>
  <div class="toast" class:show={!!toast} role="status">{toast}</div>
</div>
