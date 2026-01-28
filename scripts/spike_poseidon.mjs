import { buildPoseidon } from "circomlibjs";
const poseidon = await buildPoseidon();
const F = poseidon.F;
const toDec = (x) => F.toObject(x).toString();
const beHex = (decStr) => BigInt(decStr).toString(16).padStart(64, "0");

// (a) single Poseidon(2)
const h2 = toDec(poseidon([1n, 2n]));
console.log("P([1,2]) dec =", h2);
console.log("P([1,2]) be  =", beHex(h2));

// (b) depth-2 root: leaf=P(secret,amount), zeros chain, fold left twice
const H2 = (a, b) => F.toObject(poseidon([a, b]));
const leaf = H2(123456789n, 5000n);
const z0 = 0n;
const z1 = H2(z0, z0);
const l1 = H2(leaf, z0);
const root2 = H2(l1, z1);
console.log("leaf dec     =", leaf.toString());
console.log("root2 dec    =", root2.toString());
console.log("root2 be     =", beHex(root2.toString()));

// (c) 3-input leaf (new design): P(value,label,precommit), precommit=P(nullifier,secret)
const precommit = H2(111n, 222n);
const leaf3 = F.toObject(poseidon([5000n, 7n, precommit]));
console.log("precommit dec=", precommit.toString());
console.log("leaf3 dec    =", leaf3.toString());
