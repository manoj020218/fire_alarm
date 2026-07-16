/**
 * Jest global setup — start mongodb-memory-server once for the full suite.
 * The URI is stored in global.__MONGO_URI__ for test files to use.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

declare global {
  // eslint-disable-next-line no-var
  var __MONGOD__: MongoMemoryServer;
}

export default async function globalSetup(): Promise<void> {
  const mongod = await MongoMemoryServer.create({
    instance: {
      dbName: 'fireguard_test',
    },
  });
  global.__MONGOD__ = mongod;
  process.env['MONGODB_URI'] = mongod.getUri();

  // Minimal env vars for tests (must satisfy Zod schema)
  process.env['JWT_SECRET'] = 'test-secret-that-is-at-least-32-characters-long!!';
  process.env['JWT_EXPIRY'] = '1h';
  process.env['JWT_REFRESH_EXPIRY'] = '7d';
  process.env['NODE_ENV'] = 'test';
  process.env['PORT'] = '3099';
  process.env['TELEMETRY_RETENTION_DAYS'] = '90';
}
