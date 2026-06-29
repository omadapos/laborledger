import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..", "..");

describe("repository foundation", () => {
  it("has all version 1 shell applications", () => {
    expect(existsSync(resolve(root, "apps/admin/package.json"))).toBe(true);
    expect(existsSync(resolve(root, "apps/field/package.json"))).toBe(true);
    expect(existsSync(resolve(root, "apps/api/package.json"))).toBe(true);
  });

  it("includes prisma baseline migration", () => {
    expect(
      existsSync(
        resolve(
          root,
          "packages/database/prisma/migrations/0001_repository_foundation/migration.sql"
        )
      )
    ).toBe(true);
  });

  it("includes production PM2 orchestration", () => {
    expect(existsSync(resolve(root, "ecosystem.config.cjs"))).toBe(true);
  });

  it("does not include legacy kiosk/worker apps", () => {
    expect(existsSync(resolve(root, "apps/kiosk"))).toBe(false);
    expect(existsSync(resolve(root, "apps/worker"))).toBe(false);
  });
});
