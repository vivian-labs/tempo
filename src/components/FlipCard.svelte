<script lang="ts">
  import { untrack } from 'svelte';
  let { value, label }: { value: string; label: string } = $props();
  let shown = $state(untrack(() => value)),
    old = $state(untrack(() => value)),
    lower = $state(untrack(() => value)),
    revision = $state(0),
    flipping = $state(false);
  $effect(() => {
    if (value !== shown) {
      old = shown;
      shown = value;
      revision++;
      flipping = true;
    } else if (!flipping) {
      lower = value;
    }
  });
</script>

<div class="flip-unit">
  {#key revision}
    <div class="flip-card" class:flipping aria-label={`${label}: ${value}`}>
      <div class="flap top base"><span>{shown}</span></div>
      <div class="flap bottom base"><span>{lower}</span></div>
      <div class="flap top overlay"><span>{old}</span></div>
      <div
        class="flap bottom overlay"
        onanimationend={() => {
          lower = shown;
          flipping = false;
        }}
      >
        <span>{shown}</span>
      </div>
    </div>
  {/key}
  <span class="unit-label">{label}</span>
</div>
