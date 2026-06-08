{#if import.meta.env.DEV}
  <footer class="mt-8 pt-6 border-t border-gray-100">
    <div
      class="flex items-center justify-center gap-2 text-xs font-medium text-green-600 bg-green-50 py-2 px-4 rounded-full inline-flex"
    >
      <span class="relative flex h-2 w-2">
        <span
          class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"
        ></span>
        <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
      </span>
      <span>System Active • {new Date().toLocaleTimeString()}</span>
    </div>
  </footer>
{/if}
