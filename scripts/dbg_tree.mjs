import { Connection, PublicKey } from "@solana/web3.js";
import fs from "node:fs";
const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const PROGRAM = new PublicKey("seuH78RmBPVzoKToLQVEZrDvuL5jDNBSbptozWK9PEm");
const [tree] = PublicKey.findProgramAddressSync([Buffer.from("tree")], PROGRAM);
const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault")], PROGRAM);
const pub = JSON.parse(fs.readFileSync(new URL("../circuits/public.json", import.meta.url)));
const expectRoot = BigInt(pub[0]).toString(16).padStart(64, "0");

const ai = await conn.getAccountInfo(tree);
console.log("tree account exists:", !!ai, "len:", ai?.data?.length);
if (ai) {
  const d = ai.data.subarray(8); // skip disc
  const current_root = d.subarray(0, 32).toString("hex");
  const next_leaf_index = d.readBigUInt64LE(32);
  console.log("next_leaf_index:", next_leaf_index.toString());
  console.log("current_root  :", current_root);
  console.log("expect root   :", expectRoot);
  console.log("MATCH         :", current_root === expectRoot);
  // roots ring: after current_root(32)+nli(8)+filled(32*20)+zeros(32*20)
  const ROOTS_OFF = 32 + 8 + 32*20 + 32*20;
  let found = false;
  for (let i = 0; i < 30; i++) {
    const r = d.subarray(ROOTS_OFF + i*32, ROOTS_OFF + i*32 + 32).toString("hex");
    if (r === expectRoot) found = true;
  }
  console.log("expectRoot in roots[]:", found);
}
const vb = await conn.getBalance(vault);
console.log("vault balance (lamports):", vb);
