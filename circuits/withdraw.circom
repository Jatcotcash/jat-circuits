pragma circom 2.1.6;

// SEAL v2 withdraw: prove ownership of a pool leaf and claim its exact value to a
// bound recipient, consuming a global single-use nullifier.
//
// Public:  merkleRoot, value, recipientHash, nullifierHash
// Private: label, secret, nullifier, pathElements[depth], pathIndices[depth]
//
// leaf = Poseidon(value, label, Poseidon(nullifier, secret))   (same as deposit)
// nullifierHash = Poseidon(nullifier)                          (global, one withdraw per leaf)
// value is PUBLIC: the program pays exactly this out of the vault.
// recipientHash is PUBLIC and bound by the program to the real payout account
// (program checks recipientHash == Poseidon(hi16, lo16) of the recipient pubkey),
// so a relayer/front-runner cannot redirect the payout without a new proof.

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/mux1.circom";

template MerkleLevel() {
    signal input cur;
    signal input sibling;
    signal input index;
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
