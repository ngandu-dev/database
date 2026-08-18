import { InvalidSequenceDefinition } from "./exception/invalid-sequence-definition";
import { Sequence } from "./sequence";

export class SequenceEditor {
  private name: string | null = null;
  private allocationSize = 1;
  private initialValue = 1;
  private cacheSize: number | null = null;

  public setName(name: string): this {
    this.name = name;
    return this;
  }

  public setQuotedName(name: string, schemaName: string | null = null): this {
    this.name = schemaName === null ? `"${name}"` : `"${schemaName}"."${name}"`;
    return this;
  }

  public setUnquotedName(name: string, schemaName: string | null = null): this {
    this.name = schemaName === null ? name : `${schemaName}.${name}`;
    return this;
  }

  public setAllocationSize(allocationSize: number): this {
    this.allocationSize = allocationSize;
    return this;
  }

  public setInitialValue(initialValue: number): this {
    this.initialValue = initialValue;
    return this;
  }

  public setCacheSize(cacheSize: number | null): this {
    if (cacheSize !== null && cacheSize < 0) {
      throw InvalidSequenceDefinition.fromNegativeCacheSize(cacheSize);
    }

    this.cacheSize = cacheSize;
    return this;
  }

  public create(): Sequence {
    if (this.name === null) {
      throw InvalidSequenceDefinition.nameNotSet();
    }

    if (this.allocationSize < 0) {
      throw InvalidSequenceDefinition.fromNegativeCacheSize(this.allocationSize);
    }

    if (this.cacheSize !== null && this.cacheSize < 0) {
      throw InvalidSequenceDefinition.fromNegativeCacheSize(this.cacheSize);
    }

    return new Sequence(this.name, this.allocationSize, this.initialValue, this.cacheSize);
  }
}
