<script lang="ts">
  /**
   * Main entry point for the PWA application.
   * Handles:
   * 1. Service Worker registration for offline support.
   * 2. PWA installation prompt capturing.
   * 3. Web Share Target data parsing.
   */
  import { onMount } from 'svelte';
  import { _, isLoading, waitLocale } from 'svelte-i18n';
  import { SharedComponent } from '@workspace/shared';
  import { useRegisterSW } from 'virtual:pwa-register/svelte';
  import '@workspace/shared';
  import './app.css';

  // State managed by Svelte 5 runes
  let sharedData = $state({ title: '', text: '', url: '' });
  let installPrompt = $state<any>(null);

  // Automatic Service Worker registration and update management
  useRegisterSW({
    onRegistered(r) {
      if (r) console.info('PWA Service Worker registered');
    }
  });

  onMount(async () => {
    // Ensure translations are loaded before rendering
    await waitLocale();

    // Listen for the browser's PWA install prompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      installPrompt = e;
    });

    // Cleanup prompt when app is installed
    window.addEventListener('appinstalled', () => {
      installPrompt = null;
    });

    // Extract data sent via the Web Share Target API (mobile share menu)
    const params = new URLSearchParams(window.location.search);
    if (params.has('title') || params.has('text') || params.has('url')) {
      sharedData = {
        title: params.get('title') || '',
        text: params.get('text') || '',
        url: params.get('url') || ''
      };
    }
  });

  /**
   * Triggers the native browser installation dialog.
   */
  async function handleInstall(): Promise<void> {
    if (installPrompt) {
      const result = await installPrompt.prompt();
      if (result.outcome === 'accepted') {
        installPrompt = null;
      }
    }
  }
</script>

<main class="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans">
  <div class="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
    {#if $isLoading}
      <div class="flex items-center justify-center space-x-2 animate-pulse" aria-hidden="true">
        <div class="w-2 h-2 bg-blue-600 rounded-full"></div>
        <div class="w-2 h-2 bg-blue-600 rounded-full"></div>
        <div class="w-2 h-2 bg-blue-600 rounded-full"></div>
      </div>
    {:else}
      <header>
        <h1 class="text-3xl font-extrabold text-gray-900 mb-2">{$_('welcome')}</h1>
        <p class="text-gray-500 mb-8">{$_('pwa_page')}</p>
      </header>

      {#if installPrompt}
        <section class="mb-8 p-5 border-2 border-blue-100 rounded-2xl bg-blue-50 transition-all">
          <p class="text-blue-700 font-medium mb-4">{$_('pwa_ready')}</p>
          <button 
            onclick={handleInstall}
            class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg active:scale-95 transition-all"
          >
            {$_('install_app')}
          </button>
        </section>
      {/if}

      {#if sharedData.text || sharedData.url}
        <SharedComponent title={$_('received_data')}>
          <article class="space-y-2 py-1">
            <p><span class="font-bold">{$_('share_data_title')}:</span> {sharedData.title}</p>
            <p><span class="font-bold">{$_('share_data_text')}:</span> {sharedData.text}</p>
            <p class="break-all"><span class="font-bold">{$_('share_data_url')}:</span> {sharedData.url}</p>
          </article>
        </SharedComponent>
      {/if}
    {/if}
  </div>
</main>
