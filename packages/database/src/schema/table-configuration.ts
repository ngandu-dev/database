export class TableConfiguration {
  constructor(private readonly maxIdentifierLength: number) {}

  public getMaxIdentifierLength(): number {
    return this.maxIdentifierLength;
  }
}
