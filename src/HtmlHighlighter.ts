import { Highlighter } from "./Highlighter";
import { TokenType } from "./TokenType";

const LATIN1_NAMED_ENTITIES: Readonly<Record<string, string>> = {
  "©": "&copy;",
  "³": "&sup3;",
  À: "&Agrave;",
  Á: "&Aacute;",
  Â: "&Acirc;",
  Ã: "&Atilde;",
  Ä: "&Auml;",
  È: "&Egrave;",
  É: "&Eacute;",
  Ê: "&Ecirc;",
  Ë: "&Euml;",
  Ì: "&Igrave;",
  Í: "&Iacute;",
  Î: "&Icirc;",
  Ï: "&Iuml;",
  Ñ: "&Ntilde;",
  Ò: "&Ograve;",
  Ó: "&Oacute;",
  Ô: "&Ocirc;",
  Õ: "&Otilde;",
  Ö: "&Ouml;",
  Ù: "&Ugrave;",
  Ú: "&Uacute;",
  Û: "&Ucirc;",
  Ü: "&Uuml;",
  à: "&agrave;",
  á: "&aacute;",
  â: "&acirc;",
  ã: "&atilde;",
  ä: "&auml;",
  è: "&egrave;",
  é: "&eacute;",
  ê: "&ecirc;",
  ë: "&euml;",
  ì: "&igrave;",
  í: "&iacute;",
  î: "&icirc;",
  ï: "&iuml;",
  ñ: "&ntilde;",
  ò: "&ograve;",
  ó: "&oacute;",
  ô: "&ocirc;",
  õ: "&otilde;",
  ö: "&ouml;",
  ù: "&ugrave;",
  ú: "&uacute;",
  û: "&ucirc;",
  ü: "&uuml;",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replace(
      /[^\u0000-\u007F]/gu,
      (char) => LATIN1_NAMED_ENTITIES[char] ?? `&#${char.codePointAt(0)};`,
    );
}

export class HtmlHighlighter extends Highlighter {
  public static readonly HIGHLIGHT_PRE = "pre";

  private readonly htmlAttributes: Readonly<Record<string, string>>;
  private readonly usePre: boolean;

  public constructor(htmlAttributes: Partial<Record<string, string>> = {}, usePre = true) {
    super();
    this.usePre = usePre;
    this.htmlAttributes = {
      [Highlighter.HIGHLIGHT_QUOTE]: 'style="color: blue;"',
      [Highlighter.HIGHLIGHT_BACKTICK_QUOTE]: 'style="color: purple;"',
      [Highlighter.HIGHLIGHT_RESERVED]: 'style="font-weight:bold;"',
      [Highlighter.HIGHLIGHT_BOUNDARY]: "",
      [Highlighter.HIGHLIGHT_NUMBER]: 'style="color: green;"',
      [Highlighter.HIGHLIGHT_WORD]: 'style="color: #333;"',
      [Highlighter.HIGHLIGHT_ERROR]: 'style="background-color: red;"',
      [Highlighter.HIGHLIGHT_COMMENT]: 'style="color: #aaa;"',
      [Highlighter.HIGHLIGHT_VARIABLE]: 'style="color: orange;"',
      [HtmlHighlighter.HIGHLIGHT_PRE]: 'style="color: black; background-color: white;"',
      ...htmlAttributes,
    };
  }

  public highlightToken(type: TokenType, value: string): string {
    const escapedValue = escapeHtml(value);

    if (type === TokenType.BOUNDARY && (escapedValue === "(" || escapedValue === ")")) {
      return escapedValue;
    }

    const attributes = this.attributes(type);
    if (attributes === null) {
      return escapedValue;
    }

    return `<span ${attributes}>${escapedValue}</span>`;
  }

  public attributes(type: TokenType): string | null {
    const highlightType = Highlighter.TOKEN_TYPE_TO_HIGHLIGHT[type];
    if (highlightType === undefined) {
      return null;
    }

    return this.htmlAttributes[highlightType] ?? "";
  }

  public highlightError(value: string): string {
    return `\n<span ${this.htmlAttributes[Highlighter.HIGHLIGHT_ERROR]}>${value}</span>`;
  }

  public highlightErrorMessage(value: string): string {
    return this.highlightError(value);
  }

  public output(value: string): string {
    const trimmed = value.trim();
    if (!this.usePre) {
      return trimmed;
    }

    return `<pre ${this.htmlAttributes[HtmlHighlighter.HIGHLIGHT_PRE]}>${trimmed}</pre>`;
  }
}
