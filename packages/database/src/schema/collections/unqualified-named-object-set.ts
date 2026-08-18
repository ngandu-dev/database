import { ObjectAlreadyExists } from "./exception/object-already-exists";
import { ObjectDoesNotExist } from "./exception/object-does-not-exist";
import { ObjectSet } from "./object-set";

export class UnqualifiedNamedObjectSet<TObject extends object> implements ObjectSet<TObject> {
  private readonly values = new Map<string, TObject>();

  constructor(...objects: TObject[]) {
    for (const object of objects) {
      this.add(object);
    }
  }

  public add(object: TObject): this {
    const objectName = getObjectName(object);
    const key = normalizeName(objectName);
    if (this.values.has(key)) {
      throw ObjectAlreadyExists.new(objectName);
    }

    this.values.set(key, object);
    return this;
  }

  public hasByName(name: string): boolean {
    return this.values.has(this.getKey(name));
  }

  public getByName(name: string): TObject {
    const object = this.values.get(this.getKey(name));
    if (object === undefined) {
      throw ObjectDoesNotExist.new(name);
    }

    return object;
  }

  public removeByName(name: string): void {
    const key = this.getKey(name);
    if (!this.values.delete(key)) {
      throw ObjectDoesNotExist.new(name);
    }
  }

  public isEmpty(): boolean {
    return this.values.size === 0;
  }

  public get(name: string | { toString(): string }): TObject | null {
    return this.values.get(this.getKey(name)) ?? null;
  }

  public remove(name: string | { toString(): string }): void {
    this.removeByName(String(name));
  }

  public modify(
    name: string | { toString(): string },
    modification: (object: TObject) => TObject,
  ): void {
    const oldKey = this.getKey(name);
    const object = this.values.get(oldKey);

    if (object === undefined) {
      throw ObjectDoesNotExist.new(String(name));
    }

    this.replace(oldKey, modification(object));
  }

  public clear(): void {
    this.values.clear();
  }

  public toArray(): TObject[] {
    return [...this.values.values()];
  }

  public toList(): TObject[] {
    return this.toArray();
  }

  public [Symbol.iterator](): Iterator<TObject> {
    return this.getIterator();
  }

  public getIterator(): Iterator<TObject> {
    return this.values.values();
  }

  private replace(oldKey: string, object: TObject): void {
    const objectName = getObjectName(object);
    const newKey = this.getKey(objectName);

    if (newKey === oldKey) {
      this.values.set(oldKey, object);
      return;
    }

    if (this.values.has(newKey)) {
      throw ObjectAlreadyExists.new(objectName);
    }

    const entries = [...this.values.entries()];
    const index = entries.findIndex(([key]) => key === oldKey);

    if (index === -1) {
      throw ObjectDoesNotExist.new(oldKey);
    }

    entries[index] = [newKey, object];
    this.values.clear();
    for (const [key, value] of entries) {
      this.values.set(key, value);
    }
  }

  private getKey(name: string | { toString(): string }): string {
    return normalizeName(String(name));
  }
}

function normalizeName(name: string): string {
  return name.toLowerCase();
}

function getObjectName(object: object): string {
  const candidate = object as {
    getObjectName?: () => unknown;
    getName?: () => unknown;
  };

  if (typeof candidate.getObjectName === "function") {
    return String(candidate.getObjectName());
  }

  if (typeof candidate.getName === "function") {
    return String(candidate.getName());
  }

  throw new TypeError("UnqualifiedNamedObjectSet items must expose getObjectName() or getName().");
}
