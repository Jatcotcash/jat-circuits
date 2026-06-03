---
name: Bug report
about: A proof that should verify and does not, a witness that should fail and passes, or a hash mismatch
title: "[bug] "
labels: bug
---

## What happened

Describe the incorrect behavior: a proof that fails, a constraint that did not fire, or a
Poseidon output that differs from the on-chain syscall.

## What you expected

What the circuit or script should have produced.

## Reproduction

- Circuit: seal / withdraw
- Script: gen_input / gen_withdraw_input / proof_to_bytes / vk_to_rust
- Inputs used (or a witness), and the snarkjs / circom versions

## Cross-repo

- Does the on-chain root in `jat-program` (`tree_root_matches_proof`) still match?
- Did a public-input order or commitment-scheme change land here without the matching
  program change?
