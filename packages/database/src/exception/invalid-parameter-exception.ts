import { initializeException } from "./_internal";

export class InvalidParameterException extends Error {
  constructor(message = "Invalid parameter.") {
    super(message);
    initializeException(this, new.target);
  }
}
