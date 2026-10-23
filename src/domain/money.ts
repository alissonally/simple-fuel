const CURRENCY_PREFIX = /^R\$\s*/i;

/**
 * Converte um decimal pt-BR ("1.234,56", "1234,56", "1234") num inteiro escalado
 * por 10^decimals. Retorna null para texto inválido ou com casas demais.
 */
function parseScaled(input: string, decimals: number): number | null {
  const text = input.trim().replace(CURRENCY_PREFIX, '');
  const pattern = new RegExp(`^(\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,(\\d{1,${decimals}}))?$`);
  const match = pattern.exec(text);
  if (!match) return null;
  const integerPart = (match[1] ?? '').replace(/\./g, '');
  const fractionPart = (match[2] ?? '').padEnd(decimals, '0');
  return Number(integerPart + fractionPart);
}

function groupThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatScaled(value: number, decimals: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(Math.round(value));
  const scale = 10 ** decimals;
  const integerPart = groupThousands(Math.floor(abs / scale));
  const fractionPart = String(abs % scale).padStart(decimals, '0');
  return `${sign}${integerPart},${fractionPart}`;
}

/** "1.234,56" -> 123456 (centavos) */
export function parseBRL(input: string): number | null {
  return parseScaled(input, 2);
}

/** 123456 -> "R$ 1.234,56" */
export function formatBRL(cents: number): string {
  const formatted = formatScaled(cents, 2);
  return formatted.startsWith('-') ? `-R$ ${formatted.slice(1)}` : `R$ ${formatted}`;
}

/** "5,899" -> 5899 (milésimos de real) */
export function parsePriceMilli(input: string): number | null {
  return parseScaled(input, 3);
}

/** 5899 -> "R$ 5,899" */
export function formatPrice(milli: number): string {
  return `R$ ${formatScaled(milli, 3)}`;
}

/** Litros (em ml) pagos com `totalCents` a `priceMilli` por litro. */
export function litersFrom(totalCents: number, priceMilli: number): number {
  if (priceMilli <= 0) return 0;
  return Math.round((totalCents * 10_000) / priceMilli);
}
