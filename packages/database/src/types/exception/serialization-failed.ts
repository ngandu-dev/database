import { ConversionException } from "../conversion-exception";

export class SerializationFailed extends ConversionException {
  public static new(
    value: unknown,
    format: string,
    error: string,
    previous?: unknown,
  ): SerializationFailed {
    const className =
      value === null
        ? "null"
        : value === undefined
          ? "undefined"
          : (value.constructor?.name ?? typeof value);
    const message = `Could not convert Node type "${className}" to "${format}". An error was triggered by the serialization: ${error}`;

    return new SerializationFailed(message, previous);
  }

  constructor(
    message: string,
    public readonly previous?: unknown,
  ) {
    super(message);
  }
}
