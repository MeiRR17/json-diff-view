/**
 * RFC 6902 JSON Patch generation (add / remove / replace only).
 *
 * Arrays use index-based comparison rather than move detection. Appends
 * occur in ascending order, and removals from the end to prevent index drift.
 * Output is a bare RFC 6902 operation array, suitable for a JSON Patch consumer.
 *
 * Unlike a truncated visual diff, an oversized patch is rejected entirely:
 * emitting only some operations would incorrectly imply a complete change.
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
 */
export function createJsonPatch(before, after) {
  const operations = [];
  let visited = 0;
  function emit(op, path, value) {
    if (operations.length >= MAX_OPERATIONS) {
      throw new RangeError('The JSON Patch would exceed 5,000 operations. Use smaller input documents.');
    }
    operations.push(op === 'remove' ? { op, path } : { op, path, value });
  }
  function walk(left, right, path, depth) {
    if (++visited > MAX_VISITS) throw new RangeError('JSON contains too many values to patch (limit: 100,000).');
    if (depth > MAX_DEPTH) throw new RangeError('JSON is too deeply nested to patch (limit: 200).');
    if (left === right) return;

    if (Array.isArray(left) && Array.isArray(right)) {
      const common = Math.min(left.length, right.length);
      for (let i = 0; i < common; i++) walk(left[i], right[i], child(path, i), depth + 1);
      // Remove from the end so earlier indices remain valid.
      for (let i = left.length - 1; i >= common; i--) emit('remove', child(path, i));
      // Append in ascending order after common-length operations.
      for (let i = common; i < right.length; i++) emit('add', child(path, i), right[i]);
      return;
    }

    if (record(left) && record(right)) {
      const oldKeys = Object.keys(left).sort();
      const newKeys = Object.keys(right).sort();
      for (const key of oldKeys) {
        if (!Object.hasOwn(right, key)) emit('remove', child(path, key));
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
    emit('replace', path, right);
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
