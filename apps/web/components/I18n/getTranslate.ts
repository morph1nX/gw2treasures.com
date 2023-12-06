import 'server-only';
import type { Language } from '@gw2treasures/database';

import de from '../../translations/de.json';
import en from '../../translations/en.json';
import es from '../../translations/es.json';
import fr from '../../translations/fr.json';
import { headers } from 'next/headers';

export type TranslationId = keyof typeof en;

const dictionaryDe: Record<TranslationId, string> = { ...en, ...de };
const dictionaryEs: Record<TranslationId, string> = { ...en, ...es };
const dictionaryFr: Record<TranslationId, string> = { ...en, ...fr };

const getDictionary = (language: Language): Record<TranslationId, string> => {
  switch(language) {
    case 'de': return dictionaryDe;
    case 'en': return en;
    case 'es': return dictionaryEs;
    case 'fr': return dictionaryFr;
  }
};

export function getTranslate(language?: Language) {
  language ??= getLanguage();

  const messages = getDictionary(language);

  return (id: TranslationId) => {
    return messages[id] ?? '[Missing translation: ' + id + ']';
  };
}

export function translate(language: Language, id: TranslationId) {
  const messages = getDictionary(language);

  return messages[id] ?? '[Missing translation: ' + id + ']';
}

export function getLanguage() {
  const language = headers().get('x-gw2t-lang') as Language;

  return language;
}
