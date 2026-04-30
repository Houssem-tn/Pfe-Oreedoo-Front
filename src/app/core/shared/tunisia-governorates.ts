const CANONICAL_GOVERNORATES = [
  'Tunis',
  'Ariana',
  'Ben Arous',
  'Manouba',
  'Nabeul',
  'Zaghouan',
  'Bizerte',
  'Beja',
  'Jendouba',
  'Kef',
  'Siliana',
  'Sousse',
  'Monastir',
  'Mahdia',
  'Sfax',
  'Kairouan',
  'Kasserine',
  'Sidi Bouzid',
  'Gabes',
  'Medenine',
  'Tataouine',
  'Gafsa',
  'Tozeur',
  'Kebili'
] as const;

export const TUNISIA_GOVERNORATES = [...CANONICAL_GOVERNORATES];

const GOVERNORATE_ALIASES = buildGovernorateAliases();
const SORTED_GOVERNORATE_ALIASES = [...GOVERNORATE_ALIASES.entries()].sort(
  (left, right) => right[0].length - left[0].length
);

export function normalizeGovernorate(value?: string | null): string {
  const normalized = normalizeGovernorateLookup(value);
  if (!normalized) {
    return '';
  }

  const exactMatch = GOVERNORATE_ALIASES.get(normalized);
  if (exactMatch) {
    return exactMatch;
  }

  for (const [alias, canonical] of SORTED_GOVERNORATE_ALIASES) {
    if (normalized.includes(alias)) {
      return canonical;
    }
  }

  return toTitleCase(normalized);
}

export function normalizeGovernorateList(values?: readonly (string | null | undefined)[] | null): string[] {
  if (!values?.length) {
    return [];
  }

  const supported = new Set<string>();
  const extras = new Set<string>();

  for (const value of values) {
    const canonical = normalizeGovernorate(value);
    if (!canonical) {
      continue;
    }

    if (CANONICAL_GOVERNORATES.some((governorate) => governorate === canonical)) {
      supported.add(canonical);
    } else {
      extras.add(canonical);
    }
  }

  const ordered: string[] = TUNISIA_GOVERNORATES.filter((governorate) => supported.has(governorate));
  ordered.push(...extras);
  return ordered;
}

export function governoratesMatch(left?: string | null, right?: string | null): boolean {
  const normalizedLeft = normalizeGovernorate(left);
  const normalizedRight = normalizeGovernorate(right);
  return !!normalizedLeft && normalizedLeft === normalizedRight;
}

function buildGovernorateAliases(): Map<string, string> {
  const aliases = new Map<string, string>();

  registerGovernorateAlias(aliases, 'Tunis', 'Tunis');
  registerGovernorateAlias(aliases, 'Ariana', 'Ariana');
  registerGovernorateAlias(aliases, 'Ben Arous', 'Ben Arous');
  registerGovernorateAlias(aliases, 'Manouba', 'Manouba', 'Mannouba');
  registerGovernorateAlias(aliases, 'Nabeul', 'Nabeul');
  registerGovernorateAlias(aliases, 'Zaghouan', 'Zaghouan');
  registerGovernorateAlias(aliases, 'Bizerte', 'Bizerte');
  registerGovernorateAlias(aliases, 'Beja', 'Beja', 'Béja', 'BÃ©ja');
  registerGovernorateAlias(aliases, 'Jendouba', 'Jendouba');
  registerGovernorateAlias(aliases, 'Kef', 'Kef', 'Le Kef');
  registerGovernorateAlias(aliases, 'Siliana', 'Siliana');
  registerGovernorateAlias(aliases, 'Sousse', 'Sousse');
  registerGovernorateAlias(aliases, 'Monastir', 'Monastir');
  registerGovernorateAlias(aliases, 'Mahdia', 'Mahdia');
  registerGovernorateAlias(aliases, 'Sfax', 'Sfax');
  registerGovernorateAlias(aliases, 'Kairouan', 'Kairouan');
  registerGovernorateAlias(aliases, 'Kasserine', 'Kasserine');
  registerGovernorateAlias(aliases, 'Sidi Bouzid', 'Sidi Bouzid');
  registerGovernorateAlias(aliases, 'Gabes', 'Gabes', 'Gabès', 'GabÃ¨s');
  registerGovernorateAlias(aliases, 'Medenine', 'Medenine', 'Médenine', 'MÃ©denine');
  registerGovernorateAlias(aliases, 'Tataouine', 'Tataouine');
  registerGovernorateAlias(aliases, 'Gafsa', 'Gafsa');
  registerGovernorateAlias(aliases, 'Tozeur', 'Tozeur');
  registerGovernorateAlias(aliases, 'Kebili', 'Kebili', 'Kébili', 'KÃ©bili');

  return aliases;
}

function registerGovernorateAlias(aliases: Map<string, string>, canonical: string, ...variants: string[]): void {
  for (const variant of variants) {
    const normalized = normalizeGovernorateLookup(variant);
    if (normalized) {
      aliases.set(normalized, canonical);
    }
  }
}

function normalizeGovernorateLookup(value?: string | null): string {
  const cleaned = value?.trim();
  if (!cleaned) {
    return '';
  }

  const normalized = cleaned.normalize('NFD');
  let builder = '';
  let previousWhitespace = false;

  for (const char of normalized) {
    if (/\p{M}/u.test(char)) {
      continue;
    }

    if (/\p{L}|\p{N}/u.test(char)) {
      builder += char.toLowerCase();
      previousWhitespace = false;
      continue;
    }

    if ((/\s/u.test(char) || char === '-' || char === '_' || char === '/') && builder && !previousWhitespace) {
      builder += ' ';
      previousWhitespace = true;
    }
  }

  return builder.trim();
}

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}
