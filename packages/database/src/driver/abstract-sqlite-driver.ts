import type { Driver } from "../driver";
import { SQLitePlatform } from "../platforms/sqlite-platform";
import type { ServerVersionProvider } from "../server-version-provider";
import type { ExceptionConverter as DriverExceptionConverter } from "./api/exception-converter";
import { ExceptionConverter } from "./api/sqlite/exception-converter";

export abstract class AbstractSQLiteDriver implements Driver {
  public getDatabasePlatform(_versionProvider: ServerVersionProvider): SQLitePlatform {
    return new SQLitePlatform();
  }

  public getExceptionConverter(): DriverExceptionConverter {
    return new ExceptionConverter();
  }

  public abstract connect(params: Record<string, unknown>): ReturnType<Driver["connect"]>;
}
