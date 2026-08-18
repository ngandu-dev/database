import { initializeException } from "./_internal";

export class InvalidArgumentException extends Error {
  constructor(message: string) {
    super(message);
    initializeException(this, new.target);
  }
}
