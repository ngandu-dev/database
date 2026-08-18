import type { SchemaException } from "../schema-exception";

export class SequenceDoesNotExist extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "SequenceDoesNotExist";
  }

  public static new(sequenceName: string): SequenceDoesNotExist {
    return new SequenceDoesNotExist(`There exists no sequence with the name "${sequenceName}".`);
  }
}
