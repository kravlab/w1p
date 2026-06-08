import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureSyncProviders,
  connectSyncProvider,
  disconnectSyncProvider,
  getSavedSensesSyncState,
  getSavedSenses,
  listSyncProviders,
  resetSavedSensesSyncForTests,
  saveSense,
  subscribeToSavedSensesSyncState,
  SYNC_STATE_STORAGE_KEY
} from '../index';

class FakeYMap<T> {
  values = new Map<string, T>();

  clear(): void {
    this.values.clear();
  }

  delete(key: string): void {
    this.values.delete(key);
  }

  entries(): IterableIterator<[string, T]> {
    return this.values.entries();
  }

  set(key: string, value: T): void {
    this.values.set(key, value);
  }
}

class FakeYDoc {
  maps = new Map<string, FakeYMap<unknown>>();

  getMap(name: string): FakeYMap<unknown> {
    if (!this.maps.has(name)) {
      this.maps.set(name, new FakeYMap());
    }

    return this.maps.get(name)!;
  }
}

function encodeFakeUpdate(doc: FakeYDoc): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(Array.from(doc.getMap('savedSenses').entries())));
}

function applyFakeUpdate(doc: FakeYDoc, update: Uint8Array): void {
  const map = doc.getMap('savedSenses');
  map.clear();
  for (const [key, value] of JSON.parse(new TextDecoder().decode(update))) {
    map.set(key, value);
  }
}

vi.mock('yjs', () => ({
  Doc: FakeYDoc,
  applyUpdate: applyFakeUpdate,
  encodeStateAsUpdate: encodeFakeUpdate
}));

describe('sync provider registry', () => {
  beforeEach(() => {
    resetSavedSensesSyncForTests();
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    disconnectSyncProvider('google-drive');
    configureSyncProviders({});
  });

  it('exposes future providers while only Google Drive is implemented', () => {
    expect(listSyncProviders()).toEqual([
      { id: 'google-drive', label: 'Google Drive', implemented: true },
      { id: 'dropbox', label: 'Dropbox', implemented: false },
      { id: 'microsoft', label: 'Microsoft OneDrive', implemented: false },
      { id: 'webdav', label: 'WebDAV', implemented: false },
      { id: 's3', label: 'S3', implemented: false }
    ]);
  });

  it('reports missing Google client configuration', () => {
    configureSyncProviders({});

    expect(getSavedSensesSyncState()).toMatchObject({
      providerId: 'google-drive',
      status: 'config-missing'
    });
  });

  it('notifies subscribers when a provider is disconnected', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToSavedSensesSyncState(listener);

    disconnectSyncProvider('google-drive');
    unsubscribe();

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'google-drive', status: 'disconnected' })
    );
  });

  it('keeps unimplemented providers unavailable', async () => {
    await connectSyncProvider('dropbox');

    expect(getSavedSensesSyncState()).toMatchObject({
      providerId: 'dropbox',
      status: 'error',
      lastError: 'This sync provider is not implemented yet.'
    });
  });

  it('rejects sync attempts for unimplemented providers', async () => {
    const { syncSavedSenses } = await import('../sync');
    await syncSavedSenses('s3');

    expect(getSavedSensesSyncState()).toMatchObject({
      providerId: 's3',
      status: 'error',
      lastError: 'This sync provider is not implemented yet.'
    });
  });

  it('reports missing Google configuration during sync', async () => {
    const { syncSavedSenses } = await import('../sync');
    await syncSavedSenses('google-drive');

    expect(getSavedSensesSyncState()).toMatchObject({
      providerId: 'google-drive',
      status: 'config-missing'
    });
  });

  it('reports missing Google configuration during connect', async () => {
    await connectSyncProvider('google-drive');

    expect(getSavedSensesSyncState()).toMatchObject({
      providerId: 'google-drive',
      status: 'config-missing',
      lastError: 'Google Drive sync is not configured.'
    });
  });

  it('disconnects non-Google providers without touching Google credentials', () => {
    disconnectSyncProvider('dropbox');

    expect(getSavedSensesSyncState()).toMatchObject({
      providerId: 'dropbox',
      status: 'disconnected'
    });
  });

  it('connects to Google Drive with a browser access token', async () => {
    const requestAccessToken = vi.fn(({ prompt }: { prompt?: string } = {}) => {
      expect(prompt).toBe('consent');
      tokenCallback({ access_token: 'token-1', expires_in: 3600 });
    });
    let tokenCallback: (response: { access_token: string; expires_in: number }) => void = () => {};
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn((options) => {
            tokenCallback = options.callback;
            return { requestAccessToken };
          })
        }
      }
    });

    configureSyncProviders({ googleDriveClientId: 'client-id' });
    await connectSyncProvider('google-drive');

    expect(getSavedSensesSyncState()).toMatchObject({ status: 'connected' });
    expect(JSON.parse(localStorage.getItem(SYNC_STATE_STORAGE_KEY)!)).toMatchObject({
      providerId: 'google-drive',
      status: 'connected'
    });
  });

  it('restores connected provider metadata after reload without storing a token', async () => {
    localStorage.setItem(
      SYNC_STATE_STORAGE_KEY,
      JSON.stringify({
        providerId: 'google-drive',
        status: 'connected',
        lastSyncedAt: '2026-05-11T12:00:00.000Z'
      })
    );

    configureSyncProviders({ googleDriveClientId: 'client-id' });

    expect(getSavedSensesSyncState()).toMatchObject({
      providerId: 'google-drive',
      status: 'connected',
      lastSyncedAt: '2026-05-11T12:00:00.000Z'
    });
    expect(localStorage.getItem(SYNC_STATE_STORAGE_KEY)).not.toContain('access');
    expect(localStorage.getItem(SYNC_STATE_STORAGE_KEY)).not.toContain('token');
  });

  it('ignores invalid persisted sync metadata', () => {
    localStorage.setItem(SYNC_STATE_STORAGE_KEY, JSON.stringify({ providerId: 'unknown' }));

    configureSyncProviders({ googleDriveClientId: 'client-id' });

    expect(getSavedSensesSyncState()).toMatchObject({
      providerId: 'google-drive',
      status: 'disconnected'
    });
  });

  it('falls back to disconnected when persisted sync metadata has no status', () => {
    localStorage.setItem(
      SYNC_STATE_STORAGE_KEY,
      JSON.stringify({ providerId: 'google-drive', accountLabel: 'User' })
    );

    configureSyncProviders({ googleDriveClientId: 'client-id' });

    expect(getSavedSensesSyncState()).toMatchObject({
      providerId: 'google-drive',
      status: 'disconnected',
      accountLabel: 'User'
    });
  });

  it('ignores corrupt persisted sync metadata', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(SYNC_STATE_STORAGE_KEY, '{');

    configureSyncProviders({ googleDriveClientId: 'client-id' });

    expect(getSavedSensesSyncState()).toMatchObject({
      providerId: 'google-drive',
      status: 'disconnected'
    });
    expect(warnSpy).toHaveBeenCalledWith('Failed to read sync state', expect.any(Error));
  });

  it('loads Google Identity Services before connecting when the script is not present', async () => {
    const requestAccessToken = vi.fn(() => {
      tokenCallback({ access_token: 'script-token', expires_in: 3600 });
    });
    let tokenCallback: (response: { access_token: string; expires_in: number }) => void = () => {};
    vi.stubGlobal('google', undefined);
    vi.spyOn(document.head, 'append').mockImplementation((node: Node) => {
      vi.stubGlobal('google', {
        accounts: {
          oauth2: {
            initTokenClient: vi.fn((options) => {
              tokenCallback = options.callback;
              return { requestAccessToken };
            })
          }
        }
      });
      (node as HTMLScriptElement).onload?.(new Event('load'));
      return node;
    });

    configureSyncProviders({ googleDriveClientId: 'client-id' });
    await connectSyncProvider('google-drive');

    expect(document.head.append).toHaveBeenCalled();
    expect(getSavedSensesSyncState()).toMatchObject({ status: 'connected' });
  });

  it('creates a Google Drive appDataFolder file on first sync', async () => {
    const requestAccessToken = vi.fn(() => {
      tokenCallback({ access_token: 'token-1', expires_in: 3600 });
    });
    let tokenCallback: (response: { access_token: string; expires_in: number }) => void = () => {};
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn((options) => {
            tokenCallback = options.callback;
            return { requestAccessToken };
          })
        }
      }
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'created-file' })
      });
    vi.stubGlobal('fetch', fetchMock);

    configureSyncProviders({ googleDriveClientId: 'client-id' });
    saveSense({
      word: 'test',
      partOfSpeech: 'noun',
      definition: 'def',
      pronunciations: [],
      tags: [],
      examples: [],
      quotes: [],
      synonyms: [],
      antonyms: []
    });
    await connectSyncProvider('google-drive');
    const { syncSavedSenses } = await import('../sync');
    await syncSavedSenses('google-drive');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/drive/v3/files?spaces=appDataFolder'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token-1' })
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/upload/drive/v3/files?uploadType=multipart'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(getSavedSensesSyncState()).toMatchObject({ status: 'connected' });
  });

  it('downloads an existing Google Drive sync file, merges it, and uploads the result', async () => {
    const requestAccessToken = vi.fn(() => {
      tokenCallback({ access_token: 'token-2', expires_in: 3600 });
    });
    let tokenCallback: (response: { access_token: string; expires_in: number }) => void = () => {};
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn((options) => {
            tokenCallback = options.callback;
            return { requestAccessToken };
          })
        }
      }
    });
    const remoteDoc = new FakeYDoc();
    remoteDoc.getMap('savedSenses').set('sense-remote', {
      id: 'sense-remote',
      word: 'remote',
      partOfSpeech: 'noun',
      pronunciations: [],
      definition: 'def',
      tags: [],
      examples: [],
      quotes: [],
      synonyms: [],
      antonyms: [],
      savedAt: '2026-05-11T12:00:00.000Z'
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [{ id: 'existing-file', name: 'sync.json' }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          schemaVersion: 1,
          provider: 'google-drive',
          scope: 'saved-senses',
          yjsUpdateBase64: btoa(
            Array.from(encodeFakeUpdate(remoteDoc), (byte) => String.fromCharCode(byte)).join('')
          ),
          updatedAt: '2026-05-11T12:00:00.000Z'
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });
    vi.stubGlobal('fetch', fetchMock);

    configureSyncProviders({ googleDriveClientId: 'client-id' });
    const { syncSavedSenses } = await import('../sync');
    await syncSavedSenses('google-drive');

    expect(getSavedSenses()).toEqual([expect.objectContaining({ id: 'sense-remote' })]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/upload/drive/v3/files/existing-file?uploadType=media'),
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('reports Google authorization failures without throwing', async () => {
    const requestAccessToken = vi.fn(() => {
      tokenCallback({ error: 'access_denied', expires_in: 0 });
    });
    let tokenCallback: (response: { error: string; expires_in: number }) => void = () => {};
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn((options) => {
            tokenCallback = options.callback;
            return { requestAccessToken };
          })
        }
      }
    });

    configureSyncProviders({ googleDriveClientId: 'client-id' });
    await connectSyncProvider('google-drive');

    expect(getSavedSensesSyncState()).toMatchObject({
      status: 'error',
      lastError: 'access_denied'
    });
  });

  it('marks Google authorization as expired after Drive rejects a token', async () => {
    const requestAccessToken = vi.fn(() => {
      tokenCallback({ access_token: 'expired-token', expires_in: 3600 });
    });
    let tokenCallback: (response: { access_token: string; expires_in: number }) => void = () => {};
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn((options) => {
            tokenCallback = options.callback;
            return { requestAccessToken };
          })
        }
      }
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({})
      })
    );

    configureSyncProviders({ googleDriveClientId: 'client-id' });
    const { syncSavedSenses } = await import('../sync');
    await syncSavedSenses('google-drive');

    expect(getSavedSensesSyncState()).toMatchObject({
      status: 'error',
      lastError: 'Google Drive request failed with 401.'
    });
  });

  it('reports Google Drive create failures', async () => {
    const requestAccessToken = vi.fn(() => {
      tokenCallback({ access_token: 'token-create-fail', expires_in: 3600 });
    });
    let tokenCallback: (response: { access_token: string; expires_in: number }) => void = () => {};
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn((options) => {
            tokenCallback = options.callback;
            return { requestAccessToken };
          })
        }
      }
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [] }) })
        .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    );

    configureSyncProviders({ googleDriveClientId: 'client-id' });
    const { syncSavedSenses } = await import('../sync');
    await syncSavedSenses('google-drive');

    expect(getSavedSensesSyncState()).toMatchObject({
      status: 'error',
      lastError: 'Google Drive file creation failed with 500.'
    });
  });

  it('reports Google Drive download failures', async () => {
    const requestAccessToken = vi.fn(() => {
      tokenCallback({ access_token: 'token-download-fail', expires_in: 3600 });
    });
    let tokenCallback: (response: { access_token: string; expires_in: number }) => void = () => {};
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn((options) => {
            tokenCallback = options.callback;
            return { requestAccessToken };
          })
        }
      }
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ files: [{ id: 'existing-file', name: 'sync.json' }] })
        })
        .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) })
    );

    configureSyncProviders({ googleDriveClientId: 'client-id' });
    const { syncSavedSenses } = await import('../sync');
    await syncSavedSenses('google-drive');

    expect(getSavedSensesSyncState()).toMatchObject({
      status: 'error',
      lastError: 'Google Drive download failed with 502.'
    });
  });

  it('reports Google Drive update failures', async () => {
    const requestAccessToken = vi.fn(() => {
      tokenCallback({ access_token: 'token-update-fail', expires_in: 3600 });
    });
    let tokenCallback: (response: { access_token: string; expires_in: number }) => void = () => {};
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn((options) => {
            tokenCallback = options.callback;
            return { requestAccessToken };
          })
        }
      }
    });
    const remoteDoc = new FakeYDoc();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ files: [{ id: 'existing-file', name: 'sync.json' }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            schemaVersion: 1,
            provider: 'google-drive',
            scope: 'saved-senses',
            yjsUpdateBase64: btoa(
              Array.from(encodeFakeUpdate(remoteDoc), (byte) => String.fromCharCode(byte)).join('')
            ),
            updatedAt: '2026-05-11T12:00:00.000Z'
          })
        })
        .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
    );

    configureSyncProviders({ googleDriveClientId: 'client-id' });
    const { syncSavedSenses } = await import('../sync');
    await syncSavedSenses('google-drive');

    expect(getSavedSensesSyncState()).toMatchObject({
      status: 'error',
      lastError: 'Google Drive file update failed with 503.'
    });
  });
});
