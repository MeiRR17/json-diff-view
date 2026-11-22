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
  /**
   * Update the visible name in place without changing snapshot identity or
   * data size. An expected prior name protects against stale UI operations.
   */
  function rename(id, newName, expectedName) {
    const entry = read(id);
    if (!entry) throw new RangeError('Selected snapshot no longer exists.');
    if (entry.name !== expectedName) {
      throw new Error('Snapshot name changed; select it again before renaming.');
    }
    const prepared = prepareEntry(newName, entry.content);
    if (prepared.name === entry.name) {
      return { id: entry.id, name: entry.name, bytes: entry.bytes, changed: false };
    }
    entry.name = prepared.name;
    return { id: entry.id, name: entry.name, bytes: entry.bytes, changed: true };
  }
  /**
   * Re-capture a stored point from new serialized workspace contents.
   * Validate size and aggregate capacity before mutating either bytes or
   * content. A captured expected value prevents stale overwrites.
   */
  function replaceContent(id, newContent, expectedContent) {
    const entry = read(id);
    if (!entry) throw new RangeError('Selected snapshot no longer exists.');
    if (entry.content !== expectedContent) {
      throw new Error('Snapshot changed since selection; reopen it before updating.');
    }
    const prepared = prepareEntry(entry.name, newContent);
    if (prepared.content === entry.content) {
      return { id: entry.id, name: entry.name, bytes: entry.bytes, changed: false };
    }
    const projected = totalBytes - entry.bytes + prepared.bytes;
    if (projected > MAX_SESSION_SNAPSHOT_BYTES) {
      throw new RangeError('Updating this snapshot would exceed 24 MiB. ' +
        'Delete older snapshots or reduce editor contents first.');
    }
    totalBytes = projected;
    entry.content = prepared.content;
    entry.bytes = prepared.bytes;
    return { id: entry.id, name: entry.name, bytes: entry.bytes, changed: true };
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
  return { list, read, add, addMany, planImport, rename, replaceContent, remove, usage };
}
