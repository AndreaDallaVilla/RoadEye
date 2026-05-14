const mongoose = require("mongoose"); //libreria che fornisce un'interfaccia JavaScript per definire schemi, modelli e interagire con MongoDB in modo strutturato.
const User = require("./User");

module.exports = mongoose.model("PublicEntity", User.schema, "entiPubblici");
