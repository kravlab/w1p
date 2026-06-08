<script lang="ts">
  import { _ } from 'svelte-i18n';

  interface Props {
    installPromptAvailable: boolean;
    isDrawerOpen: boolean;
    onAboutOpen: () => void;
    onCacheOpen: () => void;
    onClose: () => void;
    onInstall: () => void | Promise<void>;
    onLogOpen: () => void;
    onSavedOpen: () => void;
    onSyncOpen: () => void;
  }

  let {
    installPromptAvailable,
    isDrawerOpen,
    onAboutOpen,
    onCacheOpen,
    onClose,
    onInstall,
    onLogOpen,
    onSavedOpen,
    onSyncOpen
  }: Props = $props();
</script>

<aside
  class={`fixed inset-y-0 left-0 z-40 w-72 overflow-y-auto overscroll-contain border-r border-slate-200 bg-white/95 shadow-2xl backdrop-blur transition-transform duration-200 ${
    isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
  }`}
>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          {$_('menu_title')}
        </p>
        <h2 class="mt-1 text-lg font-black text-slate-900">{$_('pwa_page')}</h2>
      </div>
      <button
        type="button"
        class="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        aria-label={$_('close_menu')}
        onclick={onClose}
      >
        ✕
      </button>
    </div>

    <nav class="space-y-3 px-4 py-5">
      <a
        href="#dictionary"
        class="block rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        onclick={onClose}>{$_('menu_dictionary')}</a
      >

      {#if installPromptAvailable}
        <button
          type="button"
          class="block w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-left text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
          onclick={onInstall}
        >
          {$_('menu_install')}
        </button>
      {/if}

      <button
        type="button"
        class="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        onclick={onSavedOpen}
      >
        {$_('menu_saved')}
      </button>
      <button
        type="button"
        class="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        onclick={onSyncOpen}
      >
        {$_('menu_sync')}
      </button>
      <button
        type="button"
        class="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        onclick={onAboutOpen}
      >
        {$_('menu_about')}
      </button>
    </nav>

    <div class="mt-auto border-t border-slate-200 px-5 py-4">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
        {$_('menu_development')}
      </p>
      <div class="mt-3 grid gap-2">
        <button
          type="button"
          class="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          onclick={onLogOpen}
        >
          {$_('menu_log')}
        </button>
        <button
          type="button"
          class="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          onclick={onCacheOpen}
        >
          {$_('menu_cache')}
        </button>
      </div>
    </div>
  </div>
</aside>
