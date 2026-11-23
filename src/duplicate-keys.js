/**
 * Detect duplicate object member names in valid JSON source before JSON.parse
 * silently keeps only the final value. The scanner is read-only and bounded.
 */
const MAX_NODES = 100_000;
const MAX_DEPTH = 200;
const MAX_FINDINGS = 200;

function pointer(path, key) {
  return path + '/' + key.replace(/~/gu, '~0').replace(/\\//gu, '~1');
}

export function findDuplicateJsonKeys(source) {
  if (typeof source !== 'string') throw new TypeError('JSON source must be text.');
  if (source.length > 2 * 1024 * 1024) throw new RangeError('JSON source exceeds 2 MiB.');
  let i = 0, visited = 0, truncated = false;
  const duplicates = [];
  const whitespace = () => { while (/[\\t\\n\\r ]/u.test(source[i] || '\\0')) i++; };
  const stringToken = () => {
    const start = i++;
    while (i < source.length) {
      if (source[i] === '\\\\') { i += 2; continue; }
      if (source[i++] === '"') return JSON.parse(source.slice(start, i));
    }
    throw new SyntaxError('Unterminated JSON string during duplicate-key scan.');
  };
  const scalar = () => {
    const start = i;
    while (i < source.length && !/[\\s,\\]}]/u.test(source[i])) i++;
    if (i === start) throw new SyntaxError('Invalid JSON token during duplicate-key scan.');
    return;
  };
  function value(path, depth) {
    if (++visited > MAX_NODES) throw new RangeError('JSON contains too many values to scan safely (limit: 100,000).');
    if (depth > MAX_DEPTH) throw new RangeError('JSON is too deeply nested to scan safely (limit: 200).');
    whitespace();
    if (source[i] === '{') {
      i++; whitespace();
      const first = new Map();
      if (source[i] === '}') { i++; return; }
      while (i < source.length) {
        whitespace();
        const position = i;
        if (source[i] !== '"') throw new SyntaxError('Expected object key during duplicate-key scan.');
        const key = stringToken();
        whitespace();
        if (source[i++] !== ':') throw new SyntaxError('Expected colon during duplicate-key scan.');
        if (first.has(key)) {
          const found = first.get(key);
          if (duplicates.length < MAX_FINDINGS) {
            if (!found.positions) found.positions = [found.firstPosition];
            found.positions.push(position);
            found.occurrences++;
          } else truncated = true;
        } else first.set(key, { path: pointer(path, key), key, firstPosition: position, occurrences: 1, positions: null });
        value(pointer(path, key), depth + 1);
        whitespace();
        if (source[i] === '}') { i++; break; }
        if (source[i++] !== ',') throw new SyntaxError('Expected comma during duplicate-key scan.');
      }
      for (const item of first.values()) {
        if (item.occurrences > 1 && duplicates.length < MAX_FINDINGS) {
          duplicates.push({ path: item.path, key: item.key, occurrences: item.occurrences,
            positions: item.positions || [item.firstPosition] });
        }
      }
      return;
    }
    if (source[i] === '[') {
      i++; whitespace(); let index = 0;
      if (source[i] === ']') { i++; return; }
      while (i < source.length) {
        value(path + '/' + index++, depth + 1);
        whitespace();
        if (source[i] === ']') { i++; break; }
        if (source[i++] !== ',') throw new SyntaxError('Expected comma during duplicate-key scan.');
      }
      return;
    }
    if (source[i] === '"') { stringToken(); return; }
    scalar();
  }
  whitespace();
  value('$', 0);
  whitespace();
  if (i !== source.length) throw new SyntaxError('Unexpected trailing data during duplicate-key scan.');
  return { count: duplicates.reduce((sum, item) => sum + 1, 0), duplicates, truncated, scannedValues: visited };
}
