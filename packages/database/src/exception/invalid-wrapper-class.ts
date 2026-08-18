import { InvalidArgumentException } from "./invalid-argument-exception";

export class InvalidWrapperClass extends InvalidArgumentException {
  public static new(wrapperClass: string): InvalidWrapperClass {
    return new InvalidWrapperClass(
      `The given wrapper class ${wrapperClass} has to be a subtype of Connection.`,
    );
  }
}
