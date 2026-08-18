import { InvalidArgumentException } from "./invalid-argument-exception";

export class UnknownDriver extends InvalidArgumentException {
  public static new(unknownDriverName: string, knownDrivers: string[]): UnknownDriver {
    return new UnknownDriver(
      `The given driver "${unknownDriverName}" is unknown, Doctrine currently supports only the following drivers: ${knownDrivers.join(", ")}`,
    );
  }
}
