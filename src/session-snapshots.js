/**
 * Memory-only manual workspace snapshots.
 *
 * The store holds serialized versioned workspace files, not browser
 * persistence. It never parses or runs editor text or JSON Patch operations.
 * Its limits prevent unbounded in-tab accumulation of sensitive drafts.
 */
export const MAX_SESSION_SNAPSHOTS = 8;
export const MAX_SESSION_SNAPSHOT_BYTES = 24 * 1024 * 1024;
const MAX_SNAPSHOT_NAME_LENGTH = 80;
const encoder = new TextEncoder();

export function createSessionSnapshotStore() {
  const entries = new Map();
  let nextId = 1;
  let totalBytes = 0;
  function list() {
    return [...entries.values()].map(({ id, name, bytes }) => ({
      id, name, bytes
    }));
  }
  function read(id) {
    return entries.get(String(id)) ?? null;
  }
  function add(name, content) {
    if (typeof name !== 'string' || !name.trim() ||
        name.trim().length > MAX_SNAPSHOT_NAME_LENGTH) {
      throw new TypeError('Snapshot name must be 1–80 characters.');
    }
    if (typeof content !== 'string') {
      throw new TypeError('Snapshot must contain a serialized workspace file.');
    }
    const bytes = encoder.encode(content).byteLength;
    if (bytes > 8 * 1024 * 1024) {
      throw new RangeError('Snapshot is larger than the 8 MiB workspace limit.');
    }
    if (entries.size >= MAX_SESSION_SNAPSHOTS) {
      throw new RangeError('The session already has eight snapshots. Delete one first.');
    }
    if (totalBytes + bytes > MAX_SESSION_SNAPSHOT_BYTES) {
      throw new RangeError('Session snapshots exceed 24 MiB. Delete an older snapshot.');
    }
    const entry = {
      id: String(nextId++), name: name.trim(), content, bytes
    };
    entries.set(entry.id, entry);
    totalBytes += bytes;
    return { id: entry.id, name: entry.name, bytes: entry.bytes };
  }
  function remove(id) {
    const entry = entries.get(String(id));
    if (!entry) return false;
    totalBytes -= entry.bytes;
    entries.delete(entry.id);
    return true;
  }
  function usage() {
    return { count: entries.size, bytes: totalBytes,
      maxCount: MAX_SESSION_SNAPSHOTS, maxBytes: MAX_SESSION_SNAPSHOT_BYTES };
  }
  return { list, read, add, remove, usage };
}
