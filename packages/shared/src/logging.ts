import { DictionaryLookupError } from './dictionary';

export const LOGGING_ENABLED = true;
export const LOG_STORAGE_KEY = 'dictionary-log-history';
const MAX_LOG_ENTRIES = 200;

export type DictionaryLogType =
  | 'success'
  | 'not_found'
  | 'network'
  | 'server'
  | 'unknown'
  | 'runtime_error'
  | 'unhandled_rejection'
  | 'storage_granted'
  | 'storage_denied'
  | 'storage_unsupported';
export type DictionaryLogSource = 'network' | 'cache' | 'unknown';

export interface DictionaryLogRawError {
  name?: string;
  message?: string;
  stack?: string;
  cause?: string;
  httpStatus?: number;
  url?: string;
}

export interface DictionaryLogEntry {
  id: string;
  timestamp: string;
  word: string;
  type: DictionaryLogType;
  source: DictionaryLogSource;
  message: string;
  rawError?: DictionaryLogRawError;
}

export interface DictionaryLogInput {
  word: string;
  type: DictionaryLogType;
  message: string;
  source?: DictionaryLogSource;
  rawError?: unknown;
  url?: string;
}

export interface DictionaryLogGroup {
  date: string;
  entries: DictionaryLogEntry[];
}

export interface DictionaryLogSection {
  id: 'dictionary' | 'storage';
  entries: DictionaryLogEntry[];
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function readStoredLogs(): DictionaryLogEntry[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const rawValue = localStorage.getItem(LOG_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Failed to read dictionary log history', error);
    return [];
  }
}

function writeStoredLogs(entries: DictionaryLogEntry[]): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn('Failed to persist dictionary log history', error);
  }
}

function serializeUnknownError(error: unknown, url?: string): DictionaryLogRawError | undefined {
  if (!error && !url) {
    return undefined;
  }

  if (error instanceof DictionaryLookupError) {
    const cause = error.cause instanceof Error ? error.cause.message : String(error.cause ?? '');
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: cause || undefined,
      url
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      url
    };
  }

  return {
    message: typeof error === 'string' ? error : JSON.stringify(error),
    url
  };
}

/**
 * Storage permission events are operational metadata rather than user lookup
 * history, so the UI can present them in a separate section.
 */
export function isStorageLogType(type: DictionaryLogType): boolean {
  return type === 'storage_granted' || type === 'storage_denied' || type === 'storage_unsupported';
}

/**
 * Search term and type filtering are kept in shared logic so every log surface
 * applies the same matching rules to persisted entries.
 */
export function filterDictionaryLogs(
  entries: DictionaryLogEntry[],
  options: {
    type?: 'all' | DictionaryLogType;
    source?: 'all' | DictionaryLogSource;
    searchTerm?: string;
  } = {}
): DictionaryLogEntry[] {
  const normalizedSearch = options.searchTerm?.trim().toLowerCase() ?? '';
  const typeFilter = options.type ?? 'all';
  const sourceFilter = options.source ?? 'all';

  return entries.filter((entry) => {
    const matchesType = typeFilter === 'all' || entry.type === typeFilter;
    const matchesSource = sourceFilter === 'all' || entry.source === sourceFilter;
    const matchesSearch =
      !normalizedSearch ||
      entry.word.toLowerCase().includes(normalizedSearch) ||
      entry.message.toLowerCase().includes(normalizedSearch);

    return matchesType && matchesSource && matchesSearch;
  });
}

/**
 * Groups already-filtered log entries by locale date label for the timeline
 * UI. The function preserves the incoming entry order inside each date bucket.
 */
export function groupDictionaryLogsByDate(entries: DictionaryLogEntry[]): DictionaryLogGroup[] {
  const groups = new Map<string, DictionaryLogEntry[]>();

  for (const entry of entries) {
    const date = new Date(entry.timestamp).toLocaleDateString();
    const existingEntries = groups.get(date) ?? [];
    existingEntries.push(entry);
    groups.set(date, existingEntries);
  }

  return Array.from(groups.entries()).map(([date, groupedEntries]) => ({
    date,
    entries: groupedEntries
  }));
}

/**
 * Splits filtered log history into user-facing dictionary events and storage
 * lifecycle events so the UI can render distinct sections without duplicating
 * event classification logic.
 */
export function sectionDictionaryLogs(entries: DictionaryLogEntry[]): DictionaryLogSection[] {
  const dictionaryEntries = entries.filter((entry) => !isStorageLogType(entry.type));
  const storageEntries = entries.filter((entry) => isStorageLogType(entry.type));
  const sections: DictionaryLogSection[] = [];

  if (dictionaryEntries.length) {
    sections.push({
      id: 'dictionary',
      entries: dictionaryEntries
    });
  }

  if (storageEntries.length) {
    sections.push({
      id: 'storage',
      entries: storageEntries
    });
  }

  return sections;
}

export function appendDictionaryLog(input: DictionaryLogInput): void {
  if (!LOGGING_ENABLED) {
    return;
  }

  const entry: DictionaryLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    word: input.word,
    type: input.type,
    source: input.source ?? 'unknown',
    message: input.message,
    rawError: serializeUnknownError(input.rawError, input.url)
  };

  const previousEntries = readStoredLogs();
  const nextEntries = [entry, ...previousEntries].slice(0, MAX_LOG_ENTRIES);
  writeStoredLogs(nextEntries);
}

export function getDictionaryLogs(): DictionaryLogEntry[] {
  return readStoredLogs();
}

export function clearDictionaryLogs(): void {
  if (!canUseStorage()) {
    return;
  }

  localStorage.removeItem(LOG_STORAGE_KEY);
}
