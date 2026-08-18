import { initializeException } from "./_internal";

export class NoKeyValue extends Error {
  public static fromColumnCount(columnCount: number): NoKeyValue {
    return new NoKeyValue(
      `Fetching as key-value pairs requires the result to contain at least 2 columns, ${columnCount} given.`,
    );
  }

  constructor(message: string) {
    super(message);
    initializeException(this, new.target);
  }
}
