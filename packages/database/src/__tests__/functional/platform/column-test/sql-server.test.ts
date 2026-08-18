import { SQLServerPlatform } from "../../../../platforms/sqlserver-platform";
import { registerAbstractColumnTestCase } from "./abstract-column-test-case";

registerAbstractColumnTestCase({
  doctrineClassName: "SQLServer",
  platformClass: SQLServerPlatform,
  skippedDoctrineTests: new Set([
    "testVariableLengthStringNoLength",
    "testVariableLengthBinaryNoLength",
  ]),
});
