export class SequenceMetadataRow {
  constructor(
    private readonly schemaName: string | null,
    private readonly sequenceName: string,
    private readonly allocationSize: number,
    private readonly initialValue: number,
    private readonly cacheSize: number | null,
  ) {}

  public getSchemaName(): string | null {
    return this.schemaName;
  }

  public getSequenceName(): string {
    return this.sequenceName;
  }

  public getAllocationSize(): number {
    return this.allocationSize;
  }

  public getInitialValue(): number {
    return this.initialValue;
  }

  public getCacheSize(): number | null {
    return this.cacheSize;
  }
}
