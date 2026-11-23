/**
 * RFC 6902 JSON Patch generation (add / remove / replace; optional test guards).
 *
 * Arrays use index-based comparison rather than move detection. Appends
 * occur in ascending order, and removals from the end to prevent index drift.
 * Output is a bare RFC 6902 operation array, suitable for a JSON Patch consumer.
 *
 * Unlike a truncated visual diff, an oversized patch is rejected entirely:
 * emitting only some operations would incorrectly imply a complete change.
 *
 * Optional test assertions guard the values being removed/replaced. They do
 * not guard add-only operations or detect unrelated changes elsewhere.
 */
const MAX_OPERATIONS = 5000;
const MAX_DEPTH = 200;
const MAX_VISITS = 100000;

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function escapePointer(segment) {
  return String(segment).replaceAll('~', '~0').replaceAll('/', '~1');
}
function child(path, segment) {
  return path + '/' + escapePointer(segment);
}

/**
 * Build a deterministic RFC 6902 patch transforming before into after.
 * Both values should have been produced by JSON.parse (plain JSON data).
 * No input objects are modified. Object property order does not matter.
 * @param {unknown} before parsed JSON value
 * @param {unknown} after parsed JSON value
 * @param {{ guardChanges?: boolean }} [options] emit test guards before remove/replace
 */
export function createJsonPatch(before, after, { guardChanges = false } = {}) {
  const operations = [];
  let visited = 0;
  let guardVisits = 0;

  // The patch applier limits the combined work of all test operations to
  // 100,000 JSON nodes, with a maximum comparison depth of 200.
  // Refuse to generate guarded patches that cannot meet that same budget.
  function accountGuard(value, depth = 0) {
    if (++guardVisits > MAX_VISITS || depth > MAX_DEPTH) {
      throw new RangeError('Guard assertions exceed the JSON Patch test complexity limit.');
    }
    if (value !== null && typeof value === 'object') {
      const values = Array.isArray(value) ? value : Object.values(value);
      for (const entry of values) accountGuard(entry, depth + 1);
    }
  }
  function append(operation) {
    if (operations.length >= MAX_OPERATIONS) {
      throw new RangeError('The JSON Patch would exceed 5,000 operations. Use smaller input documents.');
    }
    operations.push(operation);
  }
  function emit(op, path, value, previous) {
    if (guardChanges && (op === 'remove' || op === 'replace')) {
      accountGuard(previous);
      append({ op: 'test', path, value: previous });
    }
    append(op === 'remove' ? { op, path } : { op, path, value });
  }
  function walk(left, right, path, depth) {
    if (++visited > MAX_VISITS) throw new RangeError('JSON contains too many values to patch (limit: 100,000).');
    if (depth > MAX_DEPTH) throw new RangeError('JSON is too deeply nested to patch (limit: 200).');
    if (left === right) return;

    if (Array.isArray(left) && Array.isArray(right)) {
      const common = Math.min(left.length, right.length);
      for (let i = 0; i < common; i++) walk(left[i], right[i], child(path, i), depth + 1);
      // Remove from the end so earlier indices remain valid.
      for (let i = left.length - 1; i >= common; i--) emit('remove', child(path, i), undefined, left[i]);
      // Append in ascending order after common-length operations.
      for (let i = common; i < right.length; i++) emit('add', child(path, i), right[i]);
      return;
    }

    if (record(left) && record(right)) {
      const oldKeys = Object.keys(left).sort();
      const newKeys = Object.keys(right).sort();
      for (const key of oldKeys) {
        if (!Object.hasOwn(right, key)) emit('remove', child(path, key), undefined, left[key]);
      }
      for (const key of oldKeys) {
        if (Object.hasOwn(right, key)) walk(left[key], right[key], child(path, key), depth + 1);
      }
      for (const key of newKeys) {
        if (!Object.hasOwn(left, key)) emit('add', child(path, key), right[key]);
      }
      return;
    }
    // Replacing an entire value is valid for a type change, including root "".
    emit('replace', path, right, left);
  }
  walk(before, after, '', 0);
  return operations;
}

/**
 * Serialize an RFC 6902 operation list as formatted JSON.
 * The returned text contains no custom metadata, for patch interoperability.
 */
export function serializeJsonPatch(operations) {
  if (!Array.isArray(operations)) throw new TypeError('Expected a JSON Patch array.');
  return JSON.stringify(operations, null, 2) + '\n';
}
