import { KeywordList } from "./keyword-list";

export class EmptyKeywords extends KeywordList {
  protected getKeywords(): readonly string[] {
    return [];
  }
}
