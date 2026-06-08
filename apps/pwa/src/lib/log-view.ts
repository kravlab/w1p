import {
  filterDictionaryLogs,
  groupDictionaryLogsByDate,
  sectionDictionaryLogs,
  type DictionaryLogEntry,
  type DictionaryLogSource,
  type DictionaryLogType
} from '@workspace/shared';

export const logTypeOptions: Array<'all' | DictionaryLogType> = [
  'all',
  'success',
  'not_found',
  'network',
  'server',
  'unknown',
  'runtime_error',
  'unhandled_rejection',
  'storage_granted',
  'storage_denied',
  'storage_unsupported'
];

export const logSourceOptions: Array<'all' | DictionaryLogSource> = [
  'all',
  'network',
  'cache',
  'unknown'
];

export interface DictionaryLogSectionView {
  id: 'dictionary' | 'storage';
  title: string;
  groups: Array<{ date: string; entries: DictionaryLogEntry[] }>;
}

export function getFilteredLogEntries(
  logEntries: DictionaryLogEntry[],
  options: {
    type: 'all' | DictionaryLogType;
    source: 'all' | DictionaryLogSource;
    searchTerm: string;
  }
): DictionaryLogEntry[] {
  return filterDictionaryLogs(logEntries, options);
}

export function getLogSections(
  logEntries: DictionaryLogEntry[],
  options: {
    type: 'all' | DictionaryLogType;
    source: 'all' | DictionaryLogSource;
    searchTerm: string;
    dictionaryTitle: string;
    storageTitle: string;
  }
): DictionaryLogSectionView[] {
  return sectionDictionaryLogs(getFilteredLogEntries(logEntries, options)).map((section) => ({
    id: section.id,
    title: section.id === 'dictionary' ? options.dictionaryTitle : options.storageTitle,
    groups: groupDictionaryLogsByDate(section.entries)
  }));
}

/**
 * Log types map to fixed semantic colors so the history panel communicates
 * severity at a glance without relying on the raw enum labels alone.
 */
export function getLogTypeBadgeClass(type: DictionaryLogType): string {
  switch (type) {
    case 'success':
      return 'bg-emerald-100 text-emerald-800';
    case 'not_found':
      return 'bg-amber-100 text-amber-800';
    case 'network':
      return 'bg-orange-100 text-orange-800';
    case 'server':
      return 'bg-rose-100 text-rose-800';
    case 'unknown':
      return 'bg-slate-200 text-slate-700';
    case 'runtime_error':
      return 'bg-rose-100 text-rose-800';
    case 'unhandled_rejection':
      return 'bg-fuchsia-100 text-fuchsia-800';
    case 'storage_granted':
      return 'bg-emerald-100 text-emerald-800';
    case 'storage_denied':
      return 'bg-amber-100 text-amber-800';
    case 'storage_unsupported':
      return 'bg-slate-200 text-slate-700';
  }
}
