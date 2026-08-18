import type { Middleware as DriverMiddleware } from "../driver/middleware";
import { Driver } from "./driver";
import type { Logger } from "./logger";
import { ConsoleLogger } from "./logger";

export class Middleware implements DriverMiddleware {
  constructor(private readonly logger: Logger = new ConsoleLogger()) {}

  public wrap(driver: Driver): Driver {
    return new Driver(driver, this.logger);
  }
}
