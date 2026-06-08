export async function checkServiceWorkerUpdate(): Promise<string> {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.getRegistration) {
    return 'update_unavailable';
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return 'update_unavailable';
    }

    await registration.update();
    return registration.waiting ? 'update_available' : 'update_current';
  } catch (error) {
    console.warn('Manual PWA update check failed', error);
    return 'update_failed';
  }
}
