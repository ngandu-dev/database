import type { SchemaException } from "../schema-exception";

export class InvalidSequenceDefinition extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSequenceDefinition";
  }

  public static nameNotSet(): InvalidSequenceDefinition {
    return new InvalidSequenceDefinition("Sequence name is not set.");
  }

  public static fromNegativeCacheSize(cacheSize: number): InvalidSequenceDefinition {
    return new InvalidSequenceDefinition(
      `Sequence cache size must be a non-negative integer, ${cacheSize} given.`,
    );
  }
}
