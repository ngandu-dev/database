import type { Driver } from "../driver";
import { DB2Platform } from "../platforms/db2-platform";
import type { ServerVersionProvider } from "../server-version-provider";
import { ExceptionConverter } from "./api/db2/exception-converter";
import type { ExceptionConverter as DriverExceptionConverter } from "./api/exception-converter";

export abstract class AbstractDB2Driver implements Driver {
  public getDatabasePlatform(_versionProvider: ServerVersionProvider): DB2Platform {
    return new DB2Platform();
  }

  public getExceptionConverter(): DriverExceptionConverter {
    return new ExceptionConverter();
  }

  public abstract connect(params: Record<string, unknown>): ReturnType<Driver["connect"]>;
}
