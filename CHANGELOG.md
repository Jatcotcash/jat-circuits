# Changelog

All notable changes to the Jat circuits are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- Documentation pass to use the Jat brand.

## [0.3.0] - 2026-05-26

### Added

- Withdraw circuit: membership proof that reveals the exact value, binds a public
  `recipientHash`, and exposes a one-input global nullifier (`Poseidon(nullifier)`).
- `gen_withdraw_input.mjs`, `withdraw` verifying-key export, and devnet end-to-end script.

## [0.2.0] - 2026-03-31

### Added

- Gate circuit (`seal`): Merkle inclusion under a recent root, `value >= threshold` range
  gate (64-bit), and a context-scoped nullifier `Poseidon(nullifier, contextHash)`.
- `proof_to_bytes.mjs` to convert a snarkjs proof into the on-chain byte layout, and
  `vk_to_rust.mjs` to export the verifying key for the program.

## [0.1.0] - 2026-02-08

### Added

- Poseidon commitment helpers and tree spikes, matched byte for byte against the Solana
  Poseidon syscall (`spike_poseidon.mjs`, `spike_tree.mjs`).
- Initial Circom setup, input generation, and the `MerkleLevel` template.
