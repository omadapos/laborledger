import { spawn } from "node:child_process";

import { loadDotEnvFiles } from "./load-dotenv.mjs";

const defaultDatabaseUrl =
  "postgresql://laborledger:laborledger@localhost:55432/laborledger?schema=public";

const command = process.argv[2];
const args = process.argv.slice(3);
const resolvedCommand =
  process.platform === "win32" && command === "pnpm" ? "pnpm.cmd" : command;

if (!command) {
  process.stderr.write("Missing command to execute.\n");
  process.exit(1);
}

const env = loadDotEnvFiles([".env", ".env.example"]);

const child = spawn(resolvedCommand, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...env,
    DATABASE_URL: env.DATABASE_URL ?? defaultDatabaseUrl
  }
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
