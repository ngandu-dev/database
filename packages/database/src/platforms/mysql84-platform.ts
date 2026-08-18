import type { KeywordList } from "./keywords/keyword-list";
import { MySQL84Keywords } from "./keywords/mysql84-keywords";
import { MySQL80Platform } from "./mysql80-platform";

export class MySQL84Platform extends MySQL80Platform {
  protected override createReservedKeywordsList(): KeywordList {
    return new MySQL84Keywords();
  }
}
