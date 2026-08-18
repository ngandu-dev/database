import { initializeException } from "./_internal";

export class InvalidColumnIndex extends Error {
  public static new(index: number, previous?: unknown): InvalidColumnIndex {
    return new InvalidColumnIndex(`Invalid column index "${index}".`, previous);
  }

  constructor(message: string, cause?: unknown) {
    super(message);
    initializeException(this, new.target);

    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}
