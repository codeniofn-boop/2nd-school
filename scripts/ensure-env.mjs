// Copies .env.example -> .env if .env doesn't exist yet, so `npm run setup`
// works on a fresh clone without manual steps.
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = join(root, ".env");
if (!existsSync(env)) {
  copyFileSync(join(root, ".env.example"), env);
  console.log("Created .env from .env.example");
}
