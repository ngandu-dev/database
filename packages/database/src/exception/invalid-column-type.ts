import { initializeException } from "./_internal";

export abstract class InvalidColumnType extends Error {
  protected constructor(message: string) {
    super(message);
    initializeException(this, new.target);
  }
}
