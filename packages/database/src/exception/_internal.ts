const DBAL_EXCEPTION_MARKER = Symbol.for("@devscast/datazen.exception");

type MarkedException = Error & {
  [DBAL_EXCEPTION_MARKER]?: true;
};

type ErrorConstructorLike = {
  name: string;
  prototype: object;
};

export function initializeException(error: Error, ctor: ErrorConstructorLike): void {
  error.name = ctor.name;
  Object.setPrototypeOf(error, ctor.prototype);
  Object.defineProperty(error as MarkedException, DBAL_EXCEPTION_MARKER, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });
}

export function isDatazenException(error: unknown): error is Error {
  return error instanceof Error && (error as MarkedException)[DBAL_EXCEPTION_MARKER] === true;
}
