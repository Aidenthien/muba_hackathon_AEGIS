/**
 * Minimal reader for the Sui transaction JSON that `tx.toJSON()` emits
 * (serialization version 2). Just enough to show the user what they are about
 * to authorize, before the agent's verdict arrives.
 *
 * Pure inputs are base64 BCS bytes: a u64 is 8 little-endian bytes and an
 * address is 32 bytes, so length alone disambiguates the two we care about.
 */

const MIST_PER_SUI = 1_000_000_000n;

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToHex(bytes) {
  let s = "0x";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

function readU64LE(bytes) {
  let v = 0n;
  for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(bytes[i]);
  return v;
}

function pureBytes(input) {
  if (!input || !input.Pure || typeof input.Pure.bytes !== "string") return null;
  try {
    return b64ToBytes(input.Pure.bytes);
  } catch {
    return null;
  }
}

/** Resolves an argument that points at a Pure input holding an address. */
function resolveAddress(arg, inputs) {
  if (!arg || typeof arg.Input !== "number") return null;
  const bytes = pureBytes(inputs[arg.Input]);
  return bytes && bytes.length === 32 ? bytesToHex(bytes) : null;
}

/** Resolves an argument that points at a Pure input holding a u64. */
function resolveU64(arg, inputs) {
  if (!arg || typeof arg.Input !== "number") return null;
  const bytes = pureBytes(inputs[arg.Input]);
  return bytes && bytes.length === 8 ? readU64LE(bytes) : null;
}

export function formatSui(mist) {
  const n = Number(mist) / Number(MIST_PER_SUI);
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function shortAddress(addr, lead = 6, tail = 4) {
  if (!addr || addr.length <= lead + tail + 1) return addr || "";
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`;
}

/**
 * @param {string} json  the string from `tx.toJSON()`
 * @returns {{
 *   ok: boolean,
 *   error?: string,
 *   sender: string|null,
 *   commandCount: number,
 *   operations: string[],
 *   moveCalls: { package: string, module: string, function: string, target: string }[],
 *   recipients: string[],
 *   splitTotalMist: bigint,
 *   unresolvedObjects: string[],
 * }}
 */
export function summarizeTransaction(json) {
  const empty = {
    ok: false,
    sender: null,
    commandCount: 0,
    operations: [],
    moveCalls: [],
    recipients: [],
    splitTotalMist: 0n,
    unresolvedObjects: [],
  };

  let tx;
  try {
    tx = JSON.parse(json);
  } catch {
    return { ...empty, error: "Transaction payload is not valid JSON." };
  }

  const inputs = Array.isArray(tx.inputs) ? tx.inputs : [];
  const commands = Array.isArray(tx.commands) ? tx.commands : [];

  const operations = [];
  const moveCalls = [];
  const recipients = [];
  const unresolvedObjects = [];
  let splitTotalMist = 0n;

  for (const command of commands) {
    if (!command || typeof command !== "object") continue;
    const kind = Object.keys(command)[0];
    const body = command[kind];

    switch (kind) {
      case "SplitCoins": {
        const amounts = Array.isArray(body.amounts) ? body.amounts : [];
        for (const a of amounts) {
          const v = resolveU64(a, inputs);
          if (v != null) splitTotalMist += v;
        }
        operations.push("SplitCoins");
        break;
      }
      case "TransferObjects": {
        const to = resolveAddress(body.address, inputs);
        if (to && !recipients.includes(to)) recipients.push(to);
        operations.push("TransferObjects");
        break;
      }
      case "MoveCall": {
        const target = `${body.package}::${body.module}::${body.function}`;
        moveCalls.push({
          package: body.package,
          module: body.module,
          function: body.function,
          target,
        });
        operations.push("MoveCall");
        break;
      }
      default:
        operations.push(kind);
    }
  }

  for (const input of inputs) {
    if (input && input.UnresolvedObject && input.UnresolvedObject.objectId) {
      unresolvedObjects.push(input.UnresolvedObject.objectId);
    }
  }

  return {
    ok: true,
    sender: tx.sender ?? null,
    commandCount: commands.length,
    operations,
    moveCalls,
    recipients,
    splitTotalMist,
    unresolvedObjects,
  };
}
