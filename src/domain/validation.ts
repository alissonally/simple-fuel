import { isValidISODate } from './dates';
import { litersFrom } from './money';
import type { Cycle, FuelType } from './types';

export const PRICE_MIN_MILLI = 2_000;
export const PRICE_MAX_MILLI = 15_000;
export const MAX_LITERS_ML = 120_000;
export const MAX_ODOMETER_JUMP_KM = 2_000;

export type FuelingField =
  'vehicleId' | 'date' | 'odometerKm' | 'pricePerLiterMilli' | 'totalCents' | 'fuelType';

export type IssueCode =
  | 'required'
  | 'not_positive'
  | 'not_integer'
  | 'invalid_date'
  | 'future_date'
  | 'duplicate_odometer'
  | 'odometer_date_mismatch'
  | 'before_segment_start'
  | 'price_out_of_range'
  | 'liters_too_high'
  | 'odometer_jump';

export interface NeighborFueling {
  id: string;
  date: string;
  odometerKm: number;
}

export interface ValidationIssue {
  level: 'error' | 'warning';
  code: IssueCode;
  field: FuelingField;
  message: string;
  /** Registros vizinhos envolvidos, quando a mensagem precisa mostrá-los. */
  neighbors?: NeighborFueling[];
}

export interface FuelingInput {
  vehicleId?: string | null;
  date?: string | null;
  odometerKm?: number | null;
  pricePerLiterMilli?: number | null;
  totalCents?: number | null;
  fuelType?: FuelType | null;
}

export interface ValidationContext {
  today: string; // YYYY-MM-DD
  segmentStartedOn: string; // YYYY-MM-DD
  /** Abastecimentos ativos do mesmo segmento. O registro em edição é ignorado pelo id. */
  segmentFuelings: NeighborFueling[];
  editingId?: string | null;
}

const MESSAGES = {
  required: 'Campo obrigatório',
  not_positive: 'Informe um valor maior que zero',
  not_integer: 'Use um número inteiro, sem casas decimais',
  invalid_date: 'Data inválida',
  future_date: 'A data não pode ser futura',
  duplicate_odometer: 'Já existe um abastecimento com esse odômetro',
  odometer_date_mismatch: 'Odômetro incoerente com a data dos registros vizinhos',
  before_segment_start: 'Essa data pertence a um odômetro anterior ao reinício',
  price_out_of_range: 'Preço fora do comum. Confira se não houve erro de digitação',
  liters_too_high: 'Volume acima do comum para um tanque',
  odometer_jump: 'Faltou registrar algum abastecimento?',
} satisfies Record<IssueCode, string>;

function issue(
  level: ValidationIssue['level'],
  code: IssueCode,
  field: FuelingField,
  neighbors?: NeighborFueling[],
): ValidationIssue {
  return { level, code, field, message: MESSAGES[code], ...(neighbors ? { neighbors } : {}) };
}

function checkPositive(
  issues: ValidationIssue[],
  field: FuelingField,
  value: number | null | undefined,
): value is number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    issues.push(issue('error', 'required', field));
    return false;
  }
  if (value <= 0) {
    issues.push(issue('error', 'not_positive', field));
    return false;
  }
  return true;
}

/** Regras da seção 7. Erros bloqueiam o salvamento; avisos pedem confirmação. */
export function validateFueling(input: FuelingInput, ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!input.vehicleId) issues.push(issue('error', 'required', 'vehicleId'));
  if (!input.fuelType) issues.push(issue('error', 'required', 'fuelType'));

  const { date } = input;
  let dateOk = false;
  if (!date) {
    issues.push(issue('error', 'required', 'date'));
  } else if (!isValidISODate(date)) {
    issues.push(issue('error', 'invalid_date', 'date'));
  } else if (date > ctx.today) {
    issues.push(issue('error', 'future_date', 'date'));
  } else if (date < ctx.segmentStartedOn) {
    issues.push(issue('error', 'before_segment_start', 'date'));
  } else {
    dateOk = true;
  }

  const odometerKm = input.odometerKm;
  let odometerOk = checkPositive(issues, 'odometerKm', odometerKm);
  if (odometerOk && !Number.isInteger(odometerKm)) {
    issues.push(issue('error', 'not_integer', 'odometerKm'));
    odometerOk = false;
  }

  const priceOk = checkPositive(issues, 'pricePerLiterMilli', input.pricePerLiterMilli);
  const totalOk = checkPositive(issues, 'totalCents', input.totalCents);

  if (odometerOk && typeof odometerKm === 'number') {
    const others = ctx.segmentFuelings.filter((f) => f.id !== ctx.editingId);
    if (others.some((f) => f.odometerKm === odometerKm)) {
      issues.push(issue('error', 'duplicate_odometer', 'odometerKm'));
    } else {
      const previous = others
        .filter((f) => f.odometerKm < odometerKm)
        .reduce<NeighborFueling | null>(
          (a, f) => (!a || f.odometerKm > a.odometerKm ? f : a),
          null,
        );
      const next = others
        .filter((f) => f.odometerKm > odometerKm)
        .reduce<NeighborFueling | null>(
          (a, f) => (!a || f.odometerKm < a.odometerKm ? f : a),
          null,
        );

      if (dateOk && date) {
        const previousLater = previous && previous.date > date;
        const nextEarlier = next && next.date < date;
        if (previousLater || nextEarlier) {
          const neighbors = [previous, next].filter((f): f is NeighborFueling => f !== null);
          issues.push(issue('error', 'odometer_date_mismatch', 'odometerKm', neighbors));
        }
      }

      if (previous && odometerKm - previous.odometerKm > MAX_ODOMETER_JUMP_KM) {
        issues.push(issue('warning', 'odometer_jump', 'odometerKm', [previous]));
      }
    }
  }

  const price = input.pricePerLiterMilli;
  if (priceOk && typeof price === 'number') {
    if (price < PRICE_MIN_MILLI || price > PRICE_MAX_MILLI) {
      issues.push(issue('warning', 'price_out_of_range', 'pricePerLiterMilli'));
    }
    if (totalOk && typeof input.totalCents === 'number') {
      if (litersFrom(input.totalCents, price) > MAX_LITERS_ML) {
        issues.push(issue('warning', 'liters_too_high', 'totalCents'));
      }
    }
  }

  return issues;
}

export const hasErrors = (issues: ValidationIssue[]) => issues.some((i) => i.level === 'error');
export const warningsOf = (issues: ValidationIssue[]) =>
  issues.filter((i) => i.level === 'warning');

export interface PostSaveNotice {
  cycle: Cycle;
  /** Ciclo fora do padrão: a UI oferece "Ignorar este ciclo na média". */
  outlier: boolean;
}

/** Aviso pós-salvamento: o ciclo fechado pelo abastecimento salvo, se houver. */
export function postSaveNotice(fuelingId: string, cycles: Cycle[]): PostSaveNotice | null {
  const cycle = cycles.find((c) => c.closingFuelingId === fuelingId);
  if (!cycle) return null;
  return { cycle, outlier: cycle.outlier && !cycle.excluded };
}
