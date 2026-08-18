import type { Driver } from "../driver";
import { OraclePlatform } from "../platforms/oracle-platform";
import type { ServerVersionProvider } from "../server-version-provider";
import { EasyConnectString } from "./abstract-oracle-driver/easy-connect-string";
import type { ExceptionConverter as DriverExceptionConverter } from "./api/exception-converter";
import { ExceptionConverter } from "./api/oci/exception-converter";

export abstract class AbstractOracleDriver implements Driver {
  public getDatabasePlatform(_versionProvider: ServerVersionProvider): OraclePlatform {
    return new OraclePlatform();
  }

  public getExceptionConverter(): DriverExceptionConverter {
    return new ExceptionConverter();
  }

  protected getEasyConnectString(params: Record<string, unknown>): string {
    return EasyConnectString.fromConnectionParameters(params).toString();
  }

  public abstract connect(params: Record<string, unknown>): ReturnType<Driver["connect"]>;
}
