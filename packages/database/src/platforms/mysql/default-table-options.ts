export class DefaultTableOptions {
  public constructor(
    private readonly charset: string,
    private readonly collation: string,
  ) {}

  public getCharset(): string {
    return this.charset;
  }

  public getCollation(): string {
    return this.collation;
  }
}
