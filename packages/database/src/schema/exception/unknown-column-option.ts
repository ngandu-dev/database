import type { SchemaException } from "../schema-exception";

export class UnknownColumnOption extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "UnknownColumnOption";
  }

  public static new(name: string): UnknownColumnOption {
    return new UnknownColumnOption(`The "${name}" column option is not supported.`);
  }
}
