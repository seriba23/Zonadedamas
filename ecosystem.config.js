const path = require('path');
  const fs = require('fs');

  function loadEnv(filepath) {
    const env = {};
    if (!fs.existsSync(filepath)) return env;
    const raw = fs.readFileSync(filepath, 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") &&
  value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
    return env;
  }

  const apiEnv = loadEnv('/home/siliba/apps/api/.env');
  const webEnv = loadEnv('/home/siliba/apps/web/.env');

  module.exports = {
    apps: [
      {
        name: 'siliba-api',
        cwd: '/home/siliba/apps/api',
        script: 'dist/src/main.js',
        instances: 1,
        exec_mode: 'fork',
        env: { NODE_ENV: 'production', PORT: 3001, ...apiEnv },
        max_memory_restart: '512M',
        error_file: '/home/siliba/logs/api-error.log',
        out_file: '/home/siliba/logs/api-out.log',
        time: true,
      },
      {
        name: 'siliba-web',
        cwd: '/home/siliba/apps/web',
        script: 'node_modules/next/dist/bin/next',
        args: 'start -p 3000',
        instances: 1,
        exec_mode: 'fork',
        env: { NODE_ENV: 'production', PORT: 3000, ...webEnv },
        max_memory_restart: '512M',
        error_file: '/home/siliba/logs/web-error.log',
        out_file: '/home/siliba/logs/web-out.log',
        time: true,
      },
    ],
  };
