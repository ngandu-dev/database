import { type Connection, type DriverName } from "@ngandu-dev/database";

export interface OwnedDatabaseConnection {
  connection: Connection;
  driver: DriverName;
}
