/**
 * Shared internationalization configuration and dictionary.
 * Uses svelte-i18n to provide reactive translations for PWA and Extension apps.
 */
import { init, register, getLocaleFromNavigator } from 'svelte-i18n';

// Register English translations
register('en', () => Promise.resolve({
  "welcome": "Welcome to the App",
  "pwa_page": "PWA Main Page",
  "extension_page": "Extension Popup",
  "received_data": "Received Shared Data",
  "captured_text": "Captured Text",
  "install_app": "Install App",
  "pwa_ready": "PWA is ready for installation!",
  "share_data_title": "Title",
  "share_data_text": "Text",
  "share_data_url": "URL",
  "context_menu_hint": "Right-click text on any page and select 'Send to Extension' to see it here."
}));

// Register Russian translations
register('ru', () => Promise.resolve({
  "welcome": "Добро пожаловать",
  "pwa_page": "Главная страница PWA",
  "extension_page": "Окно расширения",
  "received_data": "Полученные данные",
  "captured_text": "Захваченный текст",
  "install_app": "Установить приложение",
  "pwa_ready": "Приложение готово к установке!",
  "share_data_title": "Заголовок",
  "share_data_text": "Текст",
  "share_data_url": "URL",
  "context_menu_hint": "Выделите текст на странице и выберите 'Send to Extension', чтобы увидеть его здесь."
}));

/**
 * Initialize i18n with automatic locale detection.
 * Fallback to English if the user's language is not supported.
 */
init({
  fallbackLocale: 'en',
  initialLocale: getLocaleFromNavigator(),
});
