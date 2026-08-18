import { describe, expect, it } from "vitest";

import { ConversionException } from "../../types/conversion-exception";
import { DateTimeTzType } from "../../types/date-time-tz-type";
import {
  createPlatformWithFormat,
  runBaseDateTypeParitySuite,
} from "./_helpers/base-date-type-parity";

describe("DateTimeTzType parity", () => {
  runBaseDateTypeParitySuite({
    createType: () => new DateTimeTzType(),
    formatMethod: "getDateTimeTzFormatString",
    format: "Y-m-d H:i:s",
    label: "DateTimeTzType",
  });

  it("converts Date to database value using timezone-aware pattern support (Node-adapted P token)", () => {
    const value = new DateTimeTzType().convertToDatabaseValue(
      new Date(),
      createPlatformWithFormat("getDateTimeTzFormatString", "Y-m-d H:i:s P"),
    );

    expect(value).toBeTypeOf("string");
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{2}:\d{2}$/);
  });

  it("converts datetime strings to Date values", () => {
    const date = new DateTimeTzType().convertToNodeValue(
      "1985-09-01 00:00:00",
      createPlatformWithFormat("getDateTimeTzFormatString", "Y-m-d H:i:s"),
    );

    expect(date).toBeInstanceOf(Date);
  });

  it("throws on invalid datetime conversion", () => {
    expect(() =>
      new DateTimeTzType().convertToNodeValue(
        "abcdefg",
        createPlatformWithFormat("getDateTimeTzFormatString", "Y-m-d H:i:s"),
      ),
    ).toThrow(ConversionException);
  });
});
