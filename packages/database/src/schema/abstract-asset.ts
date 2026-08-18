import type { AbstractPlatform } from "../platforms/abstract-platform";

export abstract class AbstractAsset {
  protected _name = "";
  protected _namespace: string | null = null;
  protected _quoted = false;

  constructor(name: string) {
    this._setName(name);
  }

  protected _setName(name: string): void {
    this._quoted = this.isIdentifierQuoted(name);
    const normalized = this._quoted ? this.trimQuotes(name) : name;

    const parts = normalized.split(".");
    if (parts.length > 1) {
      this._namespace = parts[0] ?? null;
      this._name = parts.slice(1).join(".");
      return;
    }

    this._namespace = null;
    this._name = normalized;
  }

  protected getNameParser(): unknown {
    return null;
  }

  protected setName(_name: unknown): void {}

  public getName(): string {
    if (this._namespace === null) {
      return this._name;
    }

    return `${this._namespace}.${this._name}`;
  }

  public getNamespaceName(): string | null {
    return this._namespace;
  }

  public isInDefaultNamespace(defaultNamespaceName: string): boolean {
    return this._namespace === null || this._namespace === defaultNamespaceName;
  }

  public getShortestName(defaultNamespaceName: string | null): string {
    if (defaultNamespaceName !== null && this._namespace === defaultNamespaceName) {
      return this._name.toLowerCase();
    }

    return this.getName().toLowerCase();
  }

  public isQuoted(): boolean {
    return this._quoted;
  }

  protected isIdentifierQuoted(identifier: string): boolean {
    return identifier.startsWith("`") || identifier.startsWith('"') || identifier.startsWith("[");
  }

  protected trimQuotes(identifier: string): string {
    return identifier
      .replaceAll("`", "")
      .replaceAll('"', "")
      .replaceAll("[", "")
      .replaceAll("]", "");
  }

  public getQuotedName(platform: AbstractPlatform): string {
    const keywords = platform.getReservedKeywordsList();

    return this.getName()
      .split(".")
      .map((identifier) => {
        if (this._quoted || keywords.isKeyword(identifier)) {
          return platform.quoteSingleIdentifier(identifier);
        }

        return identifier;
      })
      .join(".");
  }

  protected _generateIdentifierName(
    columnNames: readonly string[],
    prefix = "",
    maxSize = 30,
  ): string {
    const hash = columnNames.map((columnName) => crc32Hex(columnName)).join("");

    return `${prefix}_${hash}`.slice(0, maxSize).toUpperCase();
  }
}

function crc32Hex(input: string): string {
  let crc = 0 ^ -1;

  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i) ?? 0;
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ code) & 0xff]!;
  }

  return ((crc ^ -1) >>> 0).toString(16);
}

const CRC32_TABLE = (() => {
  const table: number[] = [];

  for (let n = 0; n < 256; n += 1) {
    let c = n;

    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    table[n] = c >>> 0;
  }

  return table;
})();
