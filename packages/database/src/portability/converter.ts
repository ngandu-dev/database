import { ColumnCase } from "../column-case";

type AssociativeRow = Record<string, unknown>;
type NumericRow = unknown[];
type ConvertibleRow = AssociativeRow | NumericRow;

type ValueConverter = (value: unknown) => unknown;

export class Converter {
  private readonly convertNumericFn: (row: NumericRow | undefined) => NumericRow | undefined;
  private readonly convertAssociativeFn: (
    row: AssociativeRow | undefined,
  ) => AssociativeRow | undefined;
  private readonly convertOneFn: (value: unknown) => unknown;
  private readonly convertAllNumericFn: (rows: NumericRow[]) => NumericRow[];
  private readonly convertAllAssociativeFn: (rows: AssociativeRow[]) => AssociativeRow[];
  private readonly convertFirstColumnFn: (values: unknown[]) => unknown[];
  private readonly convertColumnNameFn: (name: string) => string;

  public constructor(
    private readonly emptyStringToNullEnabled: boolean,
    private readonly rightTrimStringEnabled: boolean,
    private readonly columnCase: ColumnCase | null,
  ) {
    const convertValue = this.createConvertValue(
      this.emptyStringToNullEnabled,
      this.rightTrimStringEnabled,
    );
    const convertNumericRow = this.createConvertRow<NumericRow>(convertValue, null);
    const convertAssociativeRow = this.createConvertRow<AssociativeRow>(
      convertValue,
      this.columnCase,
    );

    this.convertNumericFn = this.createConvert<NumericRow>(convertNumericRow);
    this.convertAssociativeFn = this.createConvert<AssociativeRow>(convertAssociativeRow);
    this.convertOneFn = this.createConvert<unknown>(convertValue);

    this.convertAllNumericFn = this.createConvertAll<NumericRow>(convertNumericRow);
    this.convertAllAssociativeFn = this.createConvertAll<AssociativeRow>(convertAssociativeRow);
    this.convertFirstColumnFn = this.createConvertAll<unknown>(convertValue);

    this.convertColumnNameFn =
      this.columnCase === ColumnCase.LOWER
        ? (name) => name.toLowerCase()
        : this.columnCase === ColumnCase.UPPER
          ? (name) => name.toUpperCase()
          : (name) => name;
  }

  public convertNumeric<T = unknown>(row: T[] | undefined): T[] | undefined {
    return this.convertNumericFn(row as NumericRow | undefined) as T[] | undefined;
  }

  public convertAssociative<T extends AssociativeRow = AssociativeRow>(
    row: T | undefined,
  ): T | undefined {
    return this.convertAssociativeFn(row as AssociativeRow | undefined) as T | undefined;
  }

  public convertOne<T = unknown>(value: T): T {
    return this.convertOneFn(value) as T;
  }

  public convertAllNumeric<T = unknown>(rows: T[][]): T[][] {
    return this.convertAllNumericFn(rows as NumericRow[]) as T[][];
  }

  public convertAllAssociative<T extends AssociativeRow = AssociativeRow>(rows: T[]): T[] {
    return this.convertAllAssociativeFn(rows as AssociativeRow[]) as T[];
  }

  public convertFirstColumn<T = unknown>(values: T[]): T[] {
    return this.convertFirstColumnFn(values as unknown[]) as T[];
  }

  public convertRow(row: AssociativeRow): AssociativeRow {
    return (this.convertAssociative(row) ?? row) as AssociativeRow;
  }

  public convertColumnName(name: string): string {
    return this.convertColumnNameFn(name);
  }

  public convertValue(value: unknown): unknown {
    return this.convertOne(value);
  }

  private static id<T>(value: T): T {
    return value;
  }

  private static convertEmptyStringToNull<T>(value: T): T | null {
    if (value === "") {
      return null;
    }

    return value;
  }

  private static rightTrimString<T>(value: T): T | string {
    if (typeof value !== "string") {
      return value;
    }

    return value.trimEnd();
  }

  private createConvertValue(
    convertEmptyStringToNull: boolean,
    rightTrimString: boolean,
  ): ValueConverter | null {
    const functions: ValueConverter[] = [];

    if (convertEmptyStringToNull) {
      functions.push((value) => Converter.convertEmptyStringToNull(value));
    }

    if (rightTrimString) {
      functions.push((value) => Converter.rightTrimString(value));
    }

    return this.compose(...functions);
  }

  private createConvertRow(
    function_: ValueConverter | null,
    caseMode: ColumnCase | null,
  ): ((row: ConvertibleRow) => ConvertibleRow) | null;
  private createConvertRow<T extends ConvertibleRow>(
    function_: ValueConverter | null,
    caseMode: ColumnCase | null,
  ): ((row: T) => T) | null;
  private createConvertRow<T extends ConvertibleRow>(
    function_: ValueConverter | null,
    caseMode: ColumnCase | null,
  ): ((row: T) => T) | null {
    const functions: Array<(row: ConvertibleRow) => ConvertibleRow> = [];

    if (function_ !== null) {
      functions.push(this.createMapper(function_));
    }

    if (caseMode !== null) {
      functions.push((row) => {
        if (Array.isArray(row)) {
          return row;
        }

        const converted: AssociativeRow = {};
        for (const [key, value] of Object.entries(row)) {
          const nextKey = caseMode === ColumnCase.LOWER ? key.toLowerCase() : key.toUpperCase();
          converted[nextKey] = value;
        }

        return converted;
      });
    }

    return this.compose<ConvertibleRow>(...functions) as ((row: T) => T) | null;
  }

  private createConvert<T>(
    function_: ((value: T) => T) | null,
  ): (value: T | undefined) => T | undefined {
    if (function_ === null) {
      return Converter.id as (value: T | undefined) => T | undefined;
    }

    return (value: T | undefined): T | undefined => {
      if (value === undefined) {
        return undefined;
      }

      return function_(value as T);
    };
  }

  private createConvertAll<T>(function_: ((value: T) => T) | null): (values: T[]) => T[] {
    if (function_ === null) {
      return Converter.id as (values: T[]) => T[];
    }

    return this.createMapper<T[]>(function_ as ValueConverter);
  }

  private createMapper<T extends ConvertibleRow | unknown[]>(
    function_: ValueConverter,
  ): (value: T) => T {
    return (value) => {
      if (Array.isArray(value)) {
        return value.map((item) => function_(item)) as T;
      }

      const converted: AssociativeRow = {};
      for (const [key, item] of Object.entries(value)) {
        converted[key] = function_(item);
      }

      return converted as T;
    };
  }

  private compose<T>(...functions: Array<(value: T) => T>): ((value: T) => T) | null {
    if (functions.length === 0) {
      return null;
    }

    return functions.reduce<(value: T) => T>(
      (carry, item) => (value: T) => item(carry(value)),
      Converter.id,
    );
  }
}
