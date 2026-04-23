// One participant's phase-2 contribution to a SEAL circuit's proving key.
// Each independent contributor runs this with their own machine + private
// entropy and passes the output zkey to the next participant. As long as ONE
// contributor is honest and discards their entropy, the setup is sound. This is
// the piece that turns the dev key into a real ceremony.
//
//   node scripts/contribute.mjs <in.zkey> <out.zkey> "<your name>"
//
// Entropy: this prompts via stdin if you pipe it, or generates 64 random bytes
// and mixes in the time + a name. For a real ceremony, type long random text.
import * as snarkjs from "snarkjs";
import { randomBytes } from "node:crypto";

const [, , inZkey, outZkey, name] = process.argv;
if (!inZkey || !outZkey || !name) {
  console.error('usage: node scripts/contribute.mjs <in.zkey> <out.zkey> "<name>"');
  process.exit(1);
}

// best-effort fresh entropy; a real participant should also bang on the keyboard
const entropy = randomBytes(64).toString("hex") + ":" + name + ":" + process.hrtime.bigint().toString();
const hash = await snarkjs.zKey.contribute(inZkey, outZkey, name, entropy);
console.log(`contributed as "${name}"`);
console.log("contribution hash:", Buffer.from(hash).toString("hex").slice(0, 64), "...");
console.log("publish this hash so others can verify your contribution is in the chain.");
console.log(`next participant runs: node scripts/contribute.mjs ${outZkey} <their_out.zkey> "<their name>"`);
