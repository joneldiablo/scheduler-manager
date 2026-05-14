# Progress

## Goal
Get all test files passing after refactoring to ESM-compatible mocking.

## Completed
- Converted `app.test.ts` from `jest.mock()` (not hoisted in ESM) to `jest.unstable_mockModule()` + dynamic `import()`
- Converted `cli.test.ts` from `jest.mock()` to `jest.unstable_mockModule()` with top-level mock function references
- Fixed `database.test.ts`: replaced `mockSchema.raw` with `mockRaw` for `database.raw()` assertions
- Fixed `__mocks__/knex.ts`: added `default: knexFn` to instance so `knex.default(config)` works (needed by cli.ts demo-data path)
- Fixed `cli.test.ts` shutdown assertions: added `\n` prefix to match `cli.ts` output
- Fixed `cli.test.ts` import path: `../../src/cli.js` → `../src/cli.js`

## Key Decisions
- Use `jest.unstable_mockModule` before any imports, with jest.fn() references at module top level
- Tests use `jest.clearAllMocks()` in `beforeEach` to reset call counts
- For `cli.test.ts`: use top-level mock functions directly instead of importing and casting
- Keep `jest.resetModules()` in cli.test.ts for test isolation

## Test Command
```bash
node --experimental-vm-modules ../node_modules/jest/bin/jest.js --config jest.config.ts --no-coverage
```

## Results
14 suites, 239 tests — all passing.
