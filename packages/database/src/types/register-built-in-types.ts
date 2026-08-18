import { AsciiStringType } from "./ascii-string-type";
import { BigIntType } from "./big-int-type";
import { BinaryType } from "./binary-type";
import { BlobType } from "./blob-type";
import { BooleanType } from "./boolean-type";
import { DateImmutableType } from "./date-immutable-type";
import { DateIntervalType } from "./date-interval-type";
import { DateTimeImmutableType } from "./date-time-immutable-type";
import { DateTimeType } from "./date-time-type";
import { DateTimeTzImmutableType } from "./date-time-tz-immutable-type";
import { DateTimeTzType } from "./date-time-tz-type";
import { DateType } from "./date-type";
import { DecimalType } from "./decimal-type";
import { EnumType } from "./enum-type";
import { FloatType } from "./float-type";
import { GuidType } from "./guid-type";
import { IntegerType } from "./integer-type";
import { JsonType } from "./json-type";
import { JsonbType } from "./jsonb-type";
import { NumberType } from "./number-type";
import { SimpleArrayType } from "./simple-array-type";
import { SmallFloatType } from "./small-float-type";
import { SmallIntType } from "./small-int-type";
import { StringType } from "./string-type";
import { TextType } from "./text-type";
import { TimeImmutableType } from "./time-immutable-type";
import { TimeType } from "./time-type";
import { Type } from "./type";
import { Types } from "./types";

let builtinsRegistered = false;

export function registerBuiltInTypes(): void {
  if (builtinsRegistered) {
    return;
  }

  const registry = Type.getTypeRegistry();
  const builtins: Record<string, Type> = {
    [Types.ASCII_STRING]: new AsciiStringType(),
    [Types.BIGINT]: new BigIntType(),
    [Types.BINARY]: new BinaryType(),
    [Types.BLOB]: new BlobType(),
    [Types.BOOLEAN]: new BooleanType(),
    [Types.DATE_MUTABLE]: new DateType(),
    [Types.DATE_IMMUTABLE]: new DateImmutableType(),
    [Types.DATEINTERVAL]: new DateIntervalType(),
    [Types.DATETIME_MUTABLE]: new DateTimeType(),
    [Types.DATETIME_IMMUTABLE]: new DateTimeImmutableType(),
    [Types.DATETIMETZ_MUTABLE]: new DateTimeTzType(),
    [Types.DATETIMETZ_IMMUTABLE]: new DateTimeTzImmutableType(),
    [Types.DECIMAL]: new DecimalType(),
    [Types.NUMBER]: new NumberType(),
    [Types.ENUM]: new EnumType(),
    [Types.FLOAT]: new FloatType(),
    [Types.GUID]: new GuidType(),
    [Types.INTEGER]: new IntegerType(),
    [Types.JSON]: new JsonType(),
    [Types.JSON_OBJECT]: new JsonType(),
    [Types.JSONB]: new JsonbType(),
    [Types.JSONB_OBJECT]: new JsonbType(),
    [Types.SIMPLE_ARRAY]: new SimpleArrayType(),
    [Types.SMALLFLOAT]: new SmallFloatType(),
    [Types.SMALLINT]: new SmallIntType(),
    [Types.STRING]: new StringType(),
    [Types.TEXT]: new TextType(),
    [Types.TIME_MUTABLE]: new TimeType(),
    [Types.TIME_IMMUTABLE]: new TimeImmutableType(),
  };

  for (const [name, type] of Object.entries(builtins)) {
    if (!registry.has(name)) {
      registry.register(name, type);
    }
  }

  builtinsRegistered = true;
}
