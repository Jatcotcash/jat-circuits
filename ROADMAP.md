# Roadmap

## Shipped

- [x] Poseidon commitment helpers, byte-identical to the Solana syscall
- [x] Incremental Merkle tree spike matching the on-chain insert
- [x] `MerkleLevel` template and the gate circuit (`seal`)
- [x] 64-bit `value >= threshold` range gate
- [x] Context-scoped nullifier `Poseidon(nullifier, contextHash)`
- [x] Withdraw circuit: exact value, recipient binding, global nullifier
- [x] Proof to on-chain byte conversion (`proof_to_bytes.mjs`)
- [x] Verifying-key export to Rust for `jat-program`
- [x] Trusted-setup contribution script for the ceremony
- [x] Devnet end-to-end script
