import { ConversionException } from "../conversion-exception";

function describeValue(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  const primitive = typeof value;
  if (
    primitive === "string" ||
    primitive === "number" ||
    primitive === "boolean" ||
    primitive === "bigint"
  ) {
    return JSON.stringify(value);
  }

  return `type ${value.constructor?.name ?? primitive}`;
}

export class InvalidType extends ConversionException {
  public static new(
    value: unknown,
    toType: string,
    possibleTypes: string[],
    previous?: unknown,
  ): InvalidType {
    const description = describeValue(value);
    const message = `Could not convert Node value ${description} to type ${toType}. Expected one of the following types: ${possibleTypes.join(", ")}.`;

    return new InvalidType(message, previous);
  }

  constructor(
    message: string,
    public readonly previous?: unknown,
  ) {
    super(message);
  }
}
