/**
 * Apply the add/remove/replace subset of RFC 6902 on a detached JSON clone.
 *
 * Security properties:
 * - Traversal only follows own data properties, never prototype-chain values.
 * - Object assignments use defineProperty, including "__proto__".
 * - Array indexes must be canonical decimal indexes; "-" is append-only.
 * - An invalid operation aborts without modifying the caller's document.
 *
 * Only parsed JSON data is supported. move, copy, and test are intentionally
 * rejected, rather than silently ignored.
 */
const MAX_OPERATIONS = 5000;
const MAX_POINTER_LENGTH = 8192;

function own(value, key) {
  return Object.hasOwn(value, key);
}
function container(value) {
  return value !== null && typeof value === 'object';
}
function decodePointer(path) {
  if (typeof path !== 'string' || path.length > MAX_POINTER_LENGTH) {
    throw new RangeError('A JSON Pointer path is missing or exceeds 8,192 characters.');
  }
  if (path === '') return [];
  if (!path.startsWith('/')) throw new SyntaxError('JSON Pointer must start with "/" or be empty.');
  return path.slice(1).split('/').map(part => {
    if (/~(?![01])/u.test(part)) throw new SyntaxError('Invalid JSON Pointer escape.');
    return part.replaceAll('~1', '/').replaceAll('~0', '~');
  });
}
function arrayIndex(segment, length, append) {
  if (append && segment === '-') return length;
  if (!/^(0|[1-9]\d*)$/u.test(segment)) {
    throw new SyntaxError('Array path must use a canonical non-negative index.');
  }
  const index = Number(segment);
  if (!Number.isSafeInteger(index) || index > length || (!append && index === length)) {
    throw new RangeError('JSON Patch array index is out of range.');
  }
  return index;
}
function targetParent(document, parts) {
  let current = document;
  for (const segment of parts.slice(0, -1)) {
    if (!container(current)) throw new RangeError('JSON Patch path traverses a scalar value.');
    if (Array.isArray(current)) {
      current = current[arrayIndex(segment, current.length, false)];
    } else {
      if (!own(current, segment)) throw new RangeError('JSON Patch parent property does not exist.');
      current = current[segment];
    }
  }
  if (!container(current)) throw new RangeError('JSON Patch parent is not an object or array.');
  return current;
}
function jsonClone(value) {
  // The UI passes JSON.parse values. JSON serialization makes it impossible
  // for an external caller to inject undefined, functions or cyclic objects.
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError('Patch values must be JSON-compatible.');
  return JSON.parse(serialized);
}
function applyOne(root, operation) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
    throw new TypeError('JSON Patch operation must be an object.');
  }
  const { op, path } = operation;
  if (!['add', 'remove', 'replace'].includes(op)) {
    throw new RangeError('Only add, remove and replace operations are supported.');
  }
  const parts = decodePointer(path);
  const hasValue = own(operation, 'value');
  if ((op === 'add' || op === 'replace') && !hasValue) {
    throw new TypeError('Add and replace operations require a value.');
  }
  // The root pointer ("") refers to the whole document.
  if (!parts.length) {
    if (op === 'remove') throw new RangeError('Removing the document root is unsupported.');
    return jsonClone(operation.value);
  }
  const parent = targetParent(root, parts);
  const key = parts[parts.length - 1];
  if (Array.isArray(parent)) {
    const index = arrayIndex(key, parent.length, op === 'add');
    if (op === 'add') parent.splice(index, 0, jsonClone(operation.value));
    else if (op === 'remove') parent.splice(index, 1);
    else parent[index] = jsonClone(operation.value);
  } else if (op === 'remove') {
    if (!own(parent, key)) throw new RangeError('Cannot remove a missing property.');
    delete parent[key];
  } else {
    if (op === 'replace' && !own(parent, key)) {
      throw new RangeError('Cannot replace a missing property.');
    }
    Object.defineProperty(parent, key, {
      value: jsonClone(operation.value),
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  return root;
}

/**
 * @param {unknown} document JSON-parsed original document.
 * @param {unknown[]} patch RFC 6902 operation array (supported subset).
 * @returns {unknown} A new JSON value, with no mutation to the input.
 */
export function applyJsonPatch(document, patch) {
  if (!Array.isArray(patch) || patch.length > MAX_OPERATIONS) {
    throw new RangeError('Expected a JSON Patch array with at most 5,000 operations.');
  }
  let value = jsonClone(document);
  for (let i = 0; i < patch.length; i++) {
    try {
      value = applyOne(value, patch[i]);
    } catch (error) {
      throw new Error('JSON Patch operation ' + (i + 1) + ': ' +
        (error instanceof Error ? error.message : 'failed.'));
    }
  }
  return value;
}
