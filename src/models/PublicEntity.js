const mongoose = require("mongoose");
const User = require("./User");

module.exports = mongoose.model("PublicEntity", User.schema, "entiPubblici");
