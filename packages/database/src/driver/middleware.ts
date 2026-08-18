import type { Driver } from "../driver";

export interface Middleware {
  wrap(driver: Driver): Driver;
}
