import { initializeException } from "./_internal";
import { InvalidColumnType } from "./invalid-column-type";

export class InvalidColumnDeclaration extends Error {
  public static fromInvalidColumnType(
    columnName: string,
    error: InvalidColumnType,
  ): InvalidColumnDeclaration {
    return new InvalidColumnDeclaration(`Column "${columnName}" has invalid type`, error);
  }

  constructor(message: string, cause?: unknown) {
    super(message);
    initializeException(this, new.target);

    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}
