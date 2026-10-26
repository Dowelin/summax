// Minimal typing for Node's built-in test runner, so the project needs no
// @types/node. Only what the tests use is declared.
declare module 'node:test' {
  type Fn = () => void | Promise<void>;
  export function describe(name: string, fn: Fn): void;
  export function it(name: string, fn: Fn): void;
  export function test(name: string, fn: Fn): void;
}

declare module 'node:assert/strict' {
  interface Assert {
    (value: unknown, message?: string): asserts value;
    ok(value: unknown, message?: string): asserts value;
    equal(actual: unknown, expected: unknown, message?: string): void;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    throws(fn: () => unknown, message?: string): void;
    fail(message?: string): never;
  }
  const assert: Assert;
  export default assert;
}

declare var process: { env: Record<string, string | undefined> } | undefined;
