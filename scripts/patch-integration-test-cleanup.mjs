#!/usr/bin/env node
/**
 * Maintainer script: wire integration specs to integration-test-db.ts cleanup.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = join(dirname(fileURLToPath(import.meta.url)), "..", "apps", "api", "test");

const helperImport = `import { resetIntegrationDatabase } from "./integration-test-db";`;

const truncateSeedPattern =
  /await prisma\.\$executeRawUnsafe\(`[\s\S]*?RESTART IDENTITY CASCADE;\s*`\);\s*(?:const passwordHash[\s\S]*?;\s*)?await prisma\.user\.(?:create|upsert)\([\s\S]*?\}\);\s*/gu;

for (const fileName of readdirSync(testDir)) {
  if (!fileName.endsWith(".integration.spec.ts")) {
    continue;
  }

  const filePath = join(testDir, fileName);
  let content = readFileSync(filePath, "utf8");

  if (!truncateSeedPattern.test(content)) {
    console.log(`skip ${fileName} (no truncate block)`);
    continue;
  }

  content = readFileSync(filePath, "utf8");

  if (!content.includes('from "./integration-test-db"')) {
    content = content.replace(
      /import \{ AppModule \} from "\.\.\/src\/modules\/app\.module";/u,
      `${helperImport}\n\nimport { AppModule } from "../src/modules/app.module";`
    );
  }

  content = content.replace(truncateSeedPattern, "await resetIntegrationDatabase(prisma);\n\n    ");

  writeFileSync(filePath, content);
  console.log(`patched ${fileName}`);
}
