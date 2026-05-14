require("dotenv").config();

const mongoose = require("mongoose");
const connectToDatabase = require("../config/db");
const User = require("../models/User");
const PublicEntity = require("../models/PublicEntity");

async function syncUserIndexes() {
  await connectToDatabase();
  const syncedUserIndexes = await User.syncIndexes();
  const syncedEntityIndexes = await PublicEntity.syncIndexes();

  console.log("Sincronizzazione indici completata.");
  if (syncedUserIndexes.length > 0 || syncedEntityIndexes.length > 0) {
    if (syncedUserIndexes.length > 0) {
      console.log("Indici users rimossi:", syncedUserIndexes.join(", "));
    }
    if (syncedEntityIndexes.length > 0) {
      console.log("Indici entiPubblici rimossi:", syncedEntityIndexes.join(", "));
    }
  } else {
    console.log("Nessun indice obsoleto rimosso.");
  }

  const currentUserIndexes = await User.collection.indexes();
  console.log("Indici attuali users:");
  for (const index of currentUserIndexes) {
    console.log(`- ${index.name}`);
  }
  const currentEntityIndexes = await PublicEntity.collection.indexes();
  console.log("Indici attuali entiPubblici:");
  for (const index of currentEntityIndexes) {
    console.log(`- ${index.name}`);
  }
}

syncUserIndexes()
  .catch((error) => {
    console.error("Sync indici fallita:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
