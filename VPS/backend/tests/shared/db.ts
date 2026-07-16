/**
 * Per-test-file Mongoose connect/disconnect helpers.
 * Each test file calls connect() in beforeAll and disconnect() in afterAll.
 * Each test calls clearCollections() in afterEach for isolation.
 */
import mongoose from 'mongoose';

export async function connectTestDB(): Promise<void> {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI not set — globalSetup did not run');
  await mongoose.connect(uri);
  // Build indexes for all registered models so unique constraints are enforced
  // in tests (mongodb-memory-server builds indexes asynchronously otherwise).
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}

export async function disconnectTestDB(): Promise<void> {
  await mongoose.disconnect();
}

export async function clearCollections(): Promise<void> {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((col) => col.deleteMany({}))
  );
}
