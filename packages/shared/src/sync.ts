import {
  applySavedSensesYjsUpdate,
  getSavedSensesYjsUpdate,
  initializeSavedSensesSync
} from './saved-senses';

const GOOGLE_DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const GOOGLE_DRIVE_SYNC_FILE_NAME = 'w1p-saved-senses-yjs-v1.json';
const GOOGLE_IDENTITY_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
export const SYNC_STATE_STORAGE_KEY = 'dictionary-sync-state-v1';

export type SyncProviderId = 'google-drive' | 'dropbox' | 'microsoft' | 'webdav' | 's3';

export type SyncProviderStatus =
  | 'config-missing'
  | 'disconnected'
  | 'connected'
  | 'syncing'
  | 'error';

export interface SyncProviderDefinition {
  id: SyncProviderId;
  label: string;
  implemented: boolean;
}

export interface SyncState {
  providerId: SyncProviderId;
  status: SyncProviderStatus;
  lastSyncedAt?: string;
  lastError?: string;
  accountLabel?: string;
}

export interface SyncConfiguration {
  googleDriveClientId?: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
}

interface GoogleTokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

interface GoogleDriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
}

interface RemoteSyncEnvelope {
  schemaVersion: 1;
  provider: 'google-drive';
  scope: 'saved-senses';
  yjsUpdateBase64: string;
  updatedAt: string;
}

interface StoredSyncState {
  providerId: SyncProviderId;
  status: Extract<SyncProviderStatus, 'connected' | 'disconnected'>;
  lastSyncedAt?: string;
  accountLabel?: string;
}

const providerDefinitions: SyncProviderDefinition[] = [
  { id: 'google-drive', label: 'Google Drive', implemented: true },
  { id: 'dropbox', label: 'Dropbox', implemented: false },
  { id: 'microsoft', label: 'Microsoft OneDrive', implemented: false },
  { id: 'webdav', label: 'WebDAV', implemented: false },
  { id: 's3', label: 'S3', implemented: false }
];

let syncConfiguration: SyncConfiguration = {};
let googleAccessToken = '';
let googleTokenExpiresAt = 0;
let googleTokenClient: GoogleTokenClient | null = null;
let identityScriptPromise: Promise<void> | null = null;

let syncState: SyncState = {
  providerId: 'google-drive',
  status: 'disconnected'
};

const syncStateListeners = new Set<(state: SyncState) => void>();

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function readStoredSyncState(): StoredSyncState | null {
  /* v8 ignore next 3 -- sync state persistence is browser-only. */
  if (!canUseStorage()) {
    return null;
  }

  try {
    const rawValue = localStorage.getItem(SYNC_STATE_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<StoredSyncState>;
    if (
      !parsed.providerId ||
      !providerDefinitions.some((provider) => provider.id === parsed.providerId)
    ) {
      return null;
    }

    return {
      providerId: parsed.providerId,
      status: parsed.status === 'connected' ? 'connected' : 'disconnected',
      lastSyncedAt: parsed.lastSyncedAt,
      accountLabel: parsed.accountLabel
    };
  } catch (error) {
    console.warn('Failed to read sync state', error);
    return null;
  }
}

/**
 * Persists only provider metadata. Google access tokens stay memory-only and
 * are reissued by Google Identity Services after reload when sync is requested.
 */
function writeStoredSyncState(state: SyncState): void {
  /* v8 ignore next 3 -- sync state persistence is browser-only. */
  if (!canUseStorage()) {
    return;
  }

  try {
    if (state.status !== 'connected' && state.status !== 'disconnected') {
      return;
    }

    const storedState: StoredSyncState = {
      providerId: state.providerId,
      status: state.status,
      lastSyncedAt: state.lastSyncedAt,
      accountLabel: state.accountLabel
    };
    localStorage.setItem(SYNC_STATE_STORAGE_KEY, JSON.stringify(storedState));
  } catch (error) {
    /* v8 ignore next -- localStorage write failures are environment-specific. */
    console.warn('Failed to persist sync state', error);
  }
}

export function configureSyncProviders(configuration: SyncConfiguration): void {
  syncConfiguration = configuration;
  const storedState = readStoredSyncState();
  if (storedState) {
    syncState = { ...syncState, ...storedState, lastError: undefined };
  }

  if (!syncConfiguration.googleDriveClientId && syncState.providerId === 'google-drive') {
    setSyncState({ status: 'config-missing' });
  } else if (syncState.status === 'config-missing') {
    setSyncState({ status: storedState?.status ?? 'disconnected', lastError: undefined });
  }
}

export function listSyncProviders(): SyncProviderDefinition[] {
  return providerDefinitions.map((provider) => ({ ...provider }));
}

export function getSavedSensesSyncState(): SyncState {
  return { ...syncState };
}

export function subscribeToSavedSensesSyncState(listener: (state: SyncState) => void): () => void {
  syncStateListeners.add(listener);
  listener(getSavedSensesSyncState());

  return () => syncStateListeners.delete(listener);
}

function setSyncState(nextState: Partial<SyncState>): void {
  syncState = { ...syncState, ...nextState };
  writeStoredSyncState(syncState);
  syncStateListeners.forEach((listener) => listener(getSavedSensesSyncState()));
}

function encodeBytes(value: Uint8Array): string {
  const binary = Array.from(value, (byte) => String.fromCharCode(byte)).join('');

  if (typeof btoa === 'function') {
    return btoa(binary);
  }

  /* v8 ignore next 5 -- Node-only fallback for runtimes without btoa. */
  return (
    globalThis as typeof globalThis & {
      Buffer: {
        from: (value: string, encoding: string) => { toString: (encoding: string) => string };
      };
    }
  ).Buffer.from(binary, 'binary').toString('base64');
}

function decodeBytes(value: string): Uint8Array {
  /* v8 ignore next 10 -- Node-only fallback for runtimes without atob. */
  const binary =
    typeof atob === 'function'
      ? atob(value)
      : (
          globalThis as typeof globalThis & {
            Buffer: {
              from: (value: string, encoding: string) => { toString: (encoding: string) => string };
            };
          }
        ).Buffer.from(value, 'base64').toString('binary');

  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function ensureGoogleConfigured(): string {
  const clientId = syncConfiguration.googleDriveClientId?.trim();
  if (!clientId) {
    throw new Error('Google Drive sync is not configured.');
  }

  return clientId;
}

function getGoogleIdentity(): {
  accounts?: {
    oauth2?: {
      initTokenClient: (options: {
        client_id: string;
        scope: string;
        callback: (response: GoogleTokenResponse) => void;
      }) => GoogleTokenClient;
    };
  };
} {
  return (globalThis as typeof globalThis & { google?: unknown }).google as ReturnType<
    typeof getGoogleIdentity
  >;
}

async function loadGoogleIdentityScript(): Promise<void> {
  if (getGoogleIdentity()?.accounts?.oauth2) {
    return;
  }

  /* v8 ignore next 3 -- this provider is browser-only; tests cover the browser path. */
  if (typeof document === 'undefined') {
    throw new Error('Google authorization requires a browser.');
  }

  identityScriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GOOGLE_IDENTITY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services.'));
    document.head.append(script);
  });

  await identityScriptPromise;
}

async function requestGoogleAccessToken(prompt = ''): Promise<string> {
  const clientId = ensureGoogleConfigured();

  if (googleAccessToken && googleTokenExpiresAt > Date.now() + 60_000) {
    return googleAccessToken;
  }

  await loadGoogleIdentityScript();
  const oauth2 = getGoogleIdentity()?.accounts?.oauth2;
  /* v8 ignore next 3 -- GIS script load failures are reported through script.onerror. */
  if (!oauth2) {
    throw new Error('Google Identity Services are unavailable.');
  }

  const response = await new Promise<GoogleTokenResponse>((resolve) => {
    googleTokenClient ??= oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_DRIVE_APPDATA_SCOPE,
      callback: resolve
    });

    googleTokenClient.requestAccessToken({ prompt });
  });

  if (!response.access_token) {
    throw new Error(response.error_description || response.error || 'Google authorization failed.');
  }

  googleAccessToken = response.access_token;
  googleTokenExpiresAt = Date.now() + (response.expires_in ?? 3600) * 1000;
  setSyncState({ status: 'connected', lastError: undefined });

  return googleAccessToken;
}

async function googleDriveFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await requestGoogleAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init.headers
    }
  });

  if (response.status === 401 || response.status === 403) {
    googleAccessToken = '';
    setSyncState({ status: 'disconnected', lastError: 'Google authorization expired.' });
  }

  if (!response.ok) {
    throw new Error(`Google Drive request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

async function findGoogleDriveSyncFile(): Promise<GoogleDriveFile | null> {
  const query = encodeURIComponent(
    `name = '${GOOGLE_DRIVE_SYNC_FILE_NAME}' and 'appDataFolder' in parents and trashed = false`
  );
  const fields = encodeURIComponent('files(id,name,modifiedTime)');
  const result = await googleDriveFetch<{ files?: GoogleDriveFile[] }>(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=1&q=${query}&fields=${fields}`
  );

  return result.files?.[0] ?? null;
}

async function downloadGoogleDriveEnvelope(fileId: string): Promise<RemoteSyncEnvelope> {
  const token = await requestGoogleAccessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Google Drive download failed with ${response.status}.`);
  }

  return (await response.json()) as RemoteSyncEnvelope;
}

async function createGoogleDriveEnvelope(envelope: RemoteSyncEnvelope): Promise<void> {
  const token = await requestGoogleAccessToken();
  const formData = new FormData();
  formData.append(
    'metadata',
    new Blob(
      [
        JSON.stringify({
          name: GOOGLE_DRIVE_SYNC_FILE_NAME,
          parents: ['appDataFolder']
        })
      ],
      { type: 'application/json' }
    )
  );
  formData.append('file', new Blob([JSON.stringify(envelope)], { type: 'application/json' }));

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    }
  );

  if (!response.ok) {
    throw new Error(`Google Drive file creation failed with ${response.status}.`);
  }
}

async function updateGoogleDriveEnvelope(
  fileId: string,
  envelope: RemoteSyncEnvelope
): Promise<void> {
  const token = await requestGoogleAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(envelope)
    }
  );

  if (!response.ok) {
    throw new Error(`Google Drive file update failed with ${response.status}.`);
  }
}

export async function connectSyncProvider(providerId: SyncProviderId): Promise<void> {
  syncState = { ...syncState, providerId };
  if (providerId !== 'google-drive') {
    setSyncState({ status: 'error', lastError: 'This sync provider is not implemented yet.' });
    return;
  }

  try {
    await requestGoogleAccessToken('consent');
  } catch (error) {
    setSyncState({
      status: syncConfiguration.googleDriveClientId ? 'error' : 'config-missing',
      lastError: error instanceof Error ? error.message : 'Google authorization failed.'
    });
  }
}

export function disconnectSyncProvider(providerId: SyncProviderId): void {
  if (providerId === 'google-drive') {
    googleAccessToken = '';
    googleTokenExpiresAt = 0;
    googleTokenClient = null;
  }

  setSyncState({ providerId, status: 'disconnected', lastError: undefined });
}

/**
 * Merges local and remote saved-sense CRDT updates through Yjs. Provider code
 * treats cloud storage as an opaque object store, so future providers only need
 * to implement object read/write and auth without knowing saved-sense details.
 */
export async function syncSavedSenses(providerId: SyncProviderId): Promise<void> {
  syncState = { ...syncState, providerId };
  if (providerId !== 'google-drive') {
    setSyncState({ status: 'error', lastError: 'This sync provider is not implemented yet.' });
    return;
  }

  setSyncState({ status: 'syncing', lastError: undefined });

  try {
    /* v8 ignore next 3 -- missing yjs package is an install-time failure path. */
    if (!(await initializeSavedSensesSync())) {
      throw new Error('Yjs is not available. Install dependencies before syncing.');
    }

    const file = await findGoogleDriveSyncFile();
    if (file) {
      const remoteEnvelope = await downloadGoogleDriveEnvelope(file.id);
      await applySavedSensesYjsUpdate(decodeBytes(remoteEnvelope.yjsUpdateBase64));
    }

    const localUpdate = getSavedSensesYjsUpdate();
    /* v8 ignore next 3 -- initializeSavedSensesSync guarantees a local update exists. */
    if (!localUpdate) {
      throw new Error('Saved-senses sync state is unavailable.');
    }

    const envelope: RemoteSyncEnvelope = {
      schemaVersion: 1,
      provider: 'google-drive',
      scope: 'saved-senses',
      yjsUpdateBase64: encodeBytes(localUpdate),
      updatedAt: new Date().toISOString()
    };

    if (file) {
      await updateGoogleDriveEnvelope(file.id, envelope);
    } else {
      await createGoogleDriveEnvelope(envelope);
    }

    setSyncState({
      status: 'connected',
      lastSyncedAt: envelope.updatedAt,
      lastError: undefined
    });
  } catch (error) {
    setSyncState({
      status: syncConfiguration.googleDriveClientId ? 'error' : 'config-missing',
      lastError: error instanceof Error ? error.message : 'Saved-senses sync failed.'
    });
  }
}
