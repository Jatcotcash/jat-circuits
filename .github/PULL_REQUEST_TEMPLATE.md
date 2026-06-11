## Summary

What this change does to the circuits or the tooling.

## Soundness

- [ ] Every public input is constrained
- [ ] Commitment scheme and nullifier domains unchanged, or changed in lockstep with
      `jat-program`
- [ ] Public-input order documented and matched in the program and the SDK

## Keys

- [ ] Verifying key re-exported if the circuit changed (`scripts/vk_to_rust.mjs`)
- [ ] Proving-key change, if any, noted as needing a fresh trusted setup

## Testing

- [ ] Compiled the affected circuit
- [ ] Generated a proof and confirmed it verifies
- [ ] `jat-program` host test still reproduces the root, if the tree changed
