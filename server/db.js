// ===================================================================
// اتصال به دیتابیس PostgreSQL (روی Neon یا هر هاست دیگه).
// آدرس اتصال از فایل .env (متغیر DATABASE_URL) خونده می‌شه.
// اگه هنوز DATABASE_URL تنظیم نشده باشه، سرور بالا میاد ولی بخش‌های
// دیتابیسی API یه خطای واضح برمی‌گردونن (نه کرش می‌کنه، نه داده‌ی قلابی).
// ===================================================================

const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

let pool = null;
if (connectionString) {
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Neon و بیشتر هاست‌های رایگان نیاز به SSL دارن
  });
}

async function ensureSchema() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  // آواتار: عدد ۰ تا ۷، مهره‌ی پیش‌فرض انتخابی کاربر (ستون جدید رو فقط اگه نبود اضافه می‌کنه)
  await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar INT DEFAULT 0;`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS games (
      id SERIAL PRIMARY KEY,
      white_name TEXT NOT NULL,
      black_name TEXT NOT NULL,
      result TEXT NOT NULL CHECK (result IN ('white','black','draw')),
      played_at TIMESTAMP DEFAULT NOW()
    );
  `);
  // برای «تماشای بازی»: حرکت‌های بازی (آرایه‌ی SAN به‌صورت JSON) و دلیل پایان — ستون‌های جدید فقط اگه نبودن اضافه می‌شن
  await pool.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS moves TEXT;`);
  await pool.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS reason TEXT;`);
  console.log("✅ جدول‌های دیتابیس چک/ساخته شدن");
}

module.exports = {
  pool,
  ensureSchema,
  isConnected: () => !!pool,
};
