import { buildPoseidon } from "circomlibjs";
const poseidon = await buildPoseidon();
const F = poseidon.F;
const H = (a, b) => F.toObject(poseidon([a, b]));
const DEPTH = 4;

// zeros chain
const zeros = [0n];
for (let i = 1; i <= DEPTH; i++) zeros[i] = H(zeros[i - 1], zeros[i - 1]);

// full recompute: leaves at 0..n-1, rest = zero leaf (0n)
function fullRoot(leaves) {
  let level = [];
  const width = 1 << DEPTH;
  for (let i = 0; i < width; i++) level.push(i < leaves.length ? leaves[i] : 0n);
  for (let d = 0; d < DEPTH; d++) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) next.push(H(level[i], level[i + 1]));
    level = next;
  }
  return level[0];
}

// incremental (Tornado filledSubtrees + zeros)
const filled = zeros.slice(0, DEPTH);
let nextIndex = 0;
function insert(leaf) {
  let idx = nextIndex, cur = leaf;
  for (let i = 0; i < DEPTH; i++) {
    let left, right;
    if (idx % 2 === 0) { left = cur; right = zeros[i]; filled[i] = cur; }
    else { left = filled[i]; right = cur; }
    cur = H(left, right);
    idx = Math.floor(idx / 2);
  }
  nextIndex++;
  return cur;
}

const leaves = [11n, 22n, 33n, 44n, 55n];
let ok = true;
for (let n = 1; n <= leaves.length; n++) {
  const inc = insert(leaves[n - 1]);
  const full = fullRoot(leaves.slice(0, n));
  const match = inc === full;
  ok = ok && match;
  console.log(`insert ${n}: incremental=${inc.toString().slice(0,20)}.. full=${full.toString().slice(0,20)}.. ${match ? "MATCH" : "MISMATCH"}`);
}
console.log("OFFCHAIN incremental==full:", ok);
console.log("FINAL_ROOT_DEC", insert.last);
// print final root full for rust compare
console.log("ROOT5_DEC", fullRoot(leaves).toString());
