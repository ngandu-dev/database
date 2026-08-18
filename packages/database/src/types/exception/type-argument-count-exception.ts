import { TypesException } from "./types-exception";

export class TypeArgumentCountException extends TypesException {
  public static new(name: string, previous?: unknown): TypeArgumentCountException {
    return new TypeArgumentCountException(
      `Type "${name}" could not be instantiated without constructor arguments.`,
      previous,
    );
  }

  constructor(
    message: string,
    public readonly previous?: unknown,
  ) {
    super(message);
  }
}
