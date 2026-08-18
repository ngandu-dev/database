import { initializeException } from "./_internal";

export class MissingPositionalParameterException extends Error {
  constructor(index: number) {
    super(`Positional parameter at index ${index} does not have a bound value.`);
    initializeException(this, new.target);
  }
}
