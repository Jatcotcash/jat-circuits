// Generate a valid witness for SEAL v2:
//  - leaf = Poseidon(value, label, Poseidon(nullifier, secret)) at index 0
//  - depth-20 incremental tree, leaf at index 0, siblings = empty-subtree zeros
//  - nullifierHash = Poseidon(nullifier, contextHash)
// Writes circuits/input.json (snarkjs proves) and prints the leaf/root so the
// on-chain deposit can be made with the SAME value/label/precommit.

import { buildPoseidon } from "circomlibjs";
import fs from "node:fs";

const DEPTH = 20;
const poseidon = await buildPoseidon();
const F = poseidon.F;
const H = (...xs) => F.toObject(poseidon(xs));

// receipt secrets + the deposit's pinned fields
const value = 5000n;        // real deposited amount (lamports), pinned by program at deposit
const label = 0n;           // = leaf index 0 (program sets label = next_leaf_index)
const secret = 123456789n;
const nullifier = 987654321n;
const threshold = 1000n;     // gate requires >= 1000
const contextHash = 42n;     // the gate's scope id

const precommit = H(nullifier, secret);
const leaf = H(value, label, precommit);

// empty-subtree hashes per level
const zeros = [0n];
for (let i = 1; i <= DEPTH; i++) zeros[i] = H(zeros[i - 1], zeros[i - 1]);

// leaf at index 0 (all-left path); sibling at each level is the empty subtree
let cur = leaf;
const pathElements = [];
const pathIndices = [];
for (let i = 0; i < DEPTH; i++) {
  pathElements.push(zeros[i].toString());
  pathIndices.push("0");
  cur = H(cur, zeros[i]);
}
const merkleRoot = cur;
const nullifierHash = H(nullifier, contextHash);

const input = {
  merkleRoot: merkleRoot.toString(),
  threshold: threshold.toString(),
  contextHash: contextHash.toString(),
  nullifierHash: nullifierHash.toString(),
  value: value.toString(),
  label: label.toString(),
  secret: secret.toString(),
  nullifier: nullifier.toString(),
  pathElements,
  pathIndices,
};

fs.writeFileSync(new URL("../circuits/input.json", import.meta.url), JSON.stringify(input, null, 2));
// deposit.json: what the on-chain deposit must use to mint the SAME leaf/root.
fs.writeFileSync(new URL("../circuits/deposit.json", import.meta.url), JSON.stringify({
  amount: value.toString(),
  label: label.toString(),
  precommit: precommit.toString(),
}, null, 2));
console.log("wrote input.json + deposit.json (depth", DEPTH + ")");
console.log("value        =", value.toString());
console.log("label        =", label.toString());
console.log("precommit    =", precommit.toString());
console.log("leaf         =", leaf.toString());
console.log("merkleRoot   =", merkleRoot.toString());
console.log("nullifierHash=", nullifierHash.toString());
