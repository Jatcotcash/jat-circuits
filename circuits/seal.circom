pragma circom 2.1.6;

// SEAL v2: proof-of-receipt over a real deposit-pool commitment.
// Proves: "I hold the secrets to a receipt leaf that the SEAL program minted in
// its on-chain Merkle tree (so its `value` is a real deposited amount), that
// value >= threshold, and here is a context-scoped single-use nullifier."
//
// Public:  merkleRoot, threshold, contextHash, nullifierHash
// Private: value, label, secret, nullifier, pathElements[depth], pathIndices[depth]
//
// precommit = Poseidon(nullifier, secret)         -- opens only to the holder
// leaf      = Poseidon(value, label, precommit)   -- value+label pinned by the program at deposit
// null      = Poseidon(nullifier, contextHash)    -- scoped nullifier (one-use per gate)
//
// The on-chain program computes the SAME leaf with the SAME Poseidon (sol_poseidon
// == light-poseidon == circomlib, verified byte-identical) and inserts it into an
// incremental Merkle tree, so a passing membership proof means the value is real.

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/mux1.circom";

// One level of a Merkle proof: hash current node with its sibling, ordered by
// pathIndex (0 = current is left, 1 = current is right).
template MerkleLevel() {
    signal input cur;
    signal input sibling;
    signal input index;   // 0 or 1
    signal output out;

    index * (index - 1) === 0;

    component muxL = Mux1();
    component muxR = Mux1();
    muxL.c[0] <== cur;     muxL.c[1] <== sibling; muxL.s <== index;
    muxR.c[0] <== sibling; muxR.c[1] <== cur;     muxR.s <== index;

    component h = Poseidon(2);
    h.inputs[0] <== muxL.out;
    h.inputs[1] <== muxR.out;
    out <== h.out;
}

template Seal(depth) {
    // public
    signal input merkleRoot;
    signal input threshold;
    signal input contextHash;
    signal input nullifierHash;
    // private
    signal input value;
    signal input label;
    signal input secret;
    signal input nullifier;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    // precommit = Poseidon(nullifier, secret)
    component pc = Poseidon(2);
    pc.inputs[0] <== nullifier;
    pc.inputs[1] <== secret;

    // leaf = Poseidon(value, label, precommit)  (3-input; value+label program-pinned)
    component leaf = Poseidon(3);
    leaf.inputs[0] <== value;
    leaf.inputs[1] <== label;
    leaf.inputs[2] <== pc.out;

    // Merkle inclusion: fold leaf up the path, must equal merkleRoot
    component levels[depth];
    signal cur[depth + 1];
    cur[0] <== leaf.out;
    for (var i = 0; i < depth; i++) {
        levels[i] = MerkleLevel();
        levels[i].cur <== cur[i];
        levels[i].sibling <== pathElements[i];
        levels[i].index <== pathIndices[i];
        cur[i + 1] <== levels[i].out;
    }
    merkleRoot === cur[depth];

    // scoped nullifier = Poseidon(nullifier, contextHash)
    component nf = Poseidon(2);
    nf.inputs[0] <== nullifier;
    nf.inputs[1] <== contextHash;
    nullifierHash === nf.out;

    // value >= threshold  (range gate, 64-bit amounts / lamports)
    component ge = GreaterEqThan(64);
    ge.in[0] <== value;
    ge.in[1] <== threshold;
    ge.out === 1;
}
