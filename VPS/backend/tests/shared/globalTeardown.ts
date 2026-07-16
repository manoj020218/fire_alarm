/**
 * Jest global teardown — stop mongodb-memory-server.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

declare global {
  // eslint-disable-next-line no-var
  var __MONGOD__: MongoMemoryServer;
}

export default async function globalTeardown(): Promise<void> {
  if (global.__MONGOD__) {
    await global.__MONGOD__.stop();
  }
}
