<script lang="ts">
  import type { Mode } from '../types';
  import { sectorPath, scaleMinutes, durationFromPointer } from '../lib/time';
  let {
    mode,
    nowMs,
    remainingMs,
    durationMs,
    step,
    running,
    onset,
    onblocked,
  }: {
    mode: Mode;
    nowMs: number;
    remainingMs: number;
    durationMs: number;
    step: boolean;
    running: boolean;
    onset: (ms: number) => void;
    onblocked: () => void;
  } = $props();
  const marks = Array.from({ length: 60 }, (_, i) => i),
    submarks = Array.from({ length: 20 }, (_, i) => i);
  let isClock = $derived(mode !== 'timer'),
    scale = $derived(scaleMinutes(durationMs));
  let date = $derived(new Date(nowMs));
  let seconds = $derived(date.getSeconds() + date.getMilliseconds() / 1000);
  let raw = $derived(
    isClock
      ? seconds * 6
      : (Math.ceil(remainingMs / 1000) / (scale * 60)) * 360,
  );
  let angle = $state(0),
    lastRaw: number | null = null;
  $effect(() => {
    const value = raw;
    if (lastRaw === null || !isClock) {
      angle = value;
    } else {
      let delta = value - lastRaw;
      if (delta < -180) delta += 360;
      angle += delta;
    }
    lastRaw = value;
  });
  let drag = $state(false),
    draft = $state<number | null>(null);
  let visibleRemaining = $derived(draft ?? remainingMs);
  let visibleAngle = $derived(
    draft !== null ? (draft / (scale * 60000)) * 360 : angle,
  );
  let element: SVGSVGElement;
  function pointer(e: PointerEvent) {
    const r = element.getBoundingClientRect();
    draft = durationFromPointer(
      e.clientX - r.left - r.width / 2,
      e.clientY - r.top - r.height / 2,
      scale,
    );
  }
  function down(e: PointerEvent) {
    if (mode !== 'timer' || e.button !== 0) return;
    if (running) {
      onblocked();
      return;
    }
    drag = true;
    element.setPointerCapture(e.pointerId);
    pointer(e);
  }
  function up() {
    if (!drag) return;
    drag = false;
    if (draft !== null) onset(draft);
    draft = null;
  }
  function key(e: KeyboardEvent) {
    if (mode !== 'timer' || running) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      onset(
        Math.min(
          86400000,
          Math.max(
            15000,
            durationMs +
              (['ArrowUp', 'ArrowRight'].includes(e.key) ? 60000 : -60000),
          ),
        ),
      );
    }
  }
</script>

<div class="dial-object" class:dragging={drag}>
  <div class="dial-foot left"></div>
  <div class="dial-foot right"></div>
  <div class="dial-crown"><i></i></div>
  <div class="bezel">
    <div class="bezel-inner">
      <div class="dial-glass">
        <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (The analogue dial has pointer and arrow-key controls.) -->
        <svg
          bind:this={element}
          id="dial"
          viewBox="0 0 600 600"
          role="img"
          aria-label={isClock
            ? '机械指针时钟'
            : '机械倒计时，拖动或用方向键设置时长'}
          tabindex="0"
          onpointerdown={down}
          onpointermove={(e) => {
            if (drag) pointer(e);
          }}
          onpointerup={up}
          onpointercancel={() => {
            drag = false;
            draft = null;
          }}
          onkeydown={key}
        >
          <defs>
            <radialGradient id="face" cx="42%" cy="30%" r="75%"
              ><stop offset="0" stop-color="#faf7ee" /><stop
                offset=".72"
                stop-color="#eeeade"
              /><stop offset="1" stop-color="#dcd6c9" /></radialGradient
            >
            <linearGradient id="needleMetal" x1="0" x2="1"
              ><stop stop-color="#111a19" /><stop
                offset=".46"
                stop-color="#4b5652"
              /><stop offset=".49" stop-color="#18221f" /><stop
                offset="1"
                stop-color="#08100d"
              /></linearGradient
            >
            <radialGradient id="hubMetal"
              ><stop stop-color="#e9e3d6" /><stop
                offset=".35"
                stop-color="#a4a599"
              /><stop offset=".6" stop-color="#3d4741" /><stop
                offset=".8"
                stop-color="#7d8478"
              /><stop offset="1" stop-color="#1c2520" /></radialGradient
            >
            <filter
              id="handShadow"
              x="-100%"
              y="-100%"
              width="300%"
              height="300%"
              ><feDropShadow
                dx="2"
                dy="4"
                stdDeviation="2"
                flood-color="#242a21"
                flood-opacity=".28"
              /></filter
            >
            <radialGradient id="sectorFill"
              ><stop stop-color="#df512b" stop-opacity=".10" /><stop
                offset="1"
                stop-color="#df512b"
                stop-opacity=".36"
              /></radialGradient
            >
          </defs>
          <circle cx="300" cy="300" r="299" fill="url(#face)" /><circle
            cx="300"
            cy="300"
            r="281"
            fill="none"
            stroke="#a6a394"
            stroke-opacity=".28"
          />
          {#if !isClock}<path
              id="time-sector"
              d={sectorPath(Math.min(1, visibleRemaining / (scale * 60000)))}
              fill="url(#sectorFill)"
            />{/if}
          {#each marks as i}
            {@const a = (i * Math.PI) / 30}{@const r = i % 5 === 0 ? 252 : 262}
            <line
              x1={300 + Math.sin(a) * r}
              y1={300 - Math.cos(a) * r}
              x2={300 + Math.sin(a) * 273}
              y2={300 - Math.cos(a) * 273}
              stroke={i % 5 === 0 ? '#384638' : '#78806b'}
              stroke-width={i % 5 === 0 ? 2.7 : 1.3}
            />
            {#if i % 5 === 0}<text
                x={300 + Math.sin(a) * 220}
                y={300 - Math.cos(a) * 220}
                class:zero={i === 0}
                class="tick-number"
                >{isClock
                  ? i === 0
                    ? 12
                    : i / 5
                  : Math.round((i / 60) * scale)}</text
              >{/if}
          {/each}
          <text x="300" y="199" class="face-brand">TEMPO</text><text
            x="300"
            y="218"
            class="face-subbrand">PRECISION IN THE PRESENT</text
          >
          <circle cx="300" cy="391" r="36" class="subdial-track" />
          {#each submarks as i}{@const a = (i * Math.PI) / 10}<line
              x1={300 + Math.sin(a) * 30}
              y1={391 - Math.cos(a) * 30}
              x2={300 + Math.sin(a) * 33}
              y2={391 - Math.cos(a) * 33}
              stroke="#8d977c"
              stroke-width={i % 5 === 0 ? 1.4 : 0.6}
            />{/each}
          <g
            id="subdial-hand"
            style:transform="rotate({(isClock
              ? seconds
              : Math.ceil(remainingMs / 1000) % 60) * 6}deg)"
            ><path d="M300 402V362" stroke="#b84d30" stroke-width="2" /><circle
              cx="300"
              cy="391"
              r="3"
              fill="#26312b"
            /></g
          >
          <text x="300" y="456" class="face-caption"
            >{isClock
              ? 'LOCAL TIME / MECHANICAL'
              : `COUNTDOWN / ${scale} MIN`}</text
          >
          {#if isClock}
            <g
              id="hour-hand"
              style:transform="rotate({((date.getHours() % 12) +
                date.getMinutes() / 60) *
                30}deg)"
              filter="url(#handShadow)"
              ><path
                d="M294 315L291 281L297 168L303 168L309 281L306 315Z"
                fill="url(#needleMetal)"
              /><path d="M300 177V270" stroke="#c5c6b9" stroke-width="2" /></g
            >
            <g
              id="minute-hand"
              style:transform="rotate({(date.getMinutes() + seconds / 60) *
                6}deg)"
              filter="url(#handShadow)"
              ><path
                d="M295 328L295 281L298 86L302 86L305 281L305 328Z"
                fill="url(#needleMetal)"
              /><path d="M300 103V258" stroke="#a4aea1" stroke-width="1.4" /></g
            >
          {/if}
          <g
            id="timer-hand"
            class:smooth={!step && !drag}
            style:transform="rotate({visibleAngle +
              (!step && isClock ? 6 : 0)}deg)"
            filter="url(#handShadow)"
            ><path
              d="M296 341L297 106L300 73L303 106L304 341Z"
              fill="#d7502a"
            /><path d="M299 101V277" stroke="#f89968" stroke-width="1" /><circle
              cx="300"
              cy="338"
              r="9"
              fill="#d7502a"
            /></g
          >
          <circle
            cx="300"
            cy="300"
            r="16"
            fill="url(#hubMetal)"
            filter="url(#handShadow)"
          /><circle cx="300" cy="300" r="5" fill="#d85730" /><circle
            cx="298.5"
            cy="298"
            r="1.5"
            fill="#ffba87"
          />
        </svg>
        <div class="glass-reflection"></div>
      </div>
    </div>
  </div>
</div>

<style>
  #timer-hand.smooth {
    transition: transform 1s linear;
    will-change: transform;
  }
  .dial-object.dragging #dial {
    cursor: grabbing;
  }
</style>
