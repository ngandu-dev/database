import type { Exception } from "../exception";

export class MissingNamedParameter extends Error implements Exception {
  public static new(name: string): MissingNamedParameter {
    return new MissingNamedParameter(name);
  }

  constructor(name: string) {
    super(`Named parameter "${name}" does not have a bound value.`);
  }
}
