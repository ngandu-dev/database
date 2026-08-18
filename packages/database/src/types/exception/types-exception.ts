import { initializeException } from "../../exception/_internal";

export class TypesException extends Error {
  constructor(message: string) {
    super(message);
    initializeException(this, new.target);
  }
}
