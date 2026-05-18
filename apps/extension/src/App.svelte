<script lang="ts">
  import { onMount } from 'svelte';
  import { _, isLoading, waitLocale } from 'svelte-i18n';
  import { SharedComponent } from '@workspace/shared';
  import '@workspace/shared';
  import './app.css';

  let capturedText = $state('');

  /**
   * The popup reads the latest selection saved by the background script.
   * Storage is the handoff point because the popup can be opened long after
   * the originating context-menu action completed.
   */
  onMount(async () => {
    await waitLocale();

    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['sharedText'], (result: { [key: string]: any }) => {
        capturedText = result.sharedText || '';
      });
    }
  });
</script>

<main class="w-[320px] min-h-[260px] bg-gray-50 flex items-center justify-center p-5 font-sans">
  <div class="text-center w-full">
    {#if $isLoading}
      <div
        class="flex items-center justify-center space-x-2 animate-pulse"
        role="status"
        aria-label="Loading"
      >
        <div class="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
        <div class="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
        <div class="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
      </div>
    {:else}
      <header>
        <h1 class="text-2xl font-bold text-gray-800 mb-1">{$_('welcome')}</h1>
        <p class="text-xs text-gray-400 mb-6 uppercase tracking-wider">{$_('extension_page')}</p>
      </header>

      {#if capturedText}
        <SharedComponent title={$_('captured_text')}>
          <p class="italic text-gray-700 leading-relaxed">"{capturedText}"</p>
        </SharedComponent>
      {:else}
        <section class="p-4 border border-dashed border-gray-300 rounded-xl bg-white">
          <p class="text-xs text-gray-400 italic leading-relaxed">
            {$_('context_menu_hint')}
          </p>
        </section>
      {/if}
    {/if}
  </div>
</main>
