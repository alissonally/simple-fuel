import { isValidISODate } from './dates';
import type { FuelType } from './types';

/**
 * Campos de um abastecimento extraídos de uma frase livre em pt-BR, digitada ou
 * ditada. Só os campos reconhecidos aparecem no resultado; o formulário completa
 * o resto com os padrões de sempre.
 */
export interface ParsedFueling {
  date?: string; // YYYY-MM-DD
  odometerKm?: number;
  pricePerLiterMilli?: number;
  totalCents?: number;
  fullTank?: boolean;
  fuelType?: FuelType;
  station?: string;
}

const MONTHS: Record<string, number> = {
  janeiro: 1,
  jan: 1,
  fevereiro: 2,
  fev: 2,
  marco: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  maio: 5,
  mai: 5,
  junho: 6,
  jun: 6,
  julho: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  setembro: 9,
  set: 9,
  outubro: 10,
  out: 10,
  novembro: 11,
  nov: 11,
  dezembro: 12,
  dez: 12,
};
const MONTH_PATTERN = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join('|');

const ACCENTS: Record<string, string> = {
  á: 'a',
  à: 'a',
  â: 'a',
  ã: 'a',
  é: 'e',
  ê: 'e',
  í: 'i',
  ó: 'o',
  ô: 'o',
  õ: 'o',
  ú: 'u',
  ü: 'u',
  ç: 'c',
  º: 'o',
  ª: 'a',
};

/**
 * Minúsculas e sem acentos, caractere por caractere, para que os índices continuem
 * alinhados com o texto original (o nome do posto é recortado do original).
 */
function normalize(text: string): string {
  return Array.from(text, (char) => {
    const lower = char.toLowerCase();
    const plain = ACCENTS[lower] ?? lower;
    return plain.length === 1 ? plain : char;
  }).join('');
}

/** Troca um trecho por espaços, sem mudar o tamanho do texto. */
function blank(text: string, start: number, end: number): string {
  return text.slice(0, start) + ' '.repeat(end - start) + text.slice(end);
}

const pad = (value: number) => String(value).padStart(2, '0');

function shiftDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  const date = new Date(year, month - 1, day + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Monta a data. Sem ano, usa o ano de hoje e, se a data cair no futuro, o ano
 * anterior. Sem mês ("dia 30"), usa o mês de hoje e, se cair no futuro, o anterior.
 */
function buildDate(
  today: string,
  day: number,
  month: number | null,
  year: number | null,
): string | null {
  const [todayYear, todayMonth] = today.split('-').map(Number) as [number, number];
  const fullYear = year !== null && year < 100 ? 2000 + year : year;
  let y = fullYear ?? todayYear;
  let m = month ?? todayMonth;
  let iso = `${y}-${pad(m)}-${pad(day)}`;
  if (iso > today && fullYear === null) {
    if (month === null) {
      m -= 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
    } else {
      y -= 1;
    }
    iso = `${y}-${pad(m)}-${pad(day)}`;
  }
  return isValidISODate(iso) ? iso : null;
}

interface DateMatch {
  date: string | null;
  start: number;
  end: number;
}

function findDate(text: string, today: string): DateMatch | null {
  const relative = /\b(anteontem|antes de ontem|ontem|hoje)\b/.exec(text);
  if (relative) {
    const offset = { hoje: 0, ontem: -1, anteontem: -2, 'antes de ontem': -2 }[
      relative[1] as 'hoje' | 'ontem' | 'anteontem' | 'antes de ontem'
    ];
    return {
      date: shiftDays(today, offset),
      start: relative.index,
      end: relative.index + relative[0].length,
    };
  }

  const numeric = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}|\d{2}))?\b/.exec(text);
  if (numeric) {
    return {
      date: buildDate(
        today,
        Number(numeric[1]),
        Number(numeric[2]),
        numeric[3] ? Number(numeric[3]) : null,
      ),
      start: numeric.index,
      end: numeric.index + numeric[0].length,
    };
  }

  const written = new RegExp(
    `\\b(?:dia\\s+)?(\\d{1,2}|primeiro)o?\\s+(?:de\\s+)?(${MONTH_PATTERN})\\b(?:\\s+(?:de\\s+)?(\\d{4}))?`,
  ).exec(text);
  if (written) {
    const day = written[1] === 'primeiro' ? 1 : Number(written[1]);
    return {
      date: buildDate(
        today,
        day,
        MONTHS[written[2] as string] ?? null,
        written[3] ? Number(written[3]) : null,
      ),
      start: written.index,
      end: written.index + written[0].length,
    };
  }

  const dayOnly = /\bdia\s+(\d{1,2}|primeiro)\b/.exec(text);
  if (dayOnly) {
    const day = dayOnly[1] === 'primeiro' ? 1 : Number(dayOnly[1]);
    return {
      date: buildDate(today, day, null, null),
      start: dayOnly.index,
      end: dayOnly.index + dayOnly[0].length,
    };
  }
  return null;
}

function findFuelType(text: string): FuelType | undefined {
  // "posto de gasolina" é o lugar, não o combustível.
  const cleaned = text.replace(/\bpostos? de gasolina\b/g, ' ');
  if (/\b(gnv|gas natural)\b/.test(cleaned)) return 'cng';
  if (/\b(etanol|alcool)\b/.test(cleaned)) return 'ethanol';
  if (/\bdiesel\b/.test(cleaned)) return 'diesel';
  if (/\bgasolina\b/.test(cleaned)) return 'gasoline';
  return undefined;
}

function findFullTank(text: string): boolean | undefined {
  if (
    /\b(parcial|nao (?:enchi|completei|completou|encheu)|sem (?:encher|completar)|meio tanque)\b/.test(
      text,
    )
  ) {
    return false;
  }
  if (/\b(tanque cheio|completei|completou|enchi|encheu|cheio)\b/.test(text)) return true;
  return undefined;
}

const STATION_STOP_WORDS = new Set([
  'e',
  'com',
  'em',
  'no',
  'na',
  'dia',
  'hoje',
  'ontem',
  'anteontem',
  'valor',
  'total',
  'odometro',
  'km',
  'litro',
  'pagando',
  'paguei',
  'por',
  'a',
  'r$',
  'tanque',
  'gasolina',
  'etanol',
  'alcool',
  'diesel',
  'gnv',
]);

function findStation(normalized: string, original: string): string | undefined {
  const match = /\bposto\s+(?:de gasolina\s+)?/.exec(normalized);
  if (!match) return undefined;
  const start = match.index + match[0].length;
  const words: string[] = [];
  for (const word of normalized.slice(start).matchAll(/[^\s,.;:!?]+|[,.;:!?]/g)) {
    if (/^[,.;:!?]$|\d/.test(word[0]) || STATION_STOP_WORDS.has(word[0])) break;
    const from = start + word.index;
    words.push(original.slice(from, from + word[0].length));
    if (words.length === 4) break;
  }
  return words.length > 0 ? words.join(' ') : undefined;
}

interface NumberToken {
  /** Valor com no máximo 3 casas, como inteiro de milésimos. */
  milli: number;
  hasFraction: boolean;
  /** Para "6.650": a leitura com ponto decimal (6,65), caso o contexto peça um preço. */
  decimalMilli?: number;
  start: number;
  end: number;
}

/**
 * "85.500" -> 85500; "6,65" -> 6,65; "6.65" -> 6,65 (ditado em inglês);
 * "85 mil e 500" -> 85500.
 */
function readNumbers(text: string): NumberToken[] {
  const pattern = /\d+(?:[.,]\d+)*(?:\s+mil(?:\s+e\s+\d{1,3}\b)?)?/g;
  const tokens: NumberToken[] = [];
  for (const match of text.matchAll(pattern)) {
    const raw = match[0];
    const thousand = /^(\S+)\s+mil(?:\s+e\s+(\d+))?$/.exec(raw);
    const literal = thousand ? (thousand[1] as string) : raw;

    let integer = literal;
    let fraction = '';
    let decimalMilli: number | undefined;
    const comma = literal.lastIndexOf(',');
    if (comma >= 0) {
      integer = literal.slice(0, comma).replace(/[.,]/g, '');
      fraction = literal.slice(comma + 1);
    } else if (literal.includes('.')) {
      const groups = literal.split('.');
      const thousands = groups.slice(1).every((group) => group.length === 3);
      if (thousands) {
        integer = groups.join('');
        if (groups.length === 2) decimalMilli = Math.round(Number(literal) * 1000);
      } else {
        integer = groups.slice(0, -1).join('');
        fraction = groups[groups.length - 1] as string;
      }
    }
    let milli = Math.round(Number(`${integer}.${fraction || '0'}`) * 1000);
    if (thousand) milli = milli * 1000 + Number(thousand[2] ?? 0) * 1000;
    tokens.push({
      milli,
      hasFraction: fraction !== '' && !thousand,
      decimalMilli: thousand ? undefined : decimalMilli,
      start: match.index,
      end: match.index + raw.length,
    });
  }
  return tokens;
}

type Role = 'odometer' | 'price' | 'total' | 'volume';

const PRICE_WORDS = /\b(litro|preco)\b/g;
const ODOMETER_WORDS =
  /\b(odo?m\w*|hodom\w*|quilometr\w*|kilometr\w*|km|painel|marcador|marcando)\b/g;
const TOTAL_WORDS = /(\b(valor|total|paguei|pagou|gastei|gastou|deu|abasteci|reais)\b|r\$)/g;

function lastIndexOf(pattern: RegExp, text: string): number {
  let last = -1;
  for (const match of text.matchAll(pattern)) last = match.index;
  return last;
}

/** Decide o papel de um número pelas palavras ao redor. */
function roleFromContext(prefix: string, suffix: string, hasNext: boolean): Role | null {
  // "valor 200 km 85500": um "km" solto entre dois números é rótulo do seguinte.
  const kmLabelsNext = hasNext && /^\s*kms?\s*$/.test(suffix);
  if (!kmLabelsNext && /^\s*(km|kms|quilometros?|kilometros?)\b/.test(suffix)) return 'odometer';
  if (/^\s*(reais\s+)?(o|por|cada|\/)\s*(litro|l)\b/.test(suffix)) return 'price';
  // A palavra antes do número vale mais que "litro" depois dele: no ditado, sem
  // pontuação, "odômetro 85500 litro a 6,65" não é um volume.
  const price = lastIndexOf(PRICE_WORDS, prefix);
  const odometer = lastIndexOf(ODOMETER_WORDS, prefix);
  if (price >= 0 || odometer >= 0) return price > odometer ? 'price' : 'odometer';
  if (/^\s*(litros?|l)\b/.test(suffix)) return 'volume';
  if (/^\s*reais\b/.test(suffix) || lastIndexOf(TOTAL_WORDS, prefix) >= 0) return 'total';
  return null;
}

/**
 * Interpreta uma frase como "abasteci R$ 200 em 05 de novembro de 2026, odômetro
 * 85500, litro a R$ 6,65". `today` é a data local YYYY-MM-DD usada para "hoje",
 * "ontem" e datas sem ano.
 */
export function parseFuelingText(text: string, today: string): ParsedFueling {
  const original = text;
  let normalized = normalize(text);
  const result: ParsedFueling = {};

  const station = findStation(normalized, original);
  if (station) result.station = station;
  const fuelType = findFuelType(normalized);
  if (fuelType) result.fuelType = fuelType;
  const fullTank = findFullTank(normalized);
  if (fullTank !== undefined) result.fullTank = fullTank;

  const date = findDate(normalized, today);
  if (date) {
    if (date.date) result.date = date.date;
    normalized = blank(normalized, date.start, date.end);
  }

  // "6 reais e 65 centavos" -> "6,65 reais" (mesmo tamanho, para manter os índices).
  normalized = normalized.replace(
    /(\d+)(\s*reais?\s+e\s+)(\d{1,2})(\s*centavos?)/g,
    (whole, reais: string, _middle: string, cents: string) =>
      `${reais},${cents.padStart(2, '0')} reais`.padEnd(whole.length, ' '),
  );

  const tokens = readNumbers(normalized);
  const roles: (Role | null)[] = tokens.map((token, i) => {
    const prefix = normalized.slice(tokens[i - 1]?.end ?? 0, token.start);
    const suffix = normalized.slice(token.end, tokens[i + 1]?.start ?? normalized.length);
    return roleFromContext(prefix, suffix, i < tokens.length - 1);
  });

  const values: Partial<Record<Role, NumberToken>> = {};
  tokens.forEach((token, i) => {
    const role = roles[i];
    if (role && !values[role]) values[role] = token;
  });

  // Números sem contexto: moeda/decimal pequeno é preço, inteiro grande é odômetro.
  tokens.forEach((token, i) => {
    if (roles[i]) return;
    const value = token.milli / 1000;
    if (!token.hasFraction && value >= 1000 && !values.odometer) values.odometer = token;
    else if (token.hasFraction && value < 20 && !values.price) values.price = token;
    else if (!values.total) values.total = token;
  });

  if (values.odometer) result.odometerKm = Math.round(values.odometer.milli / 1000);
  if (values.price) {
    const { milli, decimalMilli } = values.price;
    result.pricePerLiterMilli = milli >= 100_000 && decimalMilli ? decimalMilli : milli;
  }
  if (values.total) result.totalCents = Math.round(values.total.milli / 10);

  // "40 litros": completa o preço ou o total que faltar.
  const volumeMl = values.volume?.milli;
  if (volumeMl) {
    if (result.totalCents !== undefined && result.pricePerLiterMilli === undefined) {
      result.pricePerLiterMilli = Math.round((result.totalCents * 10_000) / volumeMl);
    } else if (result.pricePerLiterMilli !== undefined && result.totalCents === undefined) {
      result.totalCents = Math.round((result.pricePerLiterMilli * volumeMl) / 10_000);
    }
  }

  for (const key of ['odometerKm', 'pricePerLiterMilli', 'totalCents'] as const) {
    const value = result[key];
    if (value !== undefined && value <= 0) delete result[key];
  }
  return result;
}
