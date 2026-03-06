import { createI18n } from 'vue-i18n';
import enUS from './locales/en-US';
import zhCN from './locales/zh-CN';
import { syncNotificationLang } from '../api/config';

const STORAGE_KEY = 'opsmonitor-lang';

function getDefaultLocale(): string {
  // 1. Check localStorage
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && ['en-US', 'zh-CN'].includes(saved)) return saved;
  // 2. Check browser language
  const browserLang = navigator.language;
  if (browserLang.startsWith('zh')) return 'zh-CN';
  return 'en-US';
}

const i18n = createI18n({
  legacy: false,
  locale: getDefaultLocale(),
  fallbackLocale: 'en-US',
  messages: {
    'en-US': enUS,
    'zh-CN': zhCN,
  },
});

export function setLocale(locale: 'en-US' | 'zh-CN') {
  (i18n.global.locale as any).value = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  document.querySelector('html')?.setAttribute('lang', locale === 'zh-CN' ? 'zh' : 'en');
  // Sync to backend so scheduled notifications use the same language
  syncNotificationLang(locale).catch(() => {/* ignore – best effort */});
}

export function getLocale(): string {
  return (i18n.global.locale as any).value;
}

// Bug fix: Sync current locale to backend on app start.
// Without this, if user was already on zh-CN before the sync feature was deployed,
// system_configs has no notification_lang row and getNotificationLang() defaults to en-US.
syncNotificationLang(getDefaultLocale()).catch(() => {/* ignore – best effort */});

export default i18n;
