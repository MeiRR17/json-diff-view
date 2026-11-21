/**
 * Apply RFC 6902 add/remove/replace/test/copy/move on a detached JSON clone.
 *
 * Security properties:
 * - Traversal only follows own data properties, never prototype-chain values.
 * - Object assignments use defineProperty, including "__proto__".
 * - Array indexes must be canonical decimal indexes; "-" is append-only.
 * - An invalid operation aborts without modifying the caller's document.
 *
 * Only parsed JSON data is supported. Moves use removal-before-insertion
 * semantics and cannot target a descendant of their source.
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
function existingValue(root, parts) {
  let current = root;
  for (const segment of parts) {
    if (!container(current)) throw new RangeError('JSON Patch test path traverses a scalar value.');
    if (Array.isArray(current)) current = current[arrayIndex(segment, current.length, false)];
    else {
      if (!own(current, segment)) throw new RangeError('JSON Patch test property is missing.');
      current = current[segment];
    }
  }
  return current;
}

/**
 * JSON equality as required for RFC 6902 test: object key order does not
 * matter, while arrays remain ordered. Work is bounded across the full patch.
 */
function equalJson(a, b, budget, depth = 0) {
  if (++budget.visited > 100_000 || depth > 200) {
    throw new RangeError('JSON Patch test comparisons exceed the safe complexity limit.');
  }
  if (a === b) return true;
  if (!container(a) || !container(b) || Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    return a.length === b.length &&
      a.every((entry, index) => equalJson(entry, b[index], budget, depth + 1));
  }
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(key => own(b, key) && equalJson(a[key], b[key], budget, depth + 1));
}

function jsonClone(value) {
  // The UI passes JSON.parse values. JSON serialization makes it impossible
  // for an external caller to inject undefined, functions or cyclic objects.
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError('Patch values must be JSON-compatible.');
  return JSON.parse(serialized);
}
function applyOne(root, operation, comparisonBudget) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
    throw new TypeError('JSON Patch operation must be an object.');
  }
  const { op, path } = operation;
  if (!['add', 'remove', 'replace', 'test', 'copy', 'move'].includes(op)) {
    throw new RangeError('Unsupported JSON Patch operation (expected add, remove, replace, test, copy or move).');
  }
  const parts = decodePointer(path);
  const hasValue = own(operation, 'value');
  if ((op === 'add' || op === 'replace' || op === 'test') && !hasValue) {
    throw new TypeError('Add, replace and test operations require a value.');
  }
  if (op === 'copy' || op === 'move') {
    // Both operations read their source before modifying the detached document.
    // Source paths must resolve to existing values, including the root pointer.
    if (!own(operation, 'from')) {
      throw new TypeError('Copy and move operations require a from pointer.');
    }
    const fromParts = decodePointer(operation.from);
    const sourceValue = existingValue(root, fromParts);

    if (op === 'move') {
      // RFC 6902 forbids moving a value into one of its own descendants.
      // Compare decoded segments, not raw strings ("/a" is not "/ab").
      if (parts.length > fromParts.length &&
          fromParts.every((segment, index) => segment === parts[index])) {
        throw new RangeError('Cannot move a value into its own descendant.');
      }
      // Moving a path onto itself is a no-op, but it must still exist.
      if (fromParts.length === parts.length &&
          fromParts.every((segment, index) => segment === parts[index])) {
        return root;
      }
      if (!fromParts.length) {
        throw new RangeError('Moving the document root to a child path is unsupported.');
      }
      // Remove first, then resolve the destination against the resulting tree.
      // This is essential when moving an element within the same array.
      root = applyOne(root, { op: 'remove', path: operation.from }, comparisonBudget);
    }
    // The add handler deep-clones the captured source before insertion,
    // so copying an ancestor cannot create an object cycle.
    return applyOne(root, { op: 'add', path, value: sourceValue }, comparisonBudget);
  }
  if (op === 'test') {
    const expected = jsonClone(operation.value);
    if (!equalJson(existingValue(root, parts), expected, comparisonBudget)) {
      throw new RangeError('JSON Patch test failed: the value does not match.');
    }
    return root;
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
 * @param {unknown[]} patch RFC 6902 operation array.
 * @returns {unknown} A new JSON value, with no mutation to the input.
 */
export function applyJsonPatch(document, patch) {
  if (!Array.isArray(patch) || patch.length > MAX_OPERATIONS) {
    throw new RangeError('Expected a JSON Patch array with at most 5,000 operations.');
  }
  return applyJsonPatchPrefix(document, patch, patch.length);
}

/**
 * Materialize the document after precisely the first `count` instructions.
 * This reuses the same detached execution and shared comparison budget as the
 * full preview, without evaluating any later operations.
 *
 * `count = 0` returns a detached clone of the source.
 * The original source and operation array are never mutated.
 */
export function applyJsonPatchPrefix(document, patch, count) {
  if (!Array.isArray(patch) || patch.length > MAX_OPERATIONS) {
    throw new RangeError('Expected a JSON Patch array with at most 5,000 operations.');
  }
  if (!Number.isSafeInteger(count) || count < 0 || count > patch.length) {
    throw new RangeError('Step must be an integer between 0 and the number of patch operations.');
  }
  let value = jsonClone(document);
  const comparisonBudget = { visited: 0 };
  for (let i = 0; i < count; i++) {
    try {
      value = applyOne(value, patch[i], comparisonBudget);
    } catch (error) {
      throw new Error('JSON Patch operation ' + (i + 1) + ': ' +
        (error instanceof Error ? error.message : 'failed.'));
    }
  }
  return value;
}
