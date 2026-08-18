import { initializeException } from "./_internal";

export class DatabaseRequired extends Error {
  constructor(message: string) {
    super(message);
    initializeException(this, new.target);
  }

  public static new(methodName: string): DatabaseRequired {
    return new DatabaseRequired(`A database is required for the method: ${methodName}.`);
  }
}
