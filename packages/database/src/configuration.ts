import type { Middleware as DriverMiddleware } from "./driver/middleware";
import type { SchemaManagerFactory } from "./schema/schema-manager-factory";

interface ConfigurationOptions {
  autoCommit?: boolean;
  disableTypeComments?: boolean;
  middlewares?: DriverMiddleware[];
  schemaAssetsFilter?: (assetName: string) => boolean;
  schemaManagerFactory?: SchemaManagerFactory;
}

export class Configuration {
  private autoCommit: boolean = true;
  private disableTypeComments: boolean = false;
  private middlewares: DriverMiddleware[] = [];
  protected schemaAssetsFilter: (assetName: string) => boolean;
  private schemaManagerFactory: SchemaManagerFactory | null = null;

  constructor(options?: ConfigurationOptions) {
    this.autoCommit = options?.autoCommit ?? true;
    this.disableTypeComments = options?.disableTypeComments ?? false;
    this.middlewares = options?.middlewares ?? [];
    this.schemaAssetsFilter = options?.schemaAssetsFilter ?? (() => true);
    this.schemaManagerFactory = options?.schemaManagerFactory ?? null;
  }

  public getAutoCommit(): boolean {
    return this.autoCommit;
  }

  public setAutoCommit(autoCommit: boolean): this {
    this.autoCommit = autoCommit;
    return this;
  }

  public getDisableTypeComments(): boolean {
    return this.disableTypeComments;
  }

  public setDisableTypeComments(disableTypeComments: boolean): this {
    this.disableTypeComments = disableTypeComments;
    return this;
  }

  public getMiddlewares(): readonly DriverMiddleware[] {
    return this.middlewares;
  }

  public setMiddlewares(middlewares: DriverMiddleware[]): this {
    this.middlewares = [...middlewares];
    return this;
  }

  public addMiddleware(middleware: DriverMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  public getSchemaAssetsFilter(): (assetName: string) => boolean {
    return this.schemaAssetsFilter;
  }

  public setSchemaAssetsFilter(schemaAssetsFilter: (assetName: string) => boolean): this {
    this.schemaAssetsFilter = schemaAssetsFilter;
    return this;
  }

  public getSchemaManagerFactory(): SchemaManagerFactory | null {
    return this.schemaManagerFactory;
  }

  public setSchemaManagerFactory(schemaManagerFactory: SchemaManagerFactory | null): this {
    this.schemaManagerFactory = schemaManagerFactory;
    return this;
  }
}
