import type { ValidationIssue } from '@/domain/validation';

/** Erro de regra de negócio, com mensagem pronta para a interface. */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

/** Abastecimento recusado: erros, ou avisos sem `confirmWarnings`. */
export class FuelingValidationError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super(issues.map((i) => i.message).join('\n'));
    this.name = 'FuelingValidationError';
  }

  get onlyWarnings(): boolean {
    return this.issues.every((i) => i.level === 'warning');
  }
}
