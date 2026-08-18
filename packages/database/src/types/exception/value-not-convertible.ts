import { ConversionException } from "../conversion-exception";

function previewValue(value: unknown): string {
  if (typeof value === "string") {
    return value.length > 32 ? `${value.slice(0, 20)}...` : value;
  }

  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  return value.constructor?.name ?? typeof value;
}

export class ValueNotConvertible extends ConversionException {
  public static new(
    value: unknown,
    toType: string,
    message?: string | null,
    previous?: unknown,
  ): ValueNotConvertible {
    const errorMessage =
      message === undefined || message === null
        ? `Could not convert database value "${previewValue(value)}" to Datazen Type "${toType}".`
        : `Could not convert database value to "${toType}" as an error was triggered by the unserialization: ${message}`;

    return new ValueNotConvertible(errorMessage, previous);
  }

  constructor(
    message: string,
    public readonly previous?: unknown,
  ) {
    super(message);
  }
}
