/**
 * Portable, versioned collection of named manual session snapshots.
 *
 * Contents are already supported editing workspaces; their raw editor text
 * remains opaque. Import never runs, compares, or interprets JSON Patch.
 */
import { parseWorkspace, serializeWorkspace } from './workspace.js';
import {
  MAX_SESSION_SNAPSHOTS, MAX_SESSION_SNAPSHOT_BYTES
} from './session-snapshots.js';

export const MAX_COLLECTION_BYTES = 32 * 1024 * 1024;
const encoder = new TextEncoder();
const FORMAT = 'json-diff-view-snapshot-collection';

function boundedCollection(text) {
  if (typeof text !== 'string' ||
      encoder.encode(text).byteLength > MAX_COLLECTION_BYTES) {
    throw new RangeError('Snapshot collection file exceeds 32 MiB.');
  }
  return text;
}
function validName(name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) {
    throw new TypeError('Each snapshot name must have 1–80 characters.');
  }
  return name.trim();
}
function validatedEntries(entries) {
  if (!Array.isArray(entries) || entries.length < 1 ||
      entries.length > MAX_SESSION_SNAPSHOTS) {
    throw new RangeError('A snapshot collection must contain 1–8 entries.');
  }
  let bytes = 0;
  const result = entries.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new TypeError('Invalid snapshot collection entry.');
    }
    const name = validName(item.name);
    // JSON-stringify only the outer versioned workspace object. Validation
    // parses the inner editor drafts as *strings*, never as JSON documents.
    const workspace = item.workspace;
    if (!workspace || typeof workspace !== 'object' ||
        Array.isArray(workspace)) {
      throw new TypeError('Snapshot collection entry has no workspace.');
    }
    const content = serializeWorkspace(parseWorkspace(JSON.stringify(workspace)));
    bytes += encoder.encode(content).byteLength;
    if (bytes > MAX_SESSION_SNAPSHOT_BYTES) {
      throw new RangeError('Snapshot collection exceeds 24 MiB of workspace data.');
    }
    return { name, content };
  });
  return result;
}
export function serializeSnapshotCollection(entries) {
  if (!Array.isArray(entries)) throw new TypeError('Snapshot list is required.');
  const validated = entries.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        typeof item.content !== 'string') {
      throw new TypeError('Invalid saved snapshot.');
    }
    return {
      name: item.name,
      workspace: JSON.parse(item.content)
    };
  });
  const prepared = validatedEntries(validated);
  const data = {
    format: FORMAT,
    version: 1,
    snapshots: prepared.map(item => ({
      name: item.name,
      workspace: JSON.parse(item.content)
    }))
  };
  let output = JSON.stringify(data, null, 2) + '\n';
  if (encoder.encode(output).byteLength > MAX_COLLECTION_BYTES) {
    output = JSON.stringify(data) + '\n';
  }
  return boundedCollection(output);
}
export function parseSnapshotCollection(text) {
  const data = JSON.parse(boundedCollection(text));
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      data.format !== FORMAT || data.version !== 1) {
    throw new TypeError('Unsupported snapshot collection format or version.');
  }
  return validatedEntries(data.snapshots);
}
