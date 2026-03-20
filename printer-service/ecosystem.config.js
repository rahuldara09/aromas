module.exports = {
  apps: [{
    name: "aroma-printer-service",
    script: "./server.js",
    watch: false,
    env: {
      NODE_ENV: "production",
    },
    error_file: "logs/err.log",
    out_file: "logs/out.log",
    log_file: "logs/combined.log",
    time: true
  }]
}
