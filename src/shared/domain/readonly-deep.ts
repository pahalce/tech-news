export type ReadonlyDeep<T> = unknown extends T
  ? T
  : T extends Array<infer U>
    ? readonly ReadonlyDeep<U>[]
    : T extends object
      ? { readonly [K in keyof T]: ReadonlyDeep<T[K]> }
      : T;
