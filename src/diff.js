/**
 * Deterministic, dependency-free structural JSON comparison.
 *
 * Arrays compare by numeric index (not by element identity or edit distance).
 * Object keys compare by exact string equality in sorted order.
 * Results are a change report, not an RFC 6902 patch.
 */

/** @typedef {{path: string, type: 'added'|'removed'|'changed', before?: unknown, after?: unknown}} Change */

const MAX_CHANGES = 5000;
const MAX_VISITED = 100000;
const MAX_DEPTH = 200;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function childPath(path, key) {
  if (typeof key === 'number') return path + '[' + key + ']';
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) return path + '.' + key;
  return path + '[' + JSON.stringify(key) + ']';
}

/**
 * Return differences between two already-parsed JSON values.
 * @param {unknown} before
 * @param {unknown} after
 * @returns {{changes: Change[], counts: {added: number, removed: number, changed: number}, truncated: boolean}}
 * @throws {RangeError} For excessively large or deep structures.
 */
export function diffJson(before, after) {
  const changes = [];
  const counts = { added: 0, removed: 0, changed: 0 };
  let visited = 0;
  let truncated = false;

  function record(path, type, left, right) {
    if (changes.length >= MAX_CHANGES) {
      truncated = true;
      return;
    }
    const item = { path, type };
    if (type !== 'added') item.before = left;
    if (type !== 'removed') item.after = right;
    changes.push(item);
    counts[type]++;
  }

  function walk(left, right, path, depth) {
    if (truncated) return;
    if (++visited > MAX_VISITED) {
      throw new RangeError('JSON contains too many values to compare safely (limit: 100,000).');
    }
    if (depth > MAX_DEPTH) {
      throw new RangeError('JSON is too deeply nested to compare safely (limit: 200).');
    }

    if (Array.isArray(left) && Array.isArray(right)) {
      const count = Math.max(left.length, right.length);
      for (let i = 0; i < count; i++) {
        if (truncated) break;
        const next = childPath(path, i);
        if (i >= left.length) record(next, 'added', undefined, right[i]);
        else if (i >= right.length) record(next, 'removed', left[i], undefined);
        else walk(left[i], right[i], next, depth + 1);
      }
      return;
    }

    if (isRecord(left) && isRecord(right)) {
      const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
      for (const key of keys) {
        if (truncated) break;
        const next = childPath(path, key);
        const hasLeft = Object.hasOwn(left, key);
        const hasRight = Object.hasOwn(right, key);
        if (!hasLeft) record(next, 'added', undefined, right[key]);
        else if (!hasRight) record(next, 'removed', left[key], undefined);
        else walk(left[key], right[key], next, depth + 1);
      }
      return;
    }

    // Equality across JSON primitives; -0 and 0 are treated as equal.
    if (left === right) return;
    record(path, 'changed', left, right);
  }

  walk(before, after, '$', 0);
  return { changes, counts, truncated };
}

/**
 * Parse JSON and add an editor-specific prefix to syntax errors.
 * @param {string} source
 * @param {string} side
 * @returns {unknown}
 */
export function parseJson(source, side) {
  if (source.trim() === '') {
    throw new SyntaxError(side + ' document is empty.');
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new SyntaxError(side + ' JSON: ' + error.message);
  }
}
