import type { ExceptionConverter } from "./driver/api/exception-converter";
import type { Connection as DriverConnection } from "./driver/connection";
import type { AbstractPlatform } from "./platforms/abstract-platform";
import type { ServerVersionProvider } from "./server-version-provider";

export interface Driver {
  connect(params: Record<string, unknown>): Promise<DriverConnection>;
  getExceptionConverter(): ExceptionConverter;
  getDatabasePlatform(
    versionProvider: ServerVersionProvider,
  ): AbstractPlatform | Promise<AbstractPlatform>;
}
