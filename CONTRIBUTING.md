# Contributing to jat-circuits

These are the Circom circuits and the tooling that turns them into a verifying key the
on-chain program checks. A change here usually means a matching change in `jat-program`
(the baked verifying key) and sometimes in `jat-sdk` (proof generation).

## The invariant that matters

The circuit's Poseidon and the program's `sol_poseidon` syscall must stay byte-identical.
`leaf = Poseidon(value, label, Poseidon(nullifier, secret))` has to hash the same on both
sides, or a valid proof will fail on-chain. The spikes in `jat-circuits` and the host test
in `jat-program` (`tree_root_matches_proof`) exist to catch any drift. Run them after any
change to the commitment scheme, the tree depth, or the public-input order.

## Building

```bash
npm install
npm run compile:withdraw       # circom -> r1cs + wasm + sym
node scripts/gen_withdraw_input.mjs
node scripts/proof_to_bytes.mjs
node scripts/vk_to_rust.mjs    # export the verifying key for jat-program
```

Powers-of-tau (`*.ptau`) and intermediate `*_0/_1.zkey` files are gitignored because they
are large and regenerable. Final proving keys and verifying keys are kept.

## Changing a circuit

- If you change the public inputs, change them in the same order in `jat-program`'s
  `seal_verify` / `withdraw` and in the SDK's proof call. The order is load-bearing.
- Re-export the verifying key (`scripts/vk_to_rust.mjs`) and commit it alongside the circuit
  change so the program and the proof match in one PR.
- A change to the proving key needs a fresh trusted setup. For mainnet that means the
  multi-party ceremony in `jat-program/CEREMONY.md`, not a local setup.

## Style

- Keep templates small and composed (`MerkleLevel`, `Seal`, `Withdraw`). Constrain every
  signal; a public input the circuit does not constrain can be optimized away.
- Comment the privacy meaning of a signal, not the Circom syntax.

See the PR template before opening a pull request.
