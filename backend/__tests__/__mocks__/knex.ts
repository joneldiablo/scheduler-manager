import { jest } from '@jest/globals';
import type { Knex } from 'knex';

export interface QueryBuilderMock {
  select: jest.Mock;
  where: jest.Mock;
  whereIn: jest.Mock;
  whereNot: jest.Mock;
  first: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  orderBy: jest.Mock;
  limit: jest.Mock;
  offset: jest.Mock;
  count: jest.Mock;
  clone: jest.Mock;
  clearSelect: jest.Mock;
  orWhere: jest.Mock;
  then: jest.Mock;
  catch: jest.Mock;
  finally: jest.Mock;
  [key: string]: unknown;
}

function createQueryMock(): QueryBuilderMock {
  const qb: Partial<QueryBuilderMock> = {};
  const methods = [
    'select', 'where', 'whereIn', 'whereNot', 'first', 'insert', 'update',
    'delete', 'orderBy', 'limit', 'offset', 'count', 'clone', 'clearSelect',
    'orWhere', 'then', 'catch', 'finally', 'whereNull', 'whereNotNull',
    'whereRaw', 'join', 'leftJoin', 'rightJoin', 'groupBy', 'having',
    'distinct', 'increment', 'decrement', 'truncate', 'from',
  ];
  for (const m of methods) {
    qb[m] = jest.fn().mockReturnThis();
  }
  return qb as unknown as QueryBuilderMock;
}

let cached: any = null;
let cachedQb: any = null;
let cachedSchema: any = null;

function getKnexInstance() {
  if (cached) return cached;

  cachedQb = createQueryMock();
  const mockDb = cachedQb;

  cachedSchema = {
    hasTable: jest.fn().mockResolvedValue(false),
    createTable: jest.fn().mockResolvedValue(undefined),
    dropTableIfExists: jest.fn().mockResolvedValue(undefined),
    alterTable: jest.fn().mockResolvedValue(undefined),
    raw: jest.fn().mockResolvedValue(undefined),
  };
  const schema = cachedSchema;

  const destroy = jest.fn().mockResolvedValue(undefined);
  const raw = jest.fn().mockResolvedValue(undefined);
  const now = jest.fn().mockReturnValue("datetime('now')");

  let instance: any;
  const knexFn = (arg: unknown) => {
    if (typeof arg === 'object' && arg !== null) {
      return instance;
    }
    return mockDb;
  };

  instance = Object.assign(
    knexFn as unknown as Knex,
    { schema, destroy, raw, fn: { now }, default: knexFn }
  );

  cached = instance;
  return instance;
}

getKnexInstance();

export const mockQueryBuilder = cachedQb as unknown as QueryBuilderMock;
export const mockSchema = cachedSchema as {
  hasTable: jest.Mock;
  createTable: jest.Mock;
  dropTableIfExists: jest.Mock;
  alterTable: jest.Mock;
};
export const mockDbInstance = cached;
export const mockRaw = cached.raw as jest.Mock;

export default new Proxy(function () {} as unknown as Knex, {
  apply(_target, _thisArg, args) {
    return (getKnexInstance() as any)(...args);
  },
  get(_target, prop) {
    return (getKnexInstance() as any)[prop];
  },
});
