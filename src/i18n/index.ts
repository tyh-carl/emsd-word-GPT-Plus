import { createI18n } from 'vue-i18n'

import { localStorageKey } from '@/utils/enum'

import en from './locales/en.json'
import zhHk from './locales/zh-hk.json'

const messages = {
  en,
  'zh-hk': zhHk,
}

export const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem(localStorageKey.localLanguage) || 'en',
  fallbackLocale: 'zh-hk',
  messages,
})
