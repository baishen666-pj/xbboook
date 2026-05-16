module.exports = {
  apps: [
    {
      name: "xbboook",
      script: "server/index.ts",
      interpreter: "npx tsx",
      cwd: "./",
      env: {
        NODE_ENV: "production",
      },
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
      max_memory_restart: "500M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "data/logs/pm2-error.log",
      out_file: "data/logs/pm2-out.log",
    },
  ],
};
