import { TableConfiguration } from "./table-configuration";

export class SchemaConfig {
  private name: string | null = null;
  private defaultTableOptions: Record<string, unknown> = {};
  private maxIdentifierLength = 63;

  public getName(): string | null {
    return this.name;
  }

  public setName(name: string | null): this {
    this.name = name;
    return this;
  }

  public getDefaultTableOptions(): Record<string, unknown> {
    return { ...this.defaultTableOptions };
  }

  public setDefaultTableOptions(defaultTableOptions: Record<string, unknown>): this {
    this.defaultTableOptions = { ...defaultTableOptions };
    return this;
  }

  public getMaxIdentifierLength(): number {
    return this.maxIdentifierLength;
  }

  public setMaxIdentifierLength(maxIdentifierLength: number): this {
    this.maxIdentifierLength = maxIdentifierLength;
    return this;
  }

  public toTableConfiguration(): TableConfiguration {
    return new TableConfiguration(this.maxIdentifierLength);
  }
}
