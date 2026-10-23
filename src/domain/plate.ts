// ABC1234 (antigo) ou ABC1D23 (Mercosul)
const PLATE_PATTERN = /^[A-Z]{3}\d[A-Z0-9]\d{2}$/;

/** "abc-1d23" -> "ABC1D23". Retorna null se não for uma placa válida. */
export function normalizePlate(input: string): string | null {
  const plate = input.toUpperCase().replace(/[\s-]/g, '');
  return PLATE_PATTERN.test(plate) ? plate : null;
}

/** "ABC1234" -> "ABC-1234"; placas Mercosul ficam sem hífen. */
export function formatPlate(plate: string): string {
  return /^[A-Z]{3}\d{4}$/.test(plate) ? `${plate.slice(0, 3)}-${plate.slice(3)}` : plate;
}
