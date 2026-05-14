require("dotenv").config();

const mongoose = require("mongoose");
const connectToDatabase = require("../config/db");

async function ensureCollection(db, name) {
  const collections = await db.listCollections({ name }).toArray();

  if (collections.length === 0) {
    await db.createCollection(name);
    console.log(`Created collection: ${name}`);
    return;
  }

  console.log(`Collection already exists: ${name}`);
}

async function initDatabase() {
  await connectToDatabase();

  const db = mongoose.connection.db;

  await ensureCollection(db, "users");
  await ensureCollection(db, "reports");

  console.log(`Database ready: ${db.databaseName}`);
}

initDatabase()
  .catch((error) => {
    console.error("Failed to initialize database", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
