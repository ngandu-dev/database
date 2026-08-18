export enum UnquotedIdentifierFolding {
  UPPER = "upper",
  LOWER = "lower",
  NONE = "none",
}

function foldUnquotedIdentifierValue(folding: UnquotedIdentifierFolding, value: string): string {
  switch (folding) {
    case UnquotedIdentifierFolding.UPPER:
      return value.toUpperCase();
    case UnquotedIdentifierFolding.LOWER:
      return value.toLowerCase();
    case UnquotedIdentifierFolding.NONE:
      return value;
  }
}

export function foldUnquotedIdentifier(folding: UnquotedIdentifierFolding, value: string): string {
  return foldUnquotedIdentifierValue(folding, value);
}

export namespace UnquotedIdentifierFolding {
  export function foldUnquotedIdentifier(
    folding: UnquotedIdentifierFolding,
    value: string,
  ): string {
    return foldUnquotedIdentifierValue(folding, value);
  }
}
