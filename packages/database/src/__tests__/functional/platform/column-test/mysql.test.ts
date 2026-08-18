import { AbstractMySQLPlatform } from "../../../../platforms/abstract-mysql-platform";
import { registerAbstractColumnTestCase } from "./abstract-column-test-case";

registerAbstractColumnTestCase({
  doctrineClassName: "MySQL",
  platformClass: AbstractMySQLPlatform,
  skippedDoctrineTests: new Set([
    "testVariableLengthStringNoLength",
    "testVariableLengthBinaryNoLength",
  ]),
});
