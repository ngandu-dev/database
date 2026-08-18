import { describe, expect, it } from "vitest";

import { DatabaseObjectExistsException } from "../../exception/database-object-exists-exception";
import { DatabaseObjectNotFoundException } from "../../exception/database-object-not-found-exception";
import { DriverRequired } from "../../exception/driver-required";
import { InvalidArgumentException } from "../../exception/invalid-argument-exception";
import { InvalidColumnDeclaration } from "../../exception/invalid-column-declaration";
import { InvalidColumnIndex } from "../../exception/invalid-column-index";
import { ColumnPrecisionRequired } from "../../exception/invalid-column-type/column-precision-required";
import { InvalidDriverClass } from "../../exception/invalid-driver-class";
import { InvalidWrapperClass } from "../../exception/invalid-wrapper-class";
import { NoKeyValue } from "../../exception/no-key-value";
import { ParseError } from "../../exception/parse-error";
import { SchemaDoesNotExist } from "../../exception/schema-does-not-exist";
import { ServerException } from "../../exception/server-exception";
import { UnknownDriver } from "../../exception/unknown-driver";
import { Exception as ParserException } from "../../sql/parser/exception";

describe("Top-level Doctrine exception parity", () => {
  it("provides doctrine-style argument exception names and factories", () => {
    expect(DriverRequired.new()).toBeInstanceOf(InvalidArgumentException);
    expect(DriverRequired.new().message).toContain(
      'The options "driver" or "driverClass" are mandatory',
    );
    expect(DriverRequired.new("localhost/db")).toBeInstanceOf(DriverRequired);

    expect(UnknownDriver.new("foo", ["mysql2", "pg"])).toBeInstanceOf(InvalidArgumentException);
    expect(UnknownDriver.new("foo", ["mysql2", "pg"]).message).toContain(
      'The given driver "foo" is unknown',
    );

    expect(InvalidDriverClass.new("X").message).toContain(
      "The given driver class X has to implement the Driver interface.",
    );
    expect(InvalidWrapperClass.new("Y").message).toContain(
      "The given wrapper class Y has to be a subtype of Connection.",
    );
  });

  it("provides doctrine-style data/result/parse exceptions", () => {
    expect(NoKeyValue.fromColumnCount(1).message).toBe(
      "Fetching as key-value pairs requires the result to contain at least 2 columns, 1 given.",
    );

    const invalidType = ColumnPrecisionRequired.new();
    const invalidColumnDeclaration = InvalidColumnDeclaration.fromInvalidColumnType(
      "price",
      invalidType,
    );

    expect(invalidColumnDeclaration.message).toBe('Column "price" has invalid type');
    expect((invalidColumnDeclaration as Error & { cause?: unknown }).cause).toBe(invalidType);

    const invalidColumnIndex = InvalidColumnIndex.new(3);
    expect(invalidColumnIndex.message).toBe('Invalid column index "3".');

    const parserException = new ParserException("parse failure");
    const parseError = ParseError.fromParserException(parserException);
    expect(parseError.message).toBe("Unable to parse query.");
    expect((parseError as Error & { cause?: unknown }).cause).toBe(parserException);
  });

  it("provides doctrine-style object existence hierarchy", () => {
    expect(
      new DatabaseObjectExistsException("exists", { driverName: "x", operation: "op" }),
    ).toBeInstanceOf(ServerException);
    expect(new SchemaDoesNotExist("missing", { driverName: "x", operation: "op" })).toBeInstanceOf(
      DatabaseObjectNotFoundException,
    );
  });
});
