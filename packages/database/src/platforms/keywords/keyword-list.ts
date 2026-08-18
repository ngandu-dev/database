export abstract class KeywordList {
  private keywords: Set<string> | null = null;

  public isKeyword(word: string): boolean {
    if (this.keywords === null) {
      this.initializeKeywords();
    }

    const keywords = this.keywords;
    if (keywords === null) {
      return false;
    }

    return keywords.has(word.toUpperCase());
  }

  protected initializeKeywords(): void {
    this.keywords = new Set(this.getKeywords().map((keyword) => keyword.toUpperCase()));
  }

  protected abstract getKeywords(): readonly string[];
}
