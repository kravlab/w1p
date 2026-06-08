<script lang="ts">
  import { isLoading } from 'svelte-i18n';
</script>

{#if $isLoading}
  <div class="flex min-h-dvh w-full items-center justify-center p-4">
    <div class="flex items-center justify-center space-x-2 animate-pulse" aria-hidden="true">
      <div class="w-2 h-2 bg-blue-600 rounded-full"></div>
      <div class="w-2 h-2 bg-blue-600 rounded-full"></div>
      <div class="w-2 h-2 bg-blue-600 rounded-full"></div>
    </div>
  </div>
{/if}
