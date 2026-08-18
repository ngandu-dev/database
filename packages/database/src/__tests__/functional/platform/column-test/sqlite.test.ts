import { SQLitePlatform } from "../../../../platforms/sqlite-platform";
import { registerAbstractColumnTestCase } from "./abstract-column-test-case";

registerAbstractColumnTestCase({
  doctrineClassName: "SQLite",
  platformClass: SQLitePlatform,
});
