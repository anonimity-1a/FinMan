import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

// A one-node replica set on port 27017 for offline development and demos.
// Replica set, because multi-document transactions need one; wiredTiger on disk, so data survives restarts.
const dbPath = fileURLToPath(new URL('../../.localdb', import.meta.url));
mkdirSync(dbPath, { recursive: true });

const rs = await MongoMemoryReplSet.create({
  replSet: { count: 1, name: 'rs0', storageEngine: 'wiredTiger' },
  instanceOpts: [{ port: 27017, dbPath }],
});
console.log(`Local MongoDB ready: mongodb://127.0.0.1:27017/?replicaSet=rs0 (data in ${dbPath})`);

const stop = async () => { await rs.stop({ doCleanup: false }); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
