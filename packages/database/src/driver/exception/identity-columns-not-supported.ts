import { AbstractException } from "../abstract-exception";

export class IdentityColumnsNotSupported extends AbstractException {
  public static new(cause?: unknown): IdentityColumnsNotSupported {
    return new IdentityColumnsNotSupported(
      "The driver does not support identity columns.",
      null,
      0,
      cause,
    );
  }
}
