import { Connection, Keypair, PublicKey, SystemProgram, ComputeBudgetProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { createHash } from "node:crypto";
import fs from "node:fs";
const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const PROGRAM = new PublicKey("seuH78RmBPVzoKToLQVEZrDvuL5jDNBSbptozWK9PEm");
// Set SEAL_WALLET to your keypair JSON path. No path is hardcoded so nothing about
// the local machine or key-storage layout is committed.
const WALLET = process.env.SEAL_WALLET;
if (!WALLET) { console.error("set SEAL_WALLET=/path/to/keypair.json"); process.exit(1); }
const payer = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(WALLET))));
const disc = (n) => createHash("sha256").update(`global:${n}`).digest().subarray(0,8);
const be32 = (d) => Buffer.from(BigInt(d).toString(16).padStart(64,"0"),"hex");
const u64le = (d) => { const b=Buffer.alloc(8); b.writeBigUInt64LE(BigInt(d)); return b; };
const dep = JSON.parse(fs.readFileSync(new URL("../circuits/deposit.json", import.meta.url)));
const [tree] = PublicKey.findProgramAddressSync([Buffer.from("tree")], PROGRAM);
const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault")], PROGRAM);
const data = Buffer.concat([disc("deposit"), u64le(dep.amount), be32(dep.precommit)]);
const ix = new TransactionInstruction({ programId: PROGRAM, keys: [
  { pubkey: tree, isSigner:false, isWritable:true },
  { pubkey: vault, isSigner:false, isWritable:true },
  { pubkey: payer.publicKey, isSigner:true, isWritable:true },
  { pubkey: SystemProgram.programId, isSigner:false, isWritable:false },
], data });
const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({units:600000})).add(ix);
tx.feePayer = payer.publicKey;
tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
tx.sign(payer);
const sim = await conn.simulateTransaction(tx);
console.log("sim err:", JSON.stringify(sim.value.err));
console.log("sim unitsConsumed:", sim.value.unitsConsumed);
(sim.value.logs || []).forEach(l => console.log(" | " + l));
