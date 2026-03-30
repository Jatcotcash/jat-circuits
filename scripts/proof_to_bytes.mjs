// Convert snarkjs proof.json + public.json into the byte arrays groth16-solana
// expects: proof_a [64], proof_b [128], proof_c [64], and public inputs [[32];N].
// Note: groth16-solana (Light) expects proof_a to be NEGATED (the verifier does
// the standard -A pairing trick by taking A as given negated). We output both
// raw and negated; the host test uses negated (Light convention).
import fs from "node:fs";

// args (cwd-relative): [proofJson] [publicJson] [outJson]; defaults = seal gate.
const PROOF = process.argv[2] || "circuits/proof.json";
const PUBLIC = process.argv[3] || "circuits/public.json";
const OUT = process.argv[4] || "circuits/proof_bytes.json";

const proof = JSON.parse(fs.readFileSync(PROOF));
const pub = JSON.parse(fs.readFileSync(PUBLIC));

const Q = 21888242871839275222246405745257275088696311157297823662689037894645226208583n;
const be32 = (dec) => {
  const h = BigInt(dec).toString(16).padStart(64, "0");
  const o = [];
  for (let i = 0; i < 64; i += 2) o.push(parseInt(h.slice(i, i + 2), 16));
  return o;
};
// G1 point [x,y] -> 64 bytes
const g1 = (p) => [...be32(p[0]), ...be32(p[1])];
// negate G1: y -> Q - y
const g1neg = (p) => [...be32(p[0]), ...be32((Q - (BigInt(p[1]) % Q)) % Q)];
// G2 [[x0,x1],[y0,y1]] -> [x1,x0,y1,y0] (128 bytes)
const g2 = (p) => [...be32(p[0][1]), ...be32(p[0][0]), ...be32(p[1][1]), ...be32(p[1][0])];

const out = {
  proof_a: g1neg(proof.pi_a),       // negated (Light convention)
  proof_a_raw: g1(proof.pi_a),
  proof_b: g2(proof.pi_b),
  proof_c: g1(proof.pi_c),
  public_inputs: pub.map(be32),     // [merkleRoot, threshold, contextHash, nullifierHash]
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`wrote ${OUT} (public inputs: ${pub.length})`);
