import { describe, expect, it } from "vitest";

import { ConversionException } from "../../types/conversion-exception";
import { VarDateTimeType } from "../../types/var-date-time-type";
import { createPlatformWithFormat } from "./_helpers/base-date-type-parity";

describe("VarDateTimeType parity", () => {
  it("converts Date values to database strings", () => {
    const type = new VarDateTimeType();
    const platform = createPlatformWithFormat("getDateTimeFormatString", "Y-m-d H:i:s");

    expect(type.convertToDatabaseValue(new Date(1985, 8, 1, 10, 10, 10), platform)).toBeTypeOf(
      "string",
    );
  });

  it("converts datetime strings to Date values", () => {
    const date = new VarDateTimeType().convertToNodeValue(
      "1985-09-01 00:00:00",
      createPlatformWithFormat("getDateTimeFormatString", "Y-m-d H:i:s"),
    );

    expect(date).toBeInstanceOf(Date);
    expect(date?.getMilliseconds()).toBe(0);
  });

  it("throws on invalid datetime format conversion", () => {
    expect(() =>
      new VarDateTimeType().convertToNodeValue(
        "abcdefg",
        createPlatformWithFormat("getDateTimeFormatString", "Y-m-d H:i:s"),
      ),
    ).toThrow(ConversionException);
  });

  it("parses microseconds with JS millisecond precision", () => {
    const date = new VarDateTimeType().convertToNodeValue(
      "1985-09-01 00:00:00.123456",
      createPlatformWithFormat("getDateTimeFormatString", "Y-m-d H:i:s"),
    );

    expect(date).toBeInstanceOf(Date);
    expect(date?.getMilliseconds()).toBe(123);
  });

  it("converts null and passes Date instances through", () => {
    const type = new VarDateTimeType();
    const platform = createPlatformWithFormat("getDateTimeFormatString", "Y-m-d H:i:s");
    const now = new Date();

    expect(type.convertToNodeValue(null, platform)).toBeNull();
    expect(type.convertToNodeValue(now, platform)).toBe(now);
  });
});
