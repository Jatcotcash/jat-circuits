// Witness for the SEAL withdraw circuit: claim leaf 0 (the deposit) to a bound
// recipient. Reuses the deposit secrets so it proves the SAME leaf that is in the
// on-chain tree. Writes circuits/withdraw_input.json + circuits/withdraw_meta.json.

import { buildPoseidon } from "circomlibjs";
import { PublicKey } from "@solana/web3.js";
import fs from "node:fs";

const DEPTH = 20;
const RECIPIENT = "DvzryBT4zhMd8H4PTc7K3iHMj6HTeHZjzZ9J4bhiQCUr";

const poseidon = await buildPoseidon();
const F = poseidon.F;
const H = (...xs) => F.toObject(poseidon(xs));

// same secrets as the deposit (gen_input.mjs)
const value = 5000n;
const label = 0n;
const secret = 123456789n;
const nullifier = 987654321n;

const precommit = H(nullifier, secret);
const leaf = H(value, label, precommit);

const zeros = [0n];
for (let i = 1; i <= DEPTH; i++) zeros[i] = H(zeros[i - 1], zeros[i - 1]);
let cur = leaf;
const pathElements = [], pathIndices = [];
for (let i = 0; i < DEPTH; i++) {
  pathElements.push(zeros[i].toString());
  pathIndices.push("0");
  cur = H(cur, zeros[i]);
}
const merkleRoot = cur;

// global withdraw nullifier (1-input Poseidon)
const nullifierHash = F.toObject(poseidon([nullifier]));

// recipientHash = Poseidon(hi16, lo16) of the recipient pubkey bytes (BE)
const rb = new PublicKey(RECIPIENT).toBytes(); // 32 bytes
const hi = BigInt("0x" + Buffer.from(rb.slice(0, 16)).toString("hex"));
const lo = BigInt("0x" + Buffer.from(rb.slice(16, 32)).toString("hex"));
const recipientHash = H(hi, lo);

const input = {
  merkleRoot: merkleRoot.toString(),
  value: value.toString(),
  recipientHash: recipientHash.toString(),
  nullifierHash: nullifierHash.toString(),
  label: label.toString(),
  secret: secret.toString(),
  nullifier: nullifier.toString(),
  pathElements,
  pathIndices,
};
fs.writeFileSync(new URL("../circuits/withdraw_input.json", import.meta.url), JSON.stringify(input, null, 2));
fs.writeFileSync(new URL("../circuits/withdraw_meta.json", import.meta.url), JSON.stringify({
  recipient: RECIPIENT,
  value: value.toString(),
  recipientHash: recipientHash.toString(),
  nullifierHash: nullifierHash.toString(),
  merkleRoot: merkleRoot.toString(),
}, null, 2));
console.log("wrote withdraw_input.json + withdraw_meta.json");
console.log("recipient    =", RECIPIENT);
console.log("value        =", value.toString());
console.log("recipientHash=", recipientHash.toString());
console.log("nullifierHash=", nullifierHash.toString());
console.log("merkleRoot   =", merkleRoot.toString());
