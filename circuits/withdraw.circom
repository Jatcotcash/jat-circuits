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

template Withdraw(depth) {
    // public
    signal input merkleRoot;
    signal input value;
    signal input recipientHash;
    signal input nullifierHash;
    // private
    signal input label;
    signal input secret;
    signal input nullifier;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    component pc = Poseidon(2);
    pc.inputs[0] <== nullifier;
    pc.inputs[1] <== secret;

    component leaf = Poseidon(3);
    leaf.inputs[0] <== value;
    leaf.inputs[1] <== label;
    leaf.inputs[2] <== pc.out;

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

    // global single-use nullifier (1-input Poseidon, distinct domain from the gate)
    component nf = Poseidon(1);
    nf.inputs[0] <== nullifier;
    nullifierHash === nf.out;

    // recipientHash is a public input that the PROGRAM binds to the real payout
    // account (it checks recipientHash == Poseidon(hi16, lo16) of the recipient
    // pubkey). The circuit only needs to carry it as a public signal; this dummy
    // constraint keeps the compiler from optimizing the input away.
    signal rh2;
    rh2 <== recipientHash * recipientHash;
}

component main {public [merkleRoot, value, recipientHash, nullifierHash]} = Withdraw(20);
