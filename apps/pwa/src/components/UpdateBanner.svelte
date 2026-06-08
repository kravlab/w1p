<script lang="ts">
  import { _ } from 'svelte-i18n';

  interface Props {
    onDismiss: () => void;
    onUpdate: () => void;
  }

  let { onDismiss, onUpdate }: Props = $props();
</script>

<section
  class="relative mb-8 rounded-2xl border-2 border-amber-100 bg-amber-50 p-5 pr-14 transition-all"
>
  <button
    type="button"
    class="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-lg font-black leading-none text-amber-900 transition hover:bg-amber-100"
    aria-label={$_('pwa_update_close')}
    onclick={onDismiss}
  >
    ×
  </button>
  <p class="mb-2 font-bold text-amber-900">{$_('pwa_update_ready')}</p>
  <p class="mb-4 text-sm text-amber-800">{$_('pwa_update_description')}</p>
  <div class="grid gap-2 sm:grid-cols-[1fr_auto]">
    <button
      type="button"
      onclick={onUpdate}
      class="rounded-xl bg-amber-600 px-4 py-3 font-bold text-white shadow-lg transition-all hover:bg-amber-700 active:scale-95"
    >
      {$_('pwa_update_button')}
    </button>
    <button
      type="button"
      onclick={onDismiss}
      class="rounded-xl border border-amber-200 bg-white px-4 py-3 font-bold text-amber-900 transition hover:bg-amber-100"
    >
      {$_('pwa_update_later')}
    </button>
  </div>
</section>
