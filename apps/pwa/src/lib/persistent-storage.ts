import type { DictionaryLogInput } from '@workspace/shared';

export interface PersistentStorageResult {
  enabled: boolean;
  log?: DictionaryLogInput;
  supported: boolean;
}

const unsupportedLog: DictionaryLogInput = {
  word: 'persistent-storage',
  type: 'storage_unsupported',
  source: 'unknown',
  message: 'Persistent storage is not supported in this browser.'
};

export async function readPersistentStorageStatus(): Promise<PersistentStorageResult> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) {
    return { supported: false, enabled: false, log: unsupportedLog };
  }

  return { supported: true, enabled: await navigator.storage.persisted() };
}

export async function requestPersistentStoragePermission(): Promise<PersistentStorageResult> {
  if (!navigator.storage?.persist) {
    return { supported: false, enabled: false, log: unsupportedLog };
  }

  const enabled = await navigator.storage.persist();

  return {
    supported: true,
    enabled,
    log: {
      word: 'persistent-storage',
      type: enabled ? 'storage_granted' : 'storage_denied',
      source: 'unknown',
      message: enabled
        ? 'Persistent storage permission was granted.'
        : 'Persistent storage permission was denied.'
    }
  };
}
