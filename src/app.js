import { diffJson, parseJson } from './diff.js';
import { createJsonPatch, serializeJsonPatch } from './patch.js';
import { applyJsonPatch } from './apply.js';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_PREVIEW_CHARS = 1200;

const beforeEditor = document.querySelector('#before');
const afterEditor = document.querySelector('#after');
const status = document.querySelector('#status');
const summary = document.querySelector('#summary');
const changeRows = document.querySelector('#changes');
const copyButton = document.querySelector('#copy');
const copyPatchButton = document.querySelector('#copy-patch');
const downloadPatchButton = document.querySelector('#download-patch');
const patchSource = document.querySelector('#patch-source');
const patchResult = document.querySelector('#patch-result');
const patchStatus = document.querySelector('#patch-status');
const useGeneratedButton = document.querySelector('#use-generated');
const sendResultButton = document.querySelector('#send-result');
const downloadResultButton = document.querySelector('#download-result');

let latestReport = null;
let latestPatch = null;
let lastApplied = null;

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function fitInput(source, label) {
  const size = new TextEncoder().encode(source).byteLength;
  if (size > MAX_BYTES) {
    throw new RangeError(label + ' exceeds 2 MiB. Use a smaller document.');
  }
}

function displayValue(value, exists) {
  if (!exists) return '— not present —';
  const json = JSON.stringify(value, null, 2);
  if (json.length <= MAX_PREVIEW_CHARS) return json;
  return json.slice(0, MAX_PREVIEW_CHARS) + '\n… (preview shortened; copy report for full value)';
}

function cell(tag, text, className = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text;
  return el;
}

function renderReport(report) {
  changeRows.replaceChildren();
  summary.replaceChildren();
  summary.hidden = false;

  for (const [label, n, cssClass] of [
    ['Added', report.counts.added, 'added'],
    ['Removed', report.counts.removed, 'removed'],
    ['Changed', report.counts.changed, 'changed']
  ]) {
    const pill = cell('span', label + ': ' + n, 'pill ' + cssClass);
    summary.append(pill);
  }

  if (report.truncated) {
    summary.append(cell('span', 'Showing first 5,000 changes', 'pill'));
  }

  if (!report.changes.length) {
    const row = document.createElement('tr');
    const message = cell('td', 'No differences. Both JSON documents contain the same values.', 'empty');
    message.colSpan = 3;
    row.append(message);
    changeRows.append(row);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const change of report.changes) {
    const row = document.createElement('tr');
    row.className = change.type;

    const pathCell = document.createElement('td');
    pathCell.append(cell('span', change.type, 'tag'));
    pathCell.append(document.createElement('br'));
    pathCell.append(cell('span', change.path, 'path'));
    row.append(pathCell);

    const before = document.createElement('td');
    before.append(cell('pre', displayValue(change.before, change.type !== 'added')));
    const after = document.createElement('td');
    after.append(cell('pre', displayValue(change.after, change.type !== 'removed')));
    row.append(before, after);
    fragment.append(row);
  }
  changeRows.append(fragment);
}

function invalidatePatchResult() {
  lastApplied = null;
  patchResult.value = '';
  sendResultButton.disabled = true;
  downloadResultButton.disabled = true;
}
function resetReport() {
  invalidatePatchResult();
  useGeneratedButton.disabled = true;
  latestReport = null;
  latestPatch = null;
  copyButton.disabled = true;
  copyPatchButton.disabled = downloadPatchButton.disabled = true;
  summary.hidden = true;
  summary.replaceChildren();
  const row = document.createElement('tr');
  const message = cell('td', 'Differences will appear here.', 'empty');
  message.colSpan = 3;
  row.append(message);
  changeRows.replaceChildren(row);
}

function compare() {
  invalidatePatchResult();
  useGeneratedButton.disabled = true;
  try {
    fitInput(beforeEditor.value, 'Before');
    fitInput(afterEditor.value, 'After');
    const left = parseJson(beforeEditor.value, 'Before');
    const right = parseJson(afterEditor.value, 'After');
    const report = diffJson(left, right);
    latestReport = report;
    renderReport(report);
    copyButton.disabled = false;

    // JSON Patch is generated independently of the visual diff. A patch that
    // exceeds operation limits is never exported incompletely.
    let patchStatus = '';
    try {
      latestPatch = createJsonPatch(left, right);
      copyPatchButton.disabled = downloadPatchButton.disabled = false;
      useGeneratedButton.disabled = false;
      summary.append(cell('span', 'JSON Patch: ' + latestPatch.length + ' operations', 'pill'));
    } catch (patchError) {
      latestPatch = null;
      copyPatchButton.disabled = downloadPatchButton.disabled = true;
      useGeneratedButton.disabled = true;
      patchStatus = ' Patch unavailable: ' + (patchError.message || 'too many operations') + '.';
      summary.append(cell('span', 'JSON Patch unavailable', 'pill'));
    }
    const count = report.changes.length;
    setStatus(
      (count === 0 ? 'Comparison complete: no differences.' :
      'Comparison complete: ' + count + ' difference' + (count === 1 ? '' : 's') +
      (report.truncated ? ' shown (report truncated).' : '.')) + patchStatus
    );
  } catch (error) {
    resetReport();
    setStatus(error instanceof Error ? error.message : 'Could not compare JSON.', true);
  }
}

async function importFile(file, editor, label) {
  if (!file) return;
  if (file.size > MAX_BYTES) {
    setStatus(label + ' file exceeds 2 MiB.', true);
    return;
  }
  try {
    editor.value = await file.text();
    resetReport();
    setStatus(label + ' file loaded locally. Select Compare JSON to see differences.');
  } catch {
    setStatus('Could not read the selected ' + label.toLowerCase() + ' file.', true);
  }
}

const sampleBefore = {
  project: 'JSON Diff View',
  version: 1,
  settings: { locale: 'en', theme: 'light', telemetry: false },
  users: [{ id: 1, role: 'viewer' }, { id: 2, role: 'editor' }],
  deprecated: true
};
const sampleAfter = {
  project: 'JSON Diff View',
  version: 2,
  settings: { locale: 'he', theme: 'light', telemetry: false },
  users: [{ id: 1, role: 'editor' }, { id: 2, role: 'editor' }, { id: 3, role: 'viewer' }],
  documentation: 'ready'
};

document.querySelector('#compare').addEventListener('click', compare);
document.querySelector('#swap').addEventListener('click', () => {
  [beforeEditor.value, afterEditor.value] = [afterEditor.value, beforeEditor.value];
  resetReport();
  setStatus('Sides swapped. Select Compare JSON to refresh the report.');
});
document.querySelector('#clear').addEventListener('click', () => {
  beforeEditor.value = '';
  afterEditor.value = '';
  patchSource.value = '';
  resetReport();
  setStatus('Editors cleared.');
  beforeEditor.focus();
});
document.querySelector('#load-sample').addEventListener('click', () => {
  beforeEditor.value = JSON.stringify(sampleBefore, null, 2);
  afterEditor.value = JSON.stringify(sampleAfter, null, 2);
  compare();
});
document.querySelector('#before-file').addEventListener('change', event => {
  void importFile(event.target.files?.[0], beforeEditor, 'Before');
  event.target.value = '';
});
document.querySelector('#after-file').addEventListener('change', event => {
  void importFile(event.target.files?.[0], afterEditor, 'After');
  event.target.value = '';
});

for (const editor of [beforeEditor, afterEditor]) {
  editor.addEventListener('input', () => {
    resetReport();
    setStatus('Document edited. Select Compare JSON to refresh the report.');
  });
}

document.addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    compare();
  }
});

copyButton.addEventListener('click', async () => {
  if (!latestReport) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify({
      format: 'json-diff-view-report',
      counts: latestReport.counts,
      truncated: latestReport.truncated,
      changes: latestReport.changes
    }, null, 2));
    setStatus('Change report copied to clipboard.');
  } catch {
    setStatus('Clipboard access failed. Try using HTTPS or a local web server.', true);
  }
});

copyPatchButton.addEventListener('click', async () => {
  if (!latestPatch) return;
  try {
    await navigator.clipboard.writeText(serializeJsonPatch(latestPatch));
    setStatus('RFC 6902 JSON Patch copied to clipboard.');
  } catch {
    setStatus('Clipboard access failed. Use Download .jsonpatch instead.', true);
  }
});

downloadPatchButton.addEventListener('click', () => {
  if (!latestPatch) return;
  const blob = new Blob([serializeJsonPatch(latestPatch)], {
    type: 'application/json;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'changes.jsonpatch';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});


function patchMessage(message, isError = false) {
  patchStatus.textContent = message;
  patchStatus.classList.toggle('error', isError);
}
function previewPatch() {
  invalidatePatchResult();
  try {
    fitInput(beforeEditor.value, 'Before');
    fitInput(patchSource.value, 'Patch');
    const documentBefore = parseJson(beforeEditor.value, 'Before');
    const operations = parseJson(patchSource.value, 'JSON Patch');
    const transformed = applyJsonPatch(documentBefore, operations);
    const json = JSON.stringify(transformed, null, 2);
    fitInput(json, 'Resulting document');
    lastApplied = { beforeSource: beforeEditor.value, json };
    patchResult.value = json;
    sendResultButton.disabled = false;
    downloadResultButton.disabled = false;
    patchMessage('Patch preview created on a copy of Before. No editor content changed.');
  } catch (error) {
    patchMessage(error instanceof Error ? error.message : 'Unable to apply JSON Patch.', true);
  }
}
document.querySelector('#preview-patch').addEventListener('click', previewPatch);
patchSource.addEventListener('input', () => {
  invalidatePatchResult();
  patchMessage('Patch text changed. Preview again before using the result.');
});
useGeneratedButton.addEventListener('click', () => {
  if (!latestPatch) return;
  patchSource.value = serializeJsonPatch(latestPatch);
  invalidatePatchResult();
  patchMessage('Generated patch copied into the patch editor. Select Preview applying patch.');
});
sendResultButton.addEventListener('click', () => {
  if (!lastApplied) return;
  if (beforeEditor.value !== lastApplied.beforeSource) {
    invalidatePatchResult();
    patchMessage('Before changed. Recalculate the preview before using it.', true);
    return;
  }
  if (afterEditor.value.trim() && afterEditor.value !== lastApplied.json &&
      !confirm('Replace the current After editor with the patch result?')) return;
  afterEditor.value = lastApplied.json;
  resetReport();
  compare();
  patchMessage('Patch result copied into After and both documents compared.');
});
downloadResultButton.addEventListener('click', () => {
  if (!lastApplied) return;
  if (beforeEditor.value !== lastApplied.beforeSource) {
    invalidatePatchResult();
    patchMessage('Before changed. Recalculate the preview before downloading.', true);
    return;
  }
  const blob = new Blob([lastApplied.json + '\n'], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'patched-result.json';
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
