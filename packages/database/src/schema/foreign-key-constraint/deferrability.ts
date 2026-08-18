export enum Deferrability {
  NOT_DEFERRABLE = "NOT DEFERRABLE",
  DEFERRABLE = "DEFERRABLE",
  DEFERRED = "INITIALLY DEFERRED",
}

export namespace Deferrability {
  export function toSQL(deferrability: Deferrability): string {
    return deferrability;
  }
}
