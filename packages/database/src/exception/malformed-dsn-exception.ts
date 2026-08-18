import { initializeException } from "./_internal";

export class MalformedDsnException extends Error {
  constructor(message = "Malformed database connection URL") {
    super(message);
    initializeException(this, new.target);
  }

  public static new(): MalformedDsnException {
    return new MalformedDsnException();
  }
}
