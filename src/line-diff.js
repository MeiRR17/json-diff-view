/**
 * Resource-bounded line alignment for opaque workspace editor drafts.
 *
 * On modest changed regions, use dynamic-programming longest common
 * subsequence (LCS) to distinguish additions, removals and replacements
 * without treating all subsequent lines as changed after an insertion.
 * Large regions fall back to index alignment and are explicitly labeled.
 * Every maximal adjacent run of changed records is numbered as a hunk;
 * an exactly equal aligned line always starts a new region afterward.
 *
 * This is NOT JSON parsing, patch generation or an executed operation.
 */
export const MAX_LINE_LCS_CELLS = 400000;
export const MAX_LINE_LCS_AXIS = 1000;

export function alignRawLineChanges(left, right, prefix, suffix, emit) {
  const leftSize = left.length - prefix - suffix;
  const rightSize = right.length - prefix - suffix;
  const useLcs = leftSize <= MAX_LINE_LCS_AXIS &&
    rightSize <= MAX_LINE_LCS_AXIS &&
    leftSize * rightSize <= MAX_LINE_LCS_CELLS;
  let added = 0, removed = 0, changed = 0, rows = 0;
  let hunks = 0;
  let insideHunk = false;

  function record(beforeOffset, afterOffset) {
    // An unchanged line ends one region of contiguous edits. Each new run
    // receives a stable, 1-based hunk ID even if its preview is truncated.
    if (!insideHunk) {
      hunks++;
      insideHunk = true;
    }
    const beforePresent = beforeOffset !== null;
    const afterPresent = afterOffset !== null;
    const changeType = beforePresent && afterPresent ? 'changed' :
      beforePresent ? 'removed' : 'added';
    if (changeType === 'added') added++;
    else if (changeType === 'removed') removed++;
    else changed++;
    rows++;
    emit({
      hunk_index: hunks,
      change_type: changeType,
      from_line: beforePresent ? prefix + beforeOffset + 1 : null,
      to_line: afterPresent ? prefix + afterOffset + 1 : null,
      from_present: beforePresent,
      to_present: afterPresent,
      from_text: beforePresent ? left[prefix + beforeOffset] : '',
      to_text: afterPresent ? right[prefix + afterOffset] : ''
    });
  }

  if (!useLcs) {
    // Fallback still skips exactly equal aligned lines and counts every
    // changed pair; preview truncation is the caller's responsibility.
    for (let i = 0; i < Math.max(leftSize, rightSize); i++) {
      const a = i < leftSize ? i : null;
      const b = i < rightSize ? i : null;
      if (a !== null && b !== null &&
          left[prefix + a] === right[prefix + b]) {
        insideHunk = false;
        continue;
      }
      record(a, b);
    }
    return {
      strategy: 'positional-fallback', added, removed, changed, rows, hunks,
      alignment_limited: true
    };
  }

  // The (n+1) x (m+1) matrix stays below the strict 400k cell
  // budget (plus edge row/column). Each LCS length is <= 1000.
  const width = rightSize + 1;
  const matrix = new Uint16Array((leftSize + 1) * width);
  for (let i = leftSize - 1; i >= 0; i--) {
    for (let j = rightSize - 1; j >= 0; j--) {
      const at = i * width + j;
      matrix[at] = left[prefix + i] === right[prefix + j] ?
        1 + matrix[at + width + 1] :
        Math.max(matrix[at + width], matrix[at + 1]);
    }
  }

  const pendingLeft = [], pendingRight = [];
  function flush() {
    for (let k = 0; k < Math.max(pendingLeft.length, pendingRight.length); k++) {
      record(k < pendingLeft.length ? pendingLeft[k] : null,
        k < pendingRight.length ? pendingRight[k] : null);
    }
    pendingLeft.length = 0;
    pendingRight.length = 0;
  }
  let i = 0, j = 0;
  while (i < leftSize || j < rightSize) {
    if (i < leftSize && j < rightSize &&
        left[prefix + i] === right[prefix + j]) {
      flush();
      insideHunk = false;
      i++;
      j++;
    } else if (i < leftSize &&
        (j >= rightSize ||
          matrix[(i + 1) * width + j] >= matrix[i * width + j + 1])) {
      pendingLeft.push(i++);
    } else {
      pendingRight.push(j++);
    }
  }
  flush();
  return {
    strategy: 'lcs', added, removed, changed, rows, hunks,
    alignment_limited: false
  };
}
