import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applySavedSensesYjsUpdate,
  clearSavedSenses,
  getSavedSenses,
  getSavedSensesYjsUpdate,
  initializeSavedSensesSync,
  isSavedSensesSyncInitialized,
  removeSavedSense,
  resetSavedSensesSyncForTests,
  saveSense,
  SAVED_SENSES_STORAGE_KEY,
  SAVED_SENSES_YJS_STORAGE_KEY
} from '../saved-senses';

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

describe('saved senses Yjs storage', () => {
  beforeEach(() => {
    resetSavedSensesSyncForTests();
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00.000Z'));
  });

  it('migrates existing localStorage entries into the Yjs-backed projection', async () => {
    localStorage.setItem(
      SAVED_SENSES_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'sense-existing',
          word: 'test',
          partOfSpeech: 'noun',
          pronunciations: [],
          definition: 'def',
          tags: [],
          examples: [],
          quotes: [],
          synonyms: [],
          antonyms: [],
          savedAt: '2026-05-09T12:00:00.000Z'
        }
      ])
    );

    expect(await initializeSavedSensesSync()).toBe(true);

    expect(isSavedSensesSyncInitialized()).toBe(true);
    expect(getSavedSenses()).toHaveLength(1);
    expect(localStorage.getItem(SAVED_SENSES_YJS_STORAGE_KEY)).toEqual(expect.any(String));
  });

  it('keeps save, remove, and clear operations in the Yjs projection', async () => {
    await initializeSavedSensesSync();

    const sense = saveSense({
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

    expect(getSavedSenses()).toHaveLength(1);
    removeSavedSense(sense.id);
    expect(getSavedSenses()).toEqual([]);

    saveSense({
      word: 'again',
      partOfSpeech: 'noun',
      definition: 'def',
      pronunciations: [],
      tags: [],
      examples: [],
      quotes: [],
      synonyms: [],
      antonyms: []
    });
    clearSavedSenses();

    expect(getSavedSenses()).toEqual([]);
    expect(localStorage.getItem(SAVED_SENSES_STORAGE_KEY)).toBe('[]');
  });

  it('restores a persisted Yjs state without re-importing stale localStorage rows', async () => {
    await initializeSavedSensesSync();
    saveSense({
      word: 'synced',
      partOfSpeech: 'noun',
      definition: 'def',
      pronunciations: [],
      tags: [],
      examples: [],
      quotes: [],
      synonyms: [],
      antonyms: []
    });
    const storedState = localStorage.getItem(SAVED_SENSES_YJS_STORAGE_KEY)!;

    resetSavedSensesSyncForTests();
    localStorage.setItem(
      SAVED_SENSES_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'sense-stale',
          word: 'stale',
          partOfSpeech: 'noun',
          pronunciations: [],
          definition: 'def',
          tags: [],
          examples: [],
          quotes: [],
          synonyms: [],
          antonyms: [],
          savedAt: '2026-05-09T12:00:00.000Z'
        }
      ])
    );
    localStorage.setItem(SAVED_SENSES_YJS_STORAGE_KEY, storedState);

    expect(await initializeSavedSensesSync()).toBe(true);

    expect(getSavedSenses()).toEqual([expect.objectContaining({ word: 'synced' })]);
  });

  it('falls back to legacy import when persisted Yjs state is corrupt', async () => {
    localStorage.setItem(SAVED_SENSES_YJS_STORAGE_KEY, 'not-valid-base64');
    localStorage.setItem(
      SAVED_SENSES_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'sense-legacy',
          word: 'legacy',
          partOfSpeech: 'noun',
          pronunciations: [],
          definition: 'def',
          tags: [],
          examples: [],
          quotes: [],
          synonyms: [],
          antonyms: [],
          savedAt: '2026-05-09T12:00:00.000Z'
        }
      ])
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await initializeSavedSensesSync()).toBe(true);

    expect(getSavedSenses()).toEqual([expect.objectContaining({ id: 'sense-legacy' })]);
  });

  it('persists and restores Yjs state through the Buffer base64 fallback', async () => {
    vi.stubGlobal('btoa', undefined);
    vi.stubGlobal('atob', undefined);
    vi.stubGlobal('Buffer', (globalThis as typeof globalThis & { Buffer: unknown }).Buffer);

    await initializeSavedSensesSync();
    saveSense({
      word: 'buffer',
      partOfSpeech: 'noun',
      definition: 'def',
      pronunciations: [],
      tags: [],
      examples: [],
      quotes: [],
      synonyms: [],
      antonyms: []
    });
    const storedState = localStorage.getItem(SAVED_SENSES_YJS_STORAGE_KEY);

    resetSavedSensesSyncForTests();
    expect(storedState).toEqual(expect.any(String));
    expect(await initializeSavedSensesSync()).toBe(true);

    expect(getSavedSenses()).toEqual([expect.objectContaining({ word: 'buffer' })]);
  });

  it('applies remote Yjs updates to the local saved-senses projection', async () => {
    await initializeSavedSensesSync();
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

    expect(await applySavedSensesYjsUpdate(encodeFakeUpdate(remoteDoc))).toBe(true);

    expect(getSavedSenses()).toEqual([expect.objectContaining({ id: 'sense-remote' })]);
    expect(getSavedSensesYjsUpdate()).toBeInstanceOf(Uint8Array);
  });

  it('returns no Yjs update before sync initialization', () => {
    expect(getSavedSensesYjsUpdate()).toBeNull();
  });
});
