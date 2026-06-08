export function downloadJsonFile(filename: string, value: unknown): void {
  if (typeof document === 'undefined') {
    return;
  }

  const payload = JSON.stringify(value, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = blobUrl;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(blobUrl);
}
