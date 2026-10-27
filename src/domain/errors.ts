// A single error class for everything the domain can refuse to do. The CLI
// prints `message` and exits non-zero; tests match on `code`.

export const ErrorCodes = {
  DECK_NOT_FOUND: 'DECK_NOT_FOUND',
  DECK_EXISTS: 'DECK_EXISTS',
  CARD_NOT_FOUND: 'CARD_NOT_FOUND',
  CARD_EXISTS: 'CARD_EXISTS',
  INVALID_GRADE: 'INVALID_GRADE',
  INVALID_DATE: 'INVALID_DATE',
  IMPORT_SYNTAX: 'IMPORT_SYNTAX',
  NOT_A_LEECH: 'NOT_A_LEECH',
  BAD_DATA_FILE: 'BAD_DATA_FILE',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
