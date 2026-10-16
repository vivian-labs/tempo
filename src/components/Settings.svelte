<script lang="ts">
  import { X, Play } from '@lucide/svelte';
  import type { Settings, Tone, Theme } from '../types';
  let {
    settings,
    onchange,
    onclose,
    onpreview,
    audioAvailable,
  }: {
    settings: Settings;
    onchange: (s: Settings) => void;
    onclose: () => void;
    onpreview: () => void;
    audioAvailable: boolean;
  } = $props();
  let closeButton: HTMLButtonElement;
  $effect(() => {
    closeButton?.focus();
  });
  function toggle(
    key: 'sound' | 'step' | 'urgency' | 'hideChrome' | 'showReadout',
  ) {
    onchange({ ...settings, [key]: !settings[key] });
  }
  function trap(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onclose();
    }
    if (e.key === 'Tab') {
      const els = [
        ...(e.currentTarget as HTMLElement).querySelectorAll<
          HTMLButtonElement | HTMLInputElement
        >('button,input'),
      ];
      if (e.shiftKey && document.activeElement === els[0]) {
        e.preventDefault();
        els.at(-1)?.focus();
      } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
        e.preventDefault();
        els[0]?.focus();
      }
    }
  }
</script>

<button class="drawer-backdrop" aria-label="关闭设置面板" onclick={onclose}
></button>
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="settings-drawer"
  role="dialog"
  aria-modal="true"
  aria-label="声音与外观设置"
  tabindex="-1"
  onkeydown={trap}
>
  <div class="drawer-heading">
    <div>
      <span class="eyebrow">MAKE IT YOURS</span>
      <h2>声音与质感</h2>
    </div>
    <button
      bind:this={closeButton}
      class="icon-button"
      aria-label="关闭设置"
      onclick={onclose}><X /></button
    >
  </div>
  <section>
    <h3>机械声音</h3>
    <p>清脆的触发。干净的衰减。</p>
    <div class="setting-line">
      <span>每秒滴答</span><button
        class="toggle"
        role="switch"
        aria-label="每秒滴答"
        aria-checked={settings.sound}
        onclick={() => toggle('sound')}><i></i></button
      >
    </div>
    <div class="tone-options">
      {#each [['steel', '冷钢', '锐利 · 冷静'], ['ceramic', '瓷片', '清脆 · 透亮'], ['wood', '木槌', '短促 · 干燥']] as [tone, name, hint]}<button
          class:selected={settings.tone === tone}
          onclick={() => onchange({ ...settings, tone: tone as Tone })}
          >{name}<span>{hint}</span></button
        >{/each}
    </div>
    <label class="volume-label" for="volume"
      >音量 <output>{Math.round(settings.volume * 100)}%</output></label
    ><input
      id="volume"
      type="range"
      min="0"
      max="100"
      step="1"
      value={Math.round(settings.volume * 100)}
      oninput={(e) =>
        onchange({ ...settings, volume: Number(e.currentTarget.value) / 100 })}
    />
    <button class="text-button preview-button" onclick={onpreview}
      ><Play size={13} />试听机械声</button
    >
    <p class="setting-hint">
      音量同时控制滴答和到时铃声。<br />关闭滴答不影响闹钟。
    </p>
    {#if !audioAvailable}<p class="audio-warning" role="status">
        音频设备暂不可用；连接后可再次试听。
      </p>{/if}
  </section>
  <section>
    <h3>运动与氛围</h3>
    {#each [['step', '指针逐秒跳动'], ['urgency', '临近结束增强紧迫感'], ['showReadout', '显示数字读数'], ['hideChrome', '静止后隐藏操作界面']] as [key, label]}<div
        class="setting-line"
      >
        <span>{label}</span><button
          class="toggle"
          role="switch"
          aria-label={label}
          aria-checked={settings[key as keyof Settings] === true}
          onclick={() =>
            toggle(key as 'step' | 'urgency' | 'showReadout' | 'hideChrome')}
          ><i></i></button
        >
      </div>{/each}
    <div class="theme-options">
      {#each [['dark', '墨黑'], ['light', '暖白'], ['black', '纯黑']] as [theme, label]}<button
          class:selected={settings.theme === theme}
          onclick={() => onchange({ ...settings, theme: theme as Theme })}
          ><i
            style:background={theme === 'light'
              ? '#e4e0d5'
              : theme === 'black'
                ? '#000'
                : '#20241e'}
          ></i>{label}</button
        >{/each}
    </div>
  </section>
  <section class="shortcuts">
    <h3>快捷操作</h3>
    {#each [['开始 / 暂停', 'SPACE'], ['重置倒计时', 'R'], ['全屏 / 退出全屏', 'F / ESC'], ['机械 / 翻页', '1 / 2'], ['窗口置顶', 'P']] as [label, key]}<p
      >
        <span>{label}</span><kbd>{key}</kbd>
      </p>{/each}
  </section>
  <p class="drawer-footnote">
    TEMPO 0.2 · 时间，有形。<br />闹钟需保持应用运行；电脑休眠时不会响铃。
  </p>
</div>
