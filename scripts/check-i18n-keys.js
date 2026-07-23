#!/usr/bin/env node
/**
 * Translation-key parity check for src/assets/i18n.
 *
 * For every {en,fr,ar}.json group found (the root group, plus each lazy
 * scope subfolder such as auth/ or dashboard/), verifies:
 *   - every English key exists in French and Arabic (and vice versa)
 *   - no value is an empty string
 *   - no value is accidentally equal to its own key (a common copy/paste
 *     mistake when a translator leaves the key as a placeholder value)
 *
 * Exits non-zero on any violation so it can be wired into CI later.
 */
const fs = require('fs');
const path = require('path');

const I18N_ROOT = path.join(__dirname, '..', 'src', 'assets', 'i18n');
const LANGS = ['en', 'fr', 'ar'];
const SAME_AS_ENGLISH_ALLOWED = new Set([
  'Ooredoo',
  'CRM',
  'TIMOS',
  'DPM',
  'RDV',
  'STT',
  'TECH',
  'ZM',
  'GPS',
  'SLA',
  'PDF',
  'MSISDN',
  'Page 404',
  'Page 500',
  'Rendez-vous (RDV)',
  'Discussion (ZM ↔ STT)',
  'Contact CL2'
]);

function flatten(obj, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, fullKey));
    } else {
      out[fullKey] = value;
    }
  }
  return out;
}

function findGroups(root) {
  const groups = [{ name: '(root)', dir: root }];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      groups.push({ name: entry.name, dir: path.join(root, entry.name) });
    }
  }
  return groups;
}

function normalizeForComparison(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeAllowedInvariant(value) {
  const normalized = normalizeForComparison(value);
  return SAME_AS_ENGLISH_ALLOWED.has(normalized)
    || /^[A-Z0-9 _/#()+-]+$/.test(normalized);
}

function looksLikeUntranslatedEnglish(enValue, localizedValue, lang) {
  const english = normalizeForComparison(enValue);
  const localized = normalizeForComparison(localizedValue);

  if (!english || english !== localized) {
    return false;
  }

  if (!/[A-Za-z]/.test(english)) {
    return false;
  }

  // French intentionally shares a lot of one-word labels and business nouns
  // with English (e.g. "Description", "Audit", "Activation"). Flagging those
  // creates too much noise, so keep the French heuristic conservative and only
  // warn on unchanged multi-word phrases / richer sentences.
  if (lang === 'fr' && !/[\s:.,!?()/-]/.test(english)) {
    return false;
  }

  return !looksLikeAllowedInvariant(english);
}

let hasErrors = false;

for (const group of findGroups(I18N_ROOT)) {
  const flatByLang = {};

  for (const lang of LANGS) {
    const file = path.join(group.dir, `${lang}.json`);
    if (!fs.existsSync(file)) {
      console.error(`[i18n] MISSING FILE: ${path.relative(I18N_ROOT, file)}`);
      hasErrors = true;
      continue;
    }

    let json;
    try {
      json = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      console.error(`[i18n] INVALID JSON: ${path.relative(I18N_ROOT, file)} — ${err.message}`);
      hasErrors = true;
      continue;
    }

    flatByLang[lang] = flatten(json);
  }

  if (!flatByLang.en) {
    continue;
  }

  const enKeys = new Set(Object.keys(flatByLang.en));

  for (const lang of ['fr', 'ar']) {
    if (!flatByLang[lang]) continue;
    const langKeys = new Set(Object.keys(flatByLang[lang]));

    for (const key of enKeys) {
      if (!langKeys.has(key)) {
        console.error(`[i18n] [${group.name}] missing in ${lang}.json: ${key}`);
        hasErrors = true;
      }
    }
    for (const key of langKeys) {
      if (!enKeys.has(key)) {
        console.error(`[i18n] [${group.name}] extra key in ${lang}.json not present in en.json: ${key}`);
        hasErrors = true;
      }
    }
  }

  for (const lang of LANGS) {
    if (!flatByLang[lang]) continue;
    for (const [key, value] of Object.entries(flatByLang[lang])) {
      if (typeof value !== 'string') continue;

      if (value.trim() === '') {
        console.error(`[i18n] [${group.name}] empty value in ${lang}.json: ${key}`);
        hasErrors = true;
      } else if (value === key) {
        console.error(`[i18n] [${group.name}] value equals its own key in ${lang}.json: ${key}`);
        hasErrors = true;
      }
    }
  }

  for (const lang of ['fr', 'ar']) {
    if (!flatByLang[lang]) continue;

    for (const key of enKeys) {
      const englishValue = flatByLang.en[key];
      const localizedValue = flatByLang[lang][key];

      if (typeof englishValue !== 'string' || typeof localizedValue !== 'string') {
        continue;
      }

      if (looksLikeUntranslatedEnglish(englishValue, localizedValue, lang)) {
        console.error(`[i18n] [${group.name}] possible untranslated English value in ${lang}.json: ${key} = ${JSON.stringify(localizedValue)}`);
        hasErrors = true;
      }
    }
  }
}

if (hasErrors) {
  console.error('\n[i18n] Translation-key check FAILED.');
  process.exit(1);
} else {
  console.log('[i18n] Translation-key check passed: en/fr/ar are in sync, with no empty, key-as-value, or suspicious untranslated English entries.');
}
