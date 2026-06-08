<script lang="ts">
  interface Props {
    active: boolean;
  }

  let { active }: Props = $props();
</script>

{#if active}
  <div class="flex items-center justify-center space-x-2 my-8 animate-pulse" aria-hidden="true">
    <div class="w-2 h-2 bg-blue-600 rounded-full"></div>
    <div class="w-2 h-2 bg-blue-600 rounded-full"></div>
    <div class="w-2 h-2 bg-blue-600 rounded-full"></div>
  </div>
{/if}
