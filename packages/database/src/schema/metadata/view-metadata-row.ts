export class ViewMetadataRow {
  constructor(
    private readonly schemaName: string | null,
    private readonly viewName: string,
    private readonly definition: string,
  ) {}

  public getSchemaName(): string | null {
    return this.schemaName;
  }

  public getViewName(): string {
    return this.viewName;
  }

  public getDefinition(): string {
    return this.definition;
  }
}
