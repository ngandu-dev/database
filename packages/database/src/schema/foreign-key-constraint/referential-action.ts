export enum ReferentialAction {
  CASCADE = "CASCADE",
  NO_ACTION = "NO ACTION",
  SET_DEFAULT = "SET DEFAULT",
  SET_NULL = "SET NULL",
  RESTRICT = "RESTRICT",
}

export namespace ReferentialAction {
  export function toSQL(referentialAction: ReferentialAction): string {
    return referentialAction;
  }
}
