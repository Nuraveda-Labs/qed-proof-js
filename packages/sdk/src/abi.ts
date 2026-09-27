/**
 * A tiny hand-written ABI decoder for exactly the two structs SPEC §8.4 needs (ported from
 * `oss/spec/tools/anchor_check.py`, which uses `eth_abi.decode`). Not a general ABI library:
 * it only decodes a tuple of N-1 static 32-byte-word fields followed by one trailing dynamic
 * field (`bytes` or `string`), which is exactly the shape of the EAS `Attestation` struct and
 * its decoded `data` payload.
 */

export type StaticFieldKind = "bytes32" | "uint64" | "address" | "bool";

function readWord(data: Uint8Array, wordIndex: number): Uint8Array {
  const start = wordIndex * 32;
  return data.subarray(start, start + 32);
}

function decodeStaticField(word: Uint8Array, kind: StaticFieldKind): Uint8Array | bigint | string | boolean {
  switch (kind) {
    case "bytes32":
      return word.slice();
    case "uint64": {
      let v = 0n;
      for (let i = 24; i < 32; i++) v = (v << 8n) | BigInt(word[i]);
      return v;
    }
    case "address": {
      const bytes = word.subarray(12, 32);
      return "0x" + Buffer_toHex(bytes);
    }
    case "bool":
      return word[31] !== 0;
  }
}

function Buffer_toHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

/**
 * Decodes a tuple made of `staticKinds` (each one 32-byte word), followed by exactly one
 * trailing dynamic field of type `bytes` or `string`. `data` is the tuple's own encoding region
 * (offsets inside it are relative to its start), matching how `eth_abi.decode([_ATT], ...)` and
 * the nested `abi_decode(_DATA, data)` call are used in `anchor_check.py`.
 */
export function decodeTupleWithTrailingDynamic(
  data: Uint8Array,
  staticKinds: StaticFieldKind[],
  dynamicKind: "bytes" | "string",
): { statics: Array<Uint8Array | bigint | string | boolean>; dynamic: Uint8Array | string } {
  const statics = staticKinds.map((kind, i) => decodeStaticField(readWord(data, i), kind));
  const offsetWord = readWord(data, staticKinds.length);
  let offset = 0n;
  for (const b of offsetWord) offset = (offset << 8n) | BigInt(b);
  const off = Number(offset);
  const lenWord = data.subarray(off, off + 32);
  let len = 0n;
  for (const b of lenWord) len = (len << 8n) | BigInt(b);
  const length = Number(len);
  const raw = data.subarray(off + 32, off + 32 + length);
  const dynamic = dynamicKind === "string" ? new TextDecoder().decode(raw) : raw.slice();
  return { statics, dynamic };
}

/**
 * Decodes the return value of a function whose Solidity signature returns a single dynamic
 * tuple (as `getAttestation(bytes32) returns (Attestation memory)` does): the outer word is an
 * offset to where the tuple's own head+tail encoding begins.
 */
export function decodeSingleDynamicTupleReturn(
  returnData: Uint8Array,
  staticKinds: StaticFieldKind[],
  dynamicKind: "bytes" | "string",
) {
  const outerOffsetWord = readWord(returnData, 0);
  let outerOffset = 0n;
  for (const b of outerOffsetWord) outerOffset = (outerOffset << 8n) | BigInt(b);
  const tupleStart = Number(outerOffset);
  return decodeTupleWithTrailingDynamic(returnData.subarray(tupleStart), staticKinds, dynamicKind);
}

export function bytesToHex0x(bytes: Uint8Array): string {
  return "0x" + Buffer_toHex(bytes);
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}
