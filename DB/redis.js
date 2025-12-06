const Redis = require('ioredis');

const redis = new Redis(); // defaults to localhost:6379
// Optional: Redis URL => new Redis("redis://localhost:6379")

redis.on('connect', () => console.log("✅ Redis connected"));
redis.on('error', (err) => console.error("❌ Redis connection error:", err));

module.exports = redis;