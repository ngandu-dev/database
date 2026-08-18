import type { DriverException } from "../../exception/driver-exception";
import type { Query } from "../../query";

export interface ExceptionConverterContext {
  operation: string;
  query?: Query;
}

export interface ExceptionConverter {
  convert(error: unknown, context: ExceptionConverterContext): DriverException;
}
