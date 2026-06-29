module.exports = {
  apps: [
    {
      name: "laborledger-api",
      cwd: "/home/ubuntu/apps/laborledger",
      script: "pnpm",
      args: "--filter @laborledger/api start:prod",
      env: {
        NODE_ENV: "production",
        PORT: "4000"
      }
    },
    {
      name: "laborledger-admin",
      cwd: "/home/ubuntu/apps/laborledger",
      script: "pnpm",
      args: "--filter @laborledger/admin start",
      env: {
        NODE_ENV: "production",
        PORT: "3000"
      }
    },
    {
      name: "laborledger-field",
      cwd: "/home/ubuntu/apps/laborledger",
      script: "pnpm",
      args: "--filter @laborledger/field start",
      env: {
        NODE_ENV: "production",
        PORT: "3001"
      }
    }
  ]
};
