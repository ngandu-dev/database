export enum MatchType {
  FULL = "FULL",
  PARTIAL = "PARTIAL",
  SIMPLE = "SIMPLE",
}

export namespace MatchType {
  export function toSQL(matchType: MatchType): string {
    return matchType;
  }
}
