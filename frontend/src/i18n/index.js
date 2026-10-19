import en from './en.js';

// t('errors.generic') returns the text. If the key is missing, it returns the key.
export function t(key) {
  const value = key.split('.').reduce((obj, part) => (obj ? obj[part] : undefined), en);
  return typeof value === 'string' ? value : key;
}
