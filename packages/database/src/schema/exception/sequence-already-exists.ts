import type { SchemaException } from "../schema-exception";

export class SequenceAlreadyExists extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "SequenceAlreadyExists";
  }

  public static new(sequenceName: string): SequenceAlreadyExists {
    return new SequenceAlreadyExists(`The sequence "${sequenceName}" already exists.`);
  }
}
