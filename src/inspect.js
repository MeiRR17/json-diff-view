/**
 * Read-only summary of parsed RFC 6902 patch instructions.
 * This is a syntactic review aid; final target existence, array indexes and
 * operation semantics are only determined by the detached patch preview.
 */
const MAX_OPERATIONS = 5000;
const MAX_VALUE_PREVIEW = 240;
const SUPPORTED = new Set(['add', 'remove', 'replace', 'test', 'copy', 'move']);
const NEED_VALUE = new Set(['add', 'replace', 'test']);
const NEED_FROM = new Set(['copy', 'move']);

function isPointer(value) {
  return typeof value === 'string' && value.length <= 8192 &&
    (value === '' || (value.startsWith('/') && !/~(?![01])/u.test(value)));
}

function previewValue(value) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) return '(no JSON value)';
  return serialized.length > MAX_VALUE_PREVIEW ?
    serialized.slice(0, MAX_VALUE_PREVIEW) + '… (shortened)' : serialized;
}

export function inspectPatchOperations(patch) {
  if (!Array.isArray(patch) || patch.length > MAX_OPERATIONS) {
    throw new RangeError('Expected a JSON Patch array with at most 5,000 operations.');
  }

  const counts = { total: patch.length, warnings: 0 };
  const byOp = Object.create(null);
  const rows = [];
  patch.forEach((item, index) => {
    const obj = item && typeof item === 'object' && !Array.isArray(item);
    const op = obj && typeof item.op === 'string' ? item.op : '(invalid)';
    const path = obj && typeof item.path === 'string' ? item.path : '(missing)';
    const from = obj && typeof item.from === 'string' ? item.from : '';
    const hasValue = obj && Object.hasOwn(item, 'value');
    const issues = [];

    if (!obj) issues.push('Operation must be an object');
    else {
      if (!SUPPORTED.has(op)) issues.push('Unsupported operation');
      if (!isPointer(item.path)) issues.push('Invalid or missing path');
      if (NEED_FROM.has(op) && !isPointer(item.from)) {
        issues.push('Invalid or missing from pointer');
      }
      if (NEED_VALUE.has(op) && !hasValue) issues.push('Missing value');
      if (op === 'remove' && item.path === '') issues.push('Root removal unsupported');
      if (op === 'move' && item.from === '' && item.path !== '') {
        issues.push('Moving root to child unsupported');
      }
    }
    if (issues.length) counts.warnings++;
    byOp[op] = (byOp[op] ?? 0) + 1;
    rows.push({
      index: index + 1,
      op,
      path,
      from,
      value: hasValue ? previewValue(item.value) : '—',
      issues: issues.join('; ')
    });
  });
  return { rows, counts, byOp };
}
