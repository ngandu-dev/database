import { initializeException } from "./_internal";

export class MissingNamedParameterException extends Error {
  constructor(name: string) {
    super(`Named parameter "${name}" does not have a bound value.`);
    initializeException(this, new.target);
  }
}
