export class DataSourceName {
  private constructor(private readonly value: string) {}

  public toString(): string {
    return this.value;
  }

  public static fromArray(params: Record<string, unknown>): DataSourceName {
    const chunks: string[] = [];

    for (const [key, value] of Object.entries(params)) {
      chunks.push(`${key}=${String(value)}`);
    }

    return new DataSourceName(chunks.join(";"));
  }

  public static fromConnectionParameters(params: Record<string, unknown>): DataSourceName {
    const dbName = params.dbname;
    if (typeof dbName === "string" && dbName.includes("=")) {
      return new DataSourceName(dbName);
    }

    const dsnParams: Record<string, unknown> = {};

    for (const [dbalParam, dsnParam] of [
      ["host", "HOSTNAME"],
      ["port", "PORT"],
      ["protocol", "PROTOCOL"],
      ["dbname", "DATABASE"],
      ["user", "UID"],
      ["password", "PWD"],
    ] as const) {
      if (params[dbalParam] === undefined) {
        continue;
      }

      dsnParams[dsnParam] = params[dbalParam];
    }

    return DataSourceName.fromArray(dsnParams);
  }
}
