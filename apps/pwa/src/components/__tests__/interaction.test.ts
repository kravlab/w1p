import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { enMessages as t } from '@workspace/shared';
import AppDrawer from '../AppDrawer.svelte';
import FloatingActions from '../FloatingActions.svelte';
import SyncPanel from '../SyncPanel.svelte';

describe('PWA shell components', () => {
  it('wires drawer actions to the container callbacks', async () => {
    const onClose = vi.fn();
    const onSavedOpen = vi.fn();
    const onSyncOpen = vi.fn();
    const onAboutOpen = vi.fn();
    const onLogOpen = vi.fn();
    const onCacheOpen = vi.fn();
    const onInstall = vi.fn();

    render(AppDrawer, {
      installPromptAvailable: true,
      isDrawerOpen: true,
      onAboutOpen,
      onCacheOpen,
      onClose,
      onInstall,
      onLogOpen,
      onSavedOpen,
      onSyncOpen
    });

    await fireEvent.click(screen.getByRole('button', { name: t.menu_install }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_saved }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_sync }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_about }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_log }));
    await fireEvent.click(screen.getByRole('button', { name: t.menu_cache }));
    await fireEvent.click(screen.getByRole('button', { name: t.close_menu }));

    expect(onInstall).toHaveBeenCalled();
    expect(onSavedOpen).toHaveBeenCalled();
    expect(onSyncOpen).toHaveBeenCalled();
    expect(onAboutOpen).toHaveBeenCalled();
    expect(onLogOpen).toHaveBeenCalled();
    expect(onCacheOpen).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('wires floating actions to scroll and selection callbacks', async () => {
    const onCloseDrawer = vi.fn();
    const onScrollTop = vi.fn();
    const onSearchSelection = vi.fn();

    render(FloatingActions, {
      isDrawerOpen: true,
      isScrollTopButtonVisible: true,
      onCloseDrawer,
      onScrollTop,
      onSearchSelection,
      selectedPageText: 'selected',
      selectionActionPosition: { top: 100, left: 120 }
    });

    await fireEvent.click(screen.getByRole('button', { name: t.close_menu }));
    await fireEvent.click(screen.getByRole('button', { name: t.scroll_to_top }));
    await fireEvent.click(screen.getByRole('button', { name: t.selection_search_button }));

    expect(onCloseDrawer).toHaveBeenCalled();
    expect(onScrollTop).toHaveBeenCalled();
    expect(onSearchSelection).toHaveBeenCalled();
  });

  it('wires sync panel connect actions to sync callbacks', async () => {
    const onClose = vi.fn();
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();
    const onProviderChange = vi.fn();
    const onSync = vi.fn();

    render(SyncPanel, {
      googleDriveClientId: 'client-id',
      isProviderAvailable: true,
      onClose,
      onConnect,
      onDisconnect,
      onProviderChange,
      onSync,
      selectedSyncProvider: 'google-drive',
      syncProviders: [{ id: 'google-drive', label: 'Google Drive' }],
      syncState: { providerId: 'google-drive', status: 'disconnected' },
      syncStatusMessageKey: 'sync_status_disconnected'
    });

    await fireEvent.change(screen.getByLabelText(t.sync_provider_label), {
      target: { value: 'google-drive' }
    });
    await fireEvent.click(screen.getByRole('button', { name: t.sync_connect }));
    await fireEvent.click(screen.getByRole('button', { name: t.sync_now }));
    await fireEvent.click(screen.getAllByRole('button', { name: t.sync_close })[1]);

    expect(onProviderChange).toHaveBeenCalled();
    expect(onConnect).toHaveBeenCalled();
    expect(onDisconnect).not.toHaveBeenCalled();
    expect(onSync).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('turns the sync connection action into disconnect when connected', async () => {
    const onConnect = vi.fn();
    const onDisconnect = vi.fn();

    render(SyncPanel, {
      googleDriveClientId: 'client-id',
      isProviderAvailable: true,
      onClose: vi.fn(),
      onConnect,
      onDisconnect,
      onProviderChange: vi.fn(),
      onSync: vi.fn(),
      selectedSyncProvider: 'google-drive',
      syncProviders: [{ id: 'google-drive', label: 'Google Drive' }],
      syncState: { providerId: 'google-drive', status: 'connected' },
      syncStatusMessageKey: 'sync_status_connected'
    });

    expect(screen.queryByRole('button', { name: t.sync_connect })).not.toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: t.sync_disconnect }));

    expect(onConnect).not.toHaveBeenCalled();
    expect(onDisconnect).toHaveBeenCalled();
  });
});
