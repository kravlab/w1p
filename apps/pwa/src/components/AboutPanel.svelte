<script lang="ts">
  import { _ } from 'svelte-i18n';

  interface Props {
    buildSha: string;
    buildTime: string;
    buildVersion: string;
    isCheckingForUpdates: boolean;
    isPersistentStorageEnabled: boolean;
    isPersistentStorageSupported: boolean;
    isRequestingPersistentStorage: boolean;
    onCheckForUpdates: () => void | Promise<void>;
    onClose: () => void;
    onRequestPersistentStorage: () => void | Promise<void>;
    pwaWebsiteUrl: string;
    updateCheckMessageKey: string;
  }

  let {
    buildSha,
    buildTime,
    buildVersion,
    isCheckingForUpdates,
    isPersistentStorageEnabled,
    isPersistentStorageSupported,
    isRequestingPersistentStorage,
    onCheckForUpdates,
    onClose,
    onRequestPersistentStorage,
    pwaWebsiteUrl,
    updateCheckMessageKey
  }: Props = $props();
</script>

<button
  type="button"
  class="fixed inset-0 z-40 bg-slate-950/45"
  aria-label={$_('about_close')}
  onclick={onClose}
></button>
<section
  class="fixed inset-y-0 right-0 z-50 flex w-full min-w-0 max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl"
>
  <header
    class="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
  >
    <div class="min-w-0">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
        {$_('menu_about')}
      </p>
      <h2 class="mt-1 text-xl font-black text-slate-900">{$_('about_title')}</h2>
    </div>
    <button
      type="button"
      class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
      onclick={onClose}
    >
      {$_('about_close')}
    </button>
  </header>

  <div class="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
    <div class="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-left">
      <span class="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
      <div>
        <p class="text-sm font-bold text-emerald-900">{$_('menu_ready')}</p>
        <p class="text-xs text-emerald-700">Dictionary and share target are available.</p>
      </div>
    </div>

    <div class="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
        {$_('about_website_title')}
      </p>
      <a
        href={pwaWebsiteUrl}
        target="_blank"
        rel="noreferrer"
        class="mt-2 inline-flex max-w-full break-all text-sm font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4"
      >
        {$_('about_website_link')}
      </a>
    </div>

    <div class="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
        {$_('storage_title')}
      </p>
      <p class="mt-2 text-sm text-slate-700">
        {#if !isPersistentStorageSupported}
          {$_('storage_unavailable')}
        {:else if isPersistentStorageEnabled}
          {$_('storage_persistent_enabled')}
        {:else}
          {$_('storage_persistent_disabled')}
        {/if}
      </p>
      {#if isPersistentStorageSupported && !isPersistentStorageEnabled}
        <button
          type="button"
          class="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isRequestingPersistentStorage}
          onclick={onRequestPersistentStorage}
        >
          {$_('storage_request_button')}
        </button>
      {/if}
    </div>

    <div class="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
        {$_('build_version_title')}
      </p>
      <p class="mt-2 font-mono text-sm font-semibold text-slate-900">{buildVersion}</p>
      <p class="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
        {$_('build_sha_title')}
      </p>
      <p class="mt-2 font-mono text-sm font-semibold text-slate-900">{buildSha}</p>
      <p class="mt-3 text-xs text-slate-500">{$_('build_time_label')}: {buildTime}</p>
      <button
        type="button"
        class="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isCheckingForUpdates}
        onclick={onCheckForUpdates}
      >
        {isCheckingForUpdates ? $_('update_checking') : $_('update_check_button')}
      </button>
      {#if updateCheckMessageKey}
        <p class="mt-3 text-xs font-medium text-slate-500">
          {$_(updateCheckMessageKey)}
        </p>
      {/if}
    </div>
  </div>
</section>
