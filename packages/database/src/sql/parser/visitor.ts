export interface Visitor {
  acceptPositionalParameter(sql: string): void;
  acceptNamedParameter(sql: string): void;
  acceptOther(sql: string): void;
  acceptEscapedQuestionMark?(sql: string): void;
}
