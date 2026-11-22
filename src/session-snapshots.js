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
  function prepareEntry(name, content) {
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
    return { name: name.trim(), content, bytes };
  }
  function planImport(batch, { replace = false } = {}) {
    if (!Array.isArray(batch) || batch.length < 1 ||
        batch.length > MAX_SESSION_SNAPSHOTS) {
      throw new RangeError('Import 1–8 named workspace snapshots.');
    }
    const incoming = batch.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new TypeError('Invalid snapshot entry.');
      }
      return prepareEntry(item.name, item.content);
    });
    const currentCount = replace ? 0 : entries.size;
    const currentBytes = replace ? 0 : totalBytes;
    const combinedCount = currentCount + incoming.length;
    const combinedBytes = currentBytes + incoming.reduce(
      (total, item) => total + item.bytes, 0);
    if (combinedCount > MAX_SESSION_SNAPSHOTS) {
      throw new RangeError('This import would exceed eight snapshots. ' +
        'Choose Replace or delete existing snapshots first.');
    }
    if (combinedBytes > MAX_SESSION_SNAPSHOT_BYTES) {
      throw new RangeError('This import would exceed 24 MiB in tab memory. ' +
        'Choose Replace or delete older snapshots first.');
    }
    return { incoming, combinedCount, combinedBytes };
  }
  function addMany(batch, { replace = false } = {}) {
    // Entire batch is checked before any mutation. Invalid or oversized
    // imports never partially delete or insert existing snapshots.
    const plan = planImport(batch, { replace });
    if (replace) {
      entries.clear();
      totalBytes = 0;
    }
    const created = [];
    for (const item of plan.incoming) {
      const entry = { id: String(nextId++), ...item };
      entries.set(entry.id, entry);
      totalBytes += entry.bytes;
      created.push({ id: entry.id, name: entry.name, bytes: entry.bytes });
    }
    return created;
  }
  function add(name, content) {
    return addMany([{ name, content }])[0];
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
  return { list, read, add, addMany, planImport, remove, usage };
}
