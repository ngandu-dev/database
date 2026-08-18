import { ConversionException } from "../conversion-exception";

export class InvalidFormat extends ConversionException {
  public static new(
    value: string,
    toType: string,
    expectedFormat?: string | null,
    previous?: unknown,
  ): InvalidFormat {
    const preview = value.length > 32 ? `${value.slice(0, 20)}...` : value;
    const suffix = expectedFormat ?? "";
    const message = `Could not convert database value "${preview}" to Datazen Type ${toType}. Expected format "${suffix}".`;

    return new InvalidFormat(message, previous);
  }

  constructor(
    message: string,
    public readonly previous?: unknown,
  ) {
    super(message);
  }
}
