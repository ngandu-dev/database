import type { Exception } from "./exception";

export abstract class AbstractException extends Error implements Exception {
  public readonly code: number;
  public readonly sqlState: string | null;

  constructor(message: string, sqlState: string | null = null, code = 0, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.sqlState = sqlState;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);

    if (cause !== undefined) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        enumerable: false,
        value: cause,
        writable: true,
      });
    }
  }

  public getSQLState(): string | null {
    return this.sqlState;
  }
}
