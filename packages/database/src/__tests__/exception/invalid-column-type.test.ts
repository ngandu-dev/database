import { describe, expect, it } from "vitest";

import { InvalidColumnType } from "../../exception/invalid-column-type";
import { ColumnLengthRequired } from "../../exception/invalid-column-type/column-length-required";
import { ColumnPrecisionRequired } from "../../exception/invalid-column-type/column-precision-required";
import { ColumnScaleRequired } from "../../exception/invalid-column-type/column-scale-required";
import { ColumnValuesRequired } from "../../exception/invalid-column-type/column-values-required";
import { MySQLPlatform } from "../../platforms/mysql-platform";

describe("InvalidColumnType exceptions", () => {
  it("provides doctrine-style length and values factory messages", () => {
    const platform = new MySQLPlatform();

    expect(ColumnLengthRequired.new(platform, "varchar")).toBeInstanceOf(InvalidColumnType);
    expect(ColumnLengthRequired.new(platform, "varchar").message).toBe(
      "MySQLPlatform requires the length of a varchar column to be specified",
    );

    expect(ColumnValuesRequired.new(platform, "enum")).toBeInstanceOf(InvalidColumnType);
    expect(ColumnValuesRequired.new(platform, "enum").message).toBe(
      "MySQLPlatform requires the values of a enum column to be specified",
    );
  });

  it("provides doctrine-style precision and scale factory messages", () => {
    expect(ColumnPrecisionRequired.new()).toBeInstanceOf(InvalidColumnType);
    expect(ColumnPrecisionRequired.new()).toBeInstanceOf(Error);
    expect(ColumnPrecisionRequired.new().message).toBe("Column precision is not specified");

    expect(ColumnScaleRequired.new()).toBeInstanceOf(InvalidColumnType);
    expect(ColumnScaleRequired.new().message).toBe("Column scale is not specified");
  });
});
