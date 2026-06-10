import de from '../../lib/translations/de.json';
import ru from '../../lib/translations/ru.json';

const translations: Record<string, any> = {
  ru,
  de,
};

let currentLang: 'ru' | 'de' = 'ru';

export function setLanguage(lang: 'ru' | 'de') {
  currentLang = lang;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.');
  let value: any = translations[currentLang];

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key; // если ключ не найден — возвращаем сам ключ
    }
  }

  if (typeof value === 'string' && params) {
    return Object.entries(params).reduce((str, [k, v]) => {
      return str.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
    }, value);
  }

  return typeof value === 'string' ? value : key;
}