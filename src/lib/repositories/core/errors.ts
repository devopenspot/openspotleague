export class InvalidReferenceError extends Error {
  readonly code = "INVALID_REFERENCE"

  constructor(message: string) {
    super(message)
    this.name = "InvalidReferenceError"
  }
}

export class StaleRecordError extends Error {
  readonly code = "STALE_RECORD"

  constructor(message = "The record changed before this update was saved") {
    super(message)
    this.name = "StaleRecordError"
  }
}

export class InvalidConcurrencyTokenError extends Error {
  readonly code = "INVALID_CONCURRENCY_TOKEN"

  constructor() {
    super("The concurrency token is invalid")
    this.name = "InvalidConcurrencyTokenError"
  }
}

export function isStaleRecordError(error: unknown): error is StaleRecordError {
  return error instanceof StaleRecordError
}

export function isInvalidReferenceError(
  error: unknown,
): error is InvalidReferenceError {
  return error instanceof InvalidReferenceError
}

export function isInvalidConcurrencyTokenError(
  error: unknown,
): error is InvalidConcurrencyTokenError {
  return error instanceof InvalidConcurrencyTokenError
}
