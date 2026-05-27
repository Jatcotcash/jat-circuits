# Security policy

These circuits define what a Jat proof attests to. A soundness bug here is more serious than
a bug in the host code: it can let a proof claim something false that the on-chain verifier
will still accept.

## Scope

- **Soundness.** Every public input must be constrained. `recipientHash` in the withdraw
  circuit is carried as a public signal and bound by the program to the real payout account;
  the circuit keeps a constraint on it so the compiler cannot drop it. A missing constraint
  is a reportable bug.
- **Commitment scheme.** `leaf = Poseidon(value, label, Poseidon(nullifier, secret))` and the
  scoped/global nullifiers must match `jat-program` byte for byte. A hash-domain mismatch is
  a correctness bug; a collision or a domain reuse that lets one nullifier stand in for
  another is a security bug.
- **Trusted setup.** The shipped `*_final.zkey` are a development setup. Groth16 phase-2 is
  sound only if at least one ceremony contributor is honest and destroys their entropy. Until
  the multi-party ceremony in `jat-program/CEREMONY.md` runs, treat every proof as dev-grade.

## Out of scope

- The size of the anonymity set (a function of pool liquidity, not the circuit).
- Powers-of-tau and intermediate keys, which are regenerable and gitignored.

## Reporting

Open a private security advisory on this repository before any public disclosure. Include the
circuit, the signal or constraint involved, and a witness that demonstrates the issue if you
have one.
