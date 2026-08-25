require('dotenv').config();

/**
 * Parses DEVICES env var: "Name|ip|port,Name|ip|port"
 * Returns [{ name, ip, port }]
 */
function loadDevicesFromEnv() {
  const raw = process.env.DEVICES || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, ip, port] = entry.split('|').map((x) => x.trim());
      return { name, ip, port: Number(port) || 4370 };
    });
}

module.exports = { loadDevicesFromEnv };
