import { ObjectAlreadyExists } from "./exception/object-already-exists";
import { ObjectDoesNotExist } from "./exception/object-does-not-exist";
import { ObjectSet } from "./object-set";

export class OptionallyUnqualifiedNamedObjectSet<TObject extends { getObjectName(): string | null }>
  implements ObjectSet<TObject>
{
  private readonly values: TObject[] = [];

  constructor(...objects: TObject[]) {
    for (const object of objects) {
      this.add(object);
    }
  }

  public add(object: TObject): this {
    const name = object.getObjectName();

    if (name !== null && this.findIndexByName(name) >= 0) {
      throw ObjectAlreadyExists.new(name);
    }

    this.values.push(object);
    return this;
  }

  public hasByName(name: string): boolean {
    return this.findIndexByName(name) >= 0;
  }

  public getByName(name: string): TObject {
    const index = this.findIndexByName(name);
    if (index < 0) {
      throw ObjectDoesNotExist.new(name);
    }

    const object = this.values[index];
    if (object === undefined) {
      throw ObjectDoesNotExist.new(name);
    }

    return object;
  }

  public removeByName(name: string): void {
    const index = this.findIndexByName(name);
    if (index < 0) {
      throw ObjectDoesNotExist.new(name);
    }

    this.values.splice(index, 1);
  }

  public isEmpty(): boolean {
    return this.values.length === 0;
  }

  public get(name: string | { toString(): string }): TObject | null {
    const index = this.findIndexByName(String(name));
    return index >= 0 ? (this.values[index] ?? null) : null;
  }

  public remove(name: string | { toString(): string }): void {
    this.removeByName(String(name));
  }

  public modify(
    name: string | { toString(): string },
    modification: (object: TObject) => TObject,
  ): void {
    const oldName = String(name);
    const index = this.findIndexByName(oldName);

    if (index < 0) {
      throw ObjectDoesNotExist.new(oldName);
    }

    const current = this.values[index];
    if (current === undefined) {
      throw ObjectDoesNotExist.new(oldName);
    }

    const next = modification(current);
    const nextName = next.getObjectName();

    if (
      nextName !== null &&
      this.values.some(
        (candidate, candidateIndex) =>
          candidateIndex !== index &&
          candidate.getObjectName() !== null &&
          this.getKey(candidate.getObjectName() ?? "") === this.getKey(nextName),
      )
    ) {
      throw ObjectAlreadyExists.new(nextName);
    }

    this.values[index] = next;
  }

  public clear(): void {
    this.values.length = 0;
  }

  public toArray(): TObject[] {
    return [...this.values];
  }

  public toList(): TObject[] {
    return this.toArray();
  }

  public [Symbol.iterator](): Iterator<TObject> {
    return this.getIterator();
  }

  public getIterator(): Iterator<TObject> {
    return this.values[Symbol.iterator]();
  }

  private findIndexByName(name: string): number {
    const key = this.getKey(name);
    return this.values.findIndex((object) => {
      const objectName = object.getObjectName();
      return objectName !== null && this.getKey(objectName) === key;
    });
  }

  private getKey(name: string | { toString(): string }): string {
    return normalizeName(String(name));
  }
}

function normalizeName(name: string): string {
  return name.toLowerCase();
}
