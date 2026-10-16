<script lang="ts">
  import FlipCard from './FlipCard.svelte';
  let { values, date }: { values: [string, string, string]; date: string } =
    $props();
</script>

<div class="flip-object">
  <div class="flip-topline">
    <span>TEMPO / SPLIT–FLAP</span><span class="flip-live"
      ><i></i> PRECISION SERIES</span
    >
  </div>
  <div class="flip-units">
    {#each ['HOURS', 'MINUTES', 'SECONDS'] as label, i}<FlipCard
        value={values[i]}
        {label}
      />{/each}
  </div>
  <div class="flip-bottomline">
    <span>{date}</span><span>TIME, MADE TANGIBLE.</span>
  </div>
</div>
