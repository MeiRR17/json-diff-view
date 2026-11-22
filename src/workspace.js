/**
 * Versioned portable, offline editing workspace.
 *
 * Unlike checkpoint/failure bundles, the three editor contents are raw text:
 * incomplete or invalid JSON drafts must survive a save/restore unchanged.
 * Parsing this file validates shape and size only; it NEVER interprets or
 * executes the JSON text inside an editor.
 */
const MAX_EDITOR_BYTES = 2 * 1024 * 1024;
const MAX_WORKSPACE_BYTES = 8 * 1024 * 1024;
const MAX_OPTION_CHARS = 128;
const encoder = new TextEncoder();

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function boundedText(value, limit, label) {
  if (typeof value !== 'string' || encoder.encode(value).byteLength > limit) {
    throw new TypeError(label + ' must be a string no larger than ' +
      (limit / (1024 * 1024)).toFixed(2) + ' MiB.');
  }
  return value;
}
function workspaceValues(value) {
  if (!object(value) || value.format !== 'json-diff-view-workspace' ||
      value.version !== 1 || !object(value.editors) ||
      !object(value.options)) {
    throw new TypeError('Unsupported workspace format or version.');
  }
  const editors = value.editors, options = value.options;
  const result = {
    beforeText: boundedText(editors.before, MAX_EDITOR_BYTES, 'Before editor'),
    afterText: boundedText(editors.after, MAX_EDITOR_BYTES, 'After editor'),
    patchText: boundedText(editors.patch, MAX_EDITOR_BYTES, 'Patch editor'),
    patchBase: options.patch_base,
    patchDirection: options.patch_direction,
    guardPatch: options.guarded_patch,
    guardRangePatch: options.guarded_range_patch,
    rangeStart: boundedText(options.range_start, MAX_OPTION_CHARS, 'Range start'),
    rangeEnd: boundedText(options.range_end, MAX_OPTION_CHARS, 'Range end'),
    stepCount: boundedText(options.step_count, MAX_OPTION_CHARS, 'Step count')
  };
  if (!['before', 'after'].includes(result.patchBase) ||
      !['forward', 'reverse'].includes(result.patchDirection)) {
    throw new TypeError('Invalid patch base or direction in workspace.');
  }
  if (typeof result.guardPatch !== 'boolean' ||
      typeof result.guardRangePatch !== 'boolean') {
    throw new TypeError('Workspace patch guard settings must be booleans.');
  }
  return result;
}
export function serializeWorkspace(state) {
  const data = {
    format: 'json-diff-view-workspace',
    version: 1,
    editors: {
      before: state.beforeText,
      after: state.afterText,
      patch: state.patchText
    },
    options: {
      patch_base: state.patchBase,
      patch_direction: state.patchDirection,
      guarded_patch: state.guardPatch,
      guarded_range_patch: state.guardRangePatch,
      range_start: state.rangeStart,
      range_end: state.rangeEnd,
      step_count: state.stepCount
    }
  };
  // Do not JSON.parse any editor contents: preserve partial drafts exactly.
  workspaceValues(data);
  let output = JSON.stringify(data, null, 2) + '\n';
  if (encoder.encode(output).byteLength > MAX_WORKSPACE_BYTES) {
    output = JSON.stringify(data) + '\n';
  }
  if (encoder.encode(output).byteLength > MAX_WORKSPACE_BYTES) {
    throw new RangeError('Workspace export exceeds 8 MiB.');
  }
  return output;
}
export function parseWorkspace(text) {
  if (typeof text !== 'string' ||
      encoder.encode(text).byteLength > MAX_WORKSPACE_BYTES) {
    throw new RangeError('Workspace file exceeds 8 MiB.');
  }
  return workspaceValues(JSON.parse(text));
}
