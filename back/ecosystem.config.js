/**
 * PM2 ecosystem config. Structured logging, log rotation via pm2-logrotate.
 * Run: pm2 start ecosystem.config.js
 * Log rotation: pm2 install pm2-logrotate (then configure max_size, retain, etc.)
 */
module.exports = {
  apps: [
    {
      name: 'server',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'development' },
      env_production: { NODE_ENV: 'production' },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      max_memory_restart: '500M',
    },
  ],
};
