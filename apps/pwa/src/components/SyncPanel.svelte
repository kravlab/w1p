<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { SyncProviderId, SyncState } from '@workspace/shared';

  interface Props {
    googleDriveClientId: string;
    isProviderAvailable: boolean;
    onClose: () => void;
    onConnect: () => void | Promise<void>;
    onDisconnect: () => void;
    onProviderChange: (event: Event) => void;
    onSync: () => void | Promise<void>;
    selectedSyncProvider: SyncProviderId;
    syncProviders: Array<{ id: SyncProviderId; label: string }>;
    syncState: SyncState;
    syncStatusMessageKey: string;
  }

  let {
    googleDriveClientId,
    isProviderAvailable,
    onClose,
    onConnect,
    onDisconnect,
    onProviderChange,
    onSync,
    selectedSyncProvider,
    syncProviders,
    syncState,
    syncStatusMessageKey
  }: Props = $props();

  let isConnected = $derived(syncState.status === 'connected' || syncState.status === 'syncing');
  let connectionActionLabelKey = $derived(isConnected ? 'sync_disconnect' : 'sync_connect');
  let handleConnectionAction = $derived(isConnected ? onDisconnect : onConnect);
</script>

<button
  type="button"
  class="fixed inset-0 z-40 bg-slate-950/45"
  aria-label={$_('sync_close')}
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
        {$_('menu_sync')}
      </p>
      <h2 class="mt-1 text-xl font-black text-slate-900">{$_('sync_title')}</h2>
    </div>
    <button
      type="button"
      class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
      onclick={onClose}
    >
      {$_('sync_close')}
    </button>
  </header>

  <div class="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
    <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left">
      <label
        for="sync-provider"
        class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400"
      >
        {$_('sync_provider_label')}
      </label>
      <select
        id="sync-provider"
        value={selectedSyncProvider}
        onchange={onProviderChange}
        class="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400"
      >
        {#each syncProviders as provider (provider.id)}
          <option value={provider.id}>{provider.label}</option>
        {/each}
      </select>

      <dl class="mt-4 grid gap-3 text-sm text-slate-700">
        <div>
          <dt class="font-semibold text-slate-900">{$_('sync_status_label')}</dt>
          <dd class="mt-1">{$_(syncStatusMessageKey)}</dd>
        </div>
        <div>
          <dt class="font-semibold text-slate-900">{$_('sync_last_synced')}</dt>
          <dd class="mt-1">
            {syncState.lastSyncedAt
              ? new Date(syncState.lastSyncedAt).toLocaleString()
              : $_('sync_never_synced')}
          </dd>
        </div>
      </dl>

      {#if selectedSyncProvider === 'google-drive' && !googleDriveClientId}
        <p class="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          {$_('sync_google_config_missing')}
        </p>
      {/if}

      {#if syncState.lastError}
        <p class="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
          {syncState.lastError}
        </p>
      {/if}

      <div class="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={(!isConnected && !isProviderAvailable) || syncState.status === 'syncing'}
          onclick={handleConnectionAction}
        >
          {$_(connectionActionLabelKey)}
        </button>
        <button
          type="button"
          class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!isProviderAvailable || syncState.status === 'syncing'}
          onclick={onSync}
        >
          {$_('sync_now')}
        </button>
      </div>
    </div>
  </div>
</section>
