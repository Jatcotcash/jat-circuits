// SEAL v2 FULL e2e (repeatable real client). Fresh secrets each run:
//   init_tree (if needed) -> deposit a fixed denomination (real lamports in,
//   leaf minted in the on-chain Poseidon tree) -> rebuild the Merkle path from
//   on-chain state -> snarkjs-prove the gate -> seal_verify (zk receipt, gate
//   opens) -> replay rejected -> snarkjs-prove the withdraw -> withdraw (exact
//   value paid out of the vault to a bound recipient) -> replay rejected ->
//   a non-denomination deposit is rejected.

import {
  Connection, Keypair, PublicKey, SystemProgram, ComputeBudgetProgram,
  Transaction, TransactionInstruction, sendAndConfirmTransaction,
} from "@solana/web3.js";
import { buildPoseidon } from "circomlibjs";
import { createHash, randomBytes } from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";

const RPC = "https://api.devnet.solana.com";
const PROGRAM = new PublicKey("seuH78RmBPVzoKToLQVEZrDvuL5jDNBSbptozWK9PEm");
const conn = new Connection(RPC, "confirmed");
const ROOT = process.cwd(); // run from the seal/ project root

const DEPTH = 20;
const DENOM = 100_000_000n; // 0.1 SOL, a valid denomination (also > rent-exempt)
const THRESHOLD = 1n;

// Fee payer / depositor keypair. Set SEAL_WALLET to your keypair path, or drop a
// funded devnet keypair at ./deploy-wallet.json (gitignored). Never commit a key.
const WALLET = process.env.SEAL_WALLET || "./deploy-wallet.json";
const payer = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(WALLET))));
const recipient = Keypair.generate(); // ephemeral payout target

const poseidon = await buildPoseidon();
const F = poseidon.F;
const H = (...xs) => F.toObject(poseidon(xs));

const disc = (n) => createHash("sha256").update(`global:${n}`).digest().subarray(0, 8);
const be32 = (v) => Buffer.from(BigInt(v).toString(16).padStart(64, "0"), "hex");
const u64le = (v) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(v)); return b; };
const bufDec = (buf) => BigInt("0x" + buf.toString("hex")).toString();
const rnd = () => BigInt("0x" + randomBytes(24).toString("hex"));

const [treeState] = PublicKey.findProgramAddressSync([Buffer.from("tree")], PROGRAM);
const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault")], PROGRAM);

async function send(ixs, label) {
  const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 600000 }));
  (Array.isArray(ixs) ? ixs : [ixs]).forEach((i) => tx.add(i));
  try {
    const sig = await sendAndConfirmTransaction(conn, tx, [payer], { commitment: "confirmed" });
    console.log(`  ${label}: OK  ${sig}`);
    return { ok: true, sig };
  } catch (e) {
    let logs = e.logs;
    if (!logs && typeof e.getLogs === "function") { try { logs = await e.getLogs(conn); } catch {} }
    const reason = (logs || []).find((l) => /Error|failed|already in use/i.test(l)) || (e.message || "").split("\n")[0];
    console.log(`  ${label}: FAIL  ${String(reason).slice(0, 90)}`);
    return { ok: false, err: e };
  }
}

function parseTree(data) {
  const d = data.subarray(8);
  const currentRoot = d.subarray(0, 32);
  const n = Number(d.readBigUInt64LE(32));
  const filled = [], zeros = [];
  const FOFF = 40, ZOFF = 40 + 32 * DEPTH;
  for (let i = 0; i < DEPTH; i++) {
    filled.push(d.subarray(FOFF + i * 32, FOFF + i * 32 + 32));
    zeros.push(d.subarray(ZOFF + i * 32, ZOFF + i * 32 + 32));
  }
  return { currentRoot, n, filled, zeros };
}

function prove(circuitDir, wasm, zkey, input, tag) {
  const inPath = `circuits/${tag}_in.json`;
  const proofPath = `circuits/${tag}_p.json`;
  const pubPath = `circuits/${tag}_pub.json`;
  const bytesPath = `circuits/${tag}_bytes.json`;
  fs.writeFileSync(`${ROOT}/${inPath}`, JSON.stringify(input));
  execSync(`npx snarkjs groth16 fullprove ${inPath} ${wasm} ${zkey} ${proofPath} ${pubPath}`, { cwd: ROOT, stdio: "pipe" });
  execSync(`node scripts/proof_to_bytes.mjs ${proofPath} ${pubPath} ${bytesPath}`, { cwd: ROOT, stdio: "pipe" });
  return JSON.parse(fs.readFileSync(`${ROOT}/${bytesPath}`));
}

console.log("program  :", PROGRAM.toBase58());
console.log("payer    :", payer.publicKey.toBase58());
console.log("recipient:", recipient.publicKey.toBase58(), "(ephemeral)");

// 0. ensure tree
let ai = await conn.getAccountInfo(treeState);
if (!ai) {
  console.log("\n[0] init_tree");
  await send(new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      { pubkey: treeState, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: disc("init_tree"),
  }), "init_tree");
  ai = await conn.getAccountInfo(treeState);
}

// fresh receipt
const secret = rnd(), nullifier = rnd(), contextHash = rnd();
const pre = parseTree(ai.data);
const n = pre.n;
const label = BigInt(n);
const precommit = H(nullifier, secret);
const leaf = H(DENOM, label, precommit);
console.log(`\nfresh leaf at index ${n}, denom ${DENOM} lamports`);

// [1] deposit
console.log("\n[1] deposit (valid denomination)");
const dep = await send(new TransactionInstruction({
  programId: PROGRAM,
  keys: [
    { pubkey: treeState, isSigner: false, isWritable: true },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data: Buffer.concat([disc("deposit"), u64le(DENOM), be32(precommit)]),
}), "deposit");

// rebuild Merkle path for the just-appended rightmost leaf from pre-deposit state
const pathElements = [], pathIndices = [];
for (let i = 0; i < DEPTH; i++) {
  const bit = (n >> i) & 1;
  pathIndices.push(bit);
  pathElements.push(bit ? bufDec(pre.filled[i]) : bufDec(pre.zeros[i]));
}
// fold to root (must equal the on-chain root after deposit)
let cur = leaf;
for (let i = 0; i < DEPTH; i++) {
  const sib = BigInt(pathElements[i]);
  cur = pathIndices[i] === 0 ? H(cur, sib) : H(sib, cur);
}
const post = parseTree((await conn.getAccountInfo(treeState)).data);
const onchainRoot = BigInt("0x" + post.currentRoot.toString("hex"));
console.log("  off-chain root == on-chain root:", cur === onchainRoot ? "YES" : "NO");
const merkleRoot = cur;

// [2] gate proof + seal_verify
console.log("\n[2] prove + seal_verify (zk receipt gate)");
const nfGate = H(nullifier, contextHash);
const gateBytes = prove("seal_js", "circuits/seal_js/seal.wasm", "circuits/seal_final.zkey", {
  merkleRoot: merkleRoot.toString(), threshold: THRESHOLD.toString(),
  contextHash: contextHash.toString(), nullifierHash: nfGate.toString(),
  value: DENOM.toString(), label: label.toString(), secret: secret.toString(), nullifier: nullifier.toString(),
  pathElements, pathIndices: pathIndices.map(String),
}, "gate");
const [nfRecord] = PublicKey.findProgramAddressSync([Buffer.from("nf"), be32(contextHash), be32(nfGate)], PROGRAM);
const gateIx = () => new TransactionInstruction({
  programId: PROGRAM,
  keys: [
    { pubkey: treeState, isSigner: false, isWritable: false },
    { pubkey: nfRecord, isSigner: false, isWritable: true },
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data: Buffer.concat([disc("seal_verify"), Buffer.from(gateBytes.proof_a), Buffer.from(gateBytes.proof_b), Buffer.from(gateBytes.proof_c),
    be32(merkleRoot), be32(THRESHOLD), be32(contextHash), be32(nfGate)]),
});
const g1 = await send(gateIx(), "seal_verify #1 (gate opens)");
const g2 = await send(gateIx(), "seal_verify #2 (replay -> reject)");

// [3] withdraw proof + payout
console.log("\n[3] prove + withdraw (trustless payout)");
const nfW = H(nullifier);
const rb = recipient.publicKey.toBytes();
const recipientHash = H(BigInt("0x" + Buffer.from(rb.slice(0, 16)).toString("hex")), BigInt("0x" + Buffer.from(rb.slice(16, 32)).toString("hex")));
const wBytes = prove("withdraw_js", "circuits/withdraw_js/withdraw.wasm", "circuits/withdraw_final.zkey", {
  merkleRoot: merkleRoot.toString(), value: DENOM.toString(),
  recipientHash: recipientHash.toString(), nullifierHash: nfW.toString(),
  label: label.toString(), secret: secret.toString(), nullifier: nullifier.toString(),
  pathElements, pathIndices: pathIndices.map(String),
}, "wd");
const [wNf] = PublicKey.findProgramAddressSync([Buffer.from("wnf"), be32(nfW)], PROGRAM);
const wIx = () => new TransactionInstruction({
  programId: PROGRAM,
  keys: [
    { pubkey: treeState, isSigner: false, isWritable: false },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: recipient.publicKey, isSigner: false, isWritable: true },
    { pubkey: wNf, isSigner: false, isWritable: true },
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data: Buffer.concat([disc("withdraw"), Buffer.from(wBytes.proof_a), Buffer.from(wBytes.proof_b), Buffer.from(wBytes.proof_c),
    be32(merkleRoot), be32(DENOM), be32(recipientHash), be32(nfW)]),
});
const before = await conn.getBalance(recipient.publicKey);
const w1 = await send(wIx(), "withdraw #1 (payout)");
const delta = (await conn.getBalance(recipient.publicKey)) - before;
console.log("  recipient balance delta:", delta, "lamports (expect", Number(DENOM) + ")");
const w2 = await send(wIx(), "withdraw #2 (replay -> reject)");

// [4] denomination enforcement
console.log("\n[4] deposit a NON-denomination amount -> should reject");
const bad = await send(new TransactionInstruction({
  programId: PROGRAM,
  keys: [
    { pubkey: treeState, isSigner: false, isWritable: true },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data: Buffer.concat([disc("deposit"), u64le(DENOM + 1n), be32(precommit)]),
}), "deposit (bad denom)");

console.log("\n=== RESULT ===");
const pass = dep.ok && cur === onchainRoot && g1.ok && !g2.ok && w1.ok && delta === Number(DENOM) && !w2.ok && !bad.ok;
console.log("deposit (denom) committed:", dep.ok ? "YES" : "NO");
console.log("on-chain Poseidon tree root matches off-chain:", cur === onchainRoot ? "YES" : "NO");
console.log("zk gate opened:", g1.ok ? "YES" : "NO");
console.log("gate replay rejected:", !g2.ok ? "YES" : "NO");
console.log("withdraw paid exactly the denom:", w1.ok && delta === Number(DENOM) ? "YES" : "NO");
console.log("withdraw replay rejected:", !w2.ok ? "YES" : "NO");
console.log("non-denomination deposit rejected:", !bad.ok ? "YES" : "NO");
console.log(pass ? "\nSEAL v2 FULL e2e on devnet: PASS" : "\nSEAL v2 e2e: SOME CHECK FAILED");
