const fs = require("node:fs");
const path = require("node:path");

const appRoot = __dirname;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

const productionEnv = loadEnvFile(path.join(appRoot, ".env.production"));
const sharedEnv = {
  NODE_ENV: "production",
  ...productionEnv
};

delete sharedEnv.PORT;

module.exports = {
  apps: [
    {
      name: "laborledger-api",
      cwd: appRoot,
      script: "pnpm",
      args: "--filter @laborledger/api start:prod",
      env: {
        ...sharedEnv,
        PORT: "4000"
      }
    },
    {
      name: "laborledger-admin",
      cwd: appRoot,
      script: "pnpm",
      args: "--filter @laborledger/admin start",
      env: {
        ...sharedEnv,
        PORT: "3000"
      }
    },
    {
      name: "laborledger-field",
      cwd: appRoot,
      script: "pnpm",
      args: "--filter @laborledger/field start",
      env: {
        ...sharedEnv,
        PORT: "3001"
      }
    }
  ]
};
