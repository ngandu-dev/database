export interface ObjectSet<TObject> extends Iterable<TObject> {
  add(object: TObject): this;
  isEmpty(): boolean;
  get(name: string | { toString(): string }): TObject | null;
  remove(name: string | { toString(): string }): void;
  modify(name: string | { toString(): string }, modification: (object: TObject) => TObject): void;
  hasByName(name: string): boolean;
  getByName(name: string): TObject;
  removeByName(name: string): void;
  clear(): void;
  toList(): TObject[];
  toArray(): TObject[];
  getIterator(): Iterator<TObject>;
}
