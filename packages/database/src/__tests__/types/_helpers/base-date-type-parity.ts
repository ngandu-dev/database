import { expect, it, vi } from "vitest";

import { MySQLPlatform } from "../../../platforms/mysql-platform";
import type { Type } from "../../../types/type";

export const invalidTemporalNodeValues: unknown[] = [
  0,
  "",
  "foo",
  "10:11:12",
  "2015-01-31",
  "2015-01-31 10:11:12",
  {},
  27,
  -1,
  1.2,
  [],
  ["an array"],
];

export function createPlatformWithFormat(
  method:
    | "getDateFormatString"
    | "getDateTimeFormatString"
    | "getDateTimeTzFormatString"
    | "getTimeFormatString",
  format: string,
): MySQLPlatform {
  const platform = new MySQLPlatform();
  vi.spyOn(platform, method).mockReturnValue(format);
  return platform;
}

export function runBaseDateTypeParitySuite(config: {
  createType: () => Type;
  formatMethod:
    | "getDateFormatString"
    | "getDateTimeFormatString"
    | "getDateTimeTzFormatString"
    | "getTimeFormatString";
  format: string;
  label: string;
}): void {
  it(`${config.label}: converts Date to database string`, () => {
    const type = config.createType();
    const platform = createPlatformWithFormat(config.formatMethod, config.format);

    expect(type.convertToDatabaseValue(new Date(), platform)).toBeTypeOf("string");
  });

  it.each(invalidTemporalNodeValues)(`${config.label}: rejects invalid node value %p`, (value) => {
    const type = config.createType();
    const platform = createPlatformWithFormat(config.formatMethod, config.format);

    expect(() => type.convertToDatabaseValue(value, platform)).toThrow();
  });

  it(`${config.label}: converts null database value to null`, () => {
    const type = config.createType();
    const platform = createPlatformWithFormat(config.formatMethod, config.format);

    expect(type.convertToNodeValue(null, platform)).toBeNull();
  });

  it(`${config.label}: passes Date instances through from database conversion`, () => {
    const type = config.createType();
    const platform = createPlatformWithFormat(config.formatMethod, config.format);
    const date = new Date();

    expect(type.convertToNodeValue(date, platform)).toBe(date);
  });
}
