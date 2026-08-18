import type { Exception } from "../exception";

export class MissingPositionalParameter extends Error implements Exception {
  public static new(index: number): MissingPositionalParameter {
    return new MissingPositionalParameter(index);
  }

  constructor(index: number) {
    super(`Positional parameter at index ${index} does not have a bound value.`);
  }
}
