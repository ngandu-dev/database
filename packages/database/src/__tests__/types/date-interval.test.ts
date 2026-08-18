import { describe, expect, it } from "vitest";

import { ParameterType } from "../../parameter-type";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import { ConversionException } from "../../types/conversion-exception";
import { DateIntervalType } from "../../types/date-interval-type";

describe("DateIntervalType parity (Node-adapted)", () => {
  it("exposes the interval format constant", () => {
    expect(DateIntervalType.FORMAT).toBe("%RP%YY%MM%DDT%HH%IM%SS");
  });

  it("uses string binding semantics via default type binding", () => {
    expect(new DateIntervalType().getBindingType()).toBe(ParameterType.STRING);
  });

  it("converts interval strings to/from database values in the current Node implementation", () => {
    const type = new DateIntervalType();
    const platform = new MySQLPlatform();
    const interval = "+P02Y00M01DT01H02M03S";

    expect(type.convertToDatabaseValue(interval, platform)).toBe(interval);
    expect(type.convertToNodeValue(interval, platform)).toBe(interval);
  });

  it("converts null to null", () => {
    const type = new DateIntervalType();
    const platform = new MySQLPlatform();

    expect(type.convertToDatabaseValue(null, platform)).toBeNull();
    expect(type.convertToNodeValue(null, platform)).toBeNull();
  });

  it("rejects invalid node values for database conversion", () => {
    const type = new DateIntervalType();
    const platform = new MySQLPlatform();

    for (const value of [0, {}, [], new Date()]) {
      expect(() => type.convertToDatabaseValue(value, platform)).toThrow(ConversionException);
    }
  });

  it.skip(
    "converts JS interval objects to Doctrine-formatted strings (Node has no native DateInterval equivalent)",
  );
  it.skip(
    "converts Doctrine-formatted interval strings into a DateInterval-like object (not implemented in current Node port)",
  );
  it.skip(
    "rejects empty-string database interval input like Doctrine (current Node port treats interval strings as passthrough)",
  );
});
