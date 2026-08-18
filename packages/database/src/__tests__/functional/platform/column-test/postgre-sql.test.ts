import { PostgreSQLPlatform } from "../../../../platforms/postgresql-platform";
import { registerAbstractColumnTestCase } from "./abstract-column-test-case";

registerAbstractColumnTestCase({
  doctrineClassName: "PostgreSQL",
  platformClass: PostgreSQLPlatform,
});
