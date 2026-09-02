import { describe, expect, test } from "vitest";

import { CliHighlighter } from "../CliHighlighter";
import { HtmlHighlighter } from "../HtmlHighlighter";
import { NullHighlighter } from "../NullHighlighter";
import { SqlFormatter } from "../SqlFormatter";
import { fileDataPairs } from "./TestFixtures";

describe("SqlFormatter", () => {
  const htmlFormatter = new SqlFormatter(new HtmlHighlighter());

  test.each(fileDataPairs("format-highlight.txt"))(
    "format + highlight fixtures %#",
    (sql: string, html: string) => {
      expect(htmlFormatter.format(sql)).toBe(html);
    },
  );

  test.each(fileDataPairs("format.txt"))("format fixtures %#", (sql: string, formatted: string) => {
    const formatter = new SqlFormatter(new NullHighlighter());
    expect(formatter.format(sql)).toBe(formatted);
  });

  test.each(fileDataPairs("highlight.txt"))(
    "highlight fixtures %#",
    (sql: string, html: string) => {
      expect(htmlFormatter.highlight(sql)).toBe(html);
    },
  );

  test.each(fileDataPairs("clihighlight.txt"))(
    "cli highlight fixtures %#",
    (sql: string, ansiText: string) => {
      const formatter = new SqlFormatter(new CliHighlighter());
      expect(formatter.format(sql)).toBe(`${ansiText}\n`);
    },
  );

  test.each(fileDataPairs("compress.txt"))(
    "compress fixtures %#",
    (sql: string, compressed: string) => {
      expect(htmlFormatter.compress(sql)).toBe(compressed);
    },
  );

  test("usePre option", () => {
    const noPreFormatter = new SqlFormatter(new HtmlHighlighter({}, false));
    expect(noPreFormatter.highlight("test")).toBe('<span style="color: #333;">test</span>');

    const preFormatter = new SqlFormatter(new HtmlHighlighter({}, true));
    expect(preFormatter.highlight("test")).toBe(
      '<pre style="color: black; background-color: white;"><span style="color: #333;">test</span></pre>',
    );
  });

  test("format long concat", () => {
    const parts: string[] = [];
    for (let i = 0; i < 2_000; i += 1) {
      parts.push(`cast('foo${i}' as blob)`);
    }

    const inConcat = `concat(${parts.join(", ")})`;
    const outConcat = `concat(\n      ${parts.join(",\n      ")}\n    )`;

    const formatter = new SqlFormatter(new NullHighlighter());
    expect(formatter.format(`select iif(${inConcat} = ${inConcat}, 10, 20) x`)).toBe(
      `select\n  iif(\n    ${outConcat} = ${outConcat},\n    10,\n    20\n  ) x`,
    );
  });
});
