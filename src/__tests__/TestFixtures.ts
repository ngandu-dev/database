import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FIXTURES_DIR = fileURLToPath(new URL("./fixtures/", import.meta.url));

function readFixture(name: string): string {
  return readFileSync(`${FIXTURES_DIR}${name}`, "utf8");
}

function splitSections(contents: string): string[] {
  const normalized = contents.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized.replace(/\n$/u, "").split("\n---\n");
}

export function fileSqlData(): string[] {
  return splitSections(readFixture("sql.sql"));
}

export function fileDataPairs(fileName: string): Array<[string, string]> {
  const sqlData = fileSqlData();
  const outputData = splitSections(readFixture(fileName));

  if (sqlData.length !== outputData.length) {
    throw new Error(
      `"${fileName}" (${outputData.length} sections) and sql.sql (${sqlData.length} sections) should have the same number of sections`,
    );
  }

  return outputData.map((output, index) => [sqlData[index] ?? "", output] as [string, string]);
}
