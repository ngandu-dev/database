export interface Exception extends Error {
  getSQLState(): string | null;
}
