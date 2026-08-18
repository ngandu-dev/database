import { CliHighlighter } from "./CliHighlighter";
import { HtmlHighlighter } from "./HtmlHighlighter";
import { NullHighlighter } from "./NullHighlighter";
import { SqlFormatter } from "./SqlFormatter";

export { CliHighlighter } from "./CliHighlighter";
export { Cursor } from "./Cursor";
export { Highlighter } from "./Highlighter";
export { HtmlHighlighter } from "./HtmlHighlighter";
export { NullHighlighter } from "./NullHighlighter";
export { SqlFormatter } from "./SqlFormatter";
export { Token } from "./Token";
export { Tokenizer } from "./Tokenizer";
export { TokenType } from "./TokenType";

export type Mode = "format" | "highlight" | "compress";
export type Highlight = "html" | "cli";

export function format(sql: string, indentString = "  "): string {
  return new SqlFormatter(new NullHighlighter()).format(sql, indentString);
}

export function highlight(sql: string, mode: Highlight = "cli", usePre = true): string {
  const highlighter = mode === "html" ? new HtmlHighlighter({}, usePre) : new CliHighlighter();
  return new SqlFormatter(highlighter).highlight(sql);
}

export function compress(sql: string): string {
  return new SqlFormatter(new NullHighlighter()).compress(sql);
}
