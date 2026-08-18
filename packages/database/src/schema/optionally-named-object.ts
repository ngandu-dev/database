export interface OptionallyNamedObject<TName = string> {
  getObjectName(): TName | null;
}
