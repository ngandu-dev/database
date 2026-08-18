import type { SchemaException } from "../schema-exception";
import { nameToString } from "./_internal";

export class IncomparableNames extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "IncomparableNames";
  }

  public static fromOptionallyQualifiedNames(name1: unknown, name2: unknown): IncomparableNames {
    return new IncomparableNames(
      `Non-equally qualified names are incomparable: ${nameToString(name1)}, ${nameToString(name2)}.`,
    );
  }
}
