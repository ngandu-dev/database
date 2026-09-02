import { type Connection, type DriverName } from "@ngandu-dev/database";

export interface DatabaseServiceOptions {
  connection: Connection;
  defaultMaxRows: number;
  driver: DriverName;
}
