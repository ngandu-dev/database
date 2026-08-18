import { InvalidArgumentException } from "./invalid-argument-exception";

export class InvalidDriverClass extends InvalidArgumentException {
  public static new(driverClass: string): InvalidDriverClass {
    return new InvalidDriverClass(
      `The given driver class ${driverClass} has to implement the Driver interface.`,
    );
  }
}
