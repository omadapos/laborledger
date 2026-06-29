#!/usr/bin/env node

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = join(dirname(fileURLToPath(import.meta.url)), "..", "apps", "api", "test");

for (const fileName of readdirSync(testDir)) {
  if (!fileName.endsWith(".integration.spec.ts")) {
    continue;
  }

  const filePath = join(testDir, fileName);
  let content = readFileSync(filePath, "utf8");
  const usesArgon2 = /argon2\./u.test(content);
  const usesGlobalRole = /\bGlobalRole\b/u.test(content.replace(/import[\s\S]*?from "@prisma\/client";/u, ""));

  if (!usesArgon2) {
    content = content.replace(/\nimport \* as argon2 from "argon2";/u, "");
  }

  if (!usesGlobalRole) {
    content = content.replace(/, GlobalRole/u, "");
    content = content.replace(/GlobalRole, /u, "");
    content = content.replace(/\{ GlobalRole \} from "@prisma\/client";\n/u, "");
  }

  const usesLocalArgon2Options = /ARGON2_OPTIONS/u.test(
    content.replace(/const ARGON2_OPTIONS = \{[\s\S]*?\} as const;\n\n?/u, "")
  );

  if (usesArgon2 && !usesLocalArgon2Options) {
    content = content.replace(/const ARGON2_OPTIONS = \{[\s\S]*?\} as const;\n\n?/u, "");
    if (!content.includes("ARGON2_OPTIONS")) {
      content = content.replace(
        /import \{ resetIntegrationDatabase \} from "\.\/integration-test-db";/u,
        'import { ARGON2_OPTIONS, resetIntegrationDatabase } from "./integration-test-db";'
      );
    }
  }

  if (!usesArgon2) {
    content = content.replace(/const ARGON2_OPTIONS = \{[\s\S]*?\} as const;\n\n?/u, "");
  }

  writeFileSync(filePath, content);
  console.log(`fixed imports ${fileName}`);
}
