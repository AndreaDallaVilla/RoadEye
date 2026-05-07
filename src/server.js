require("dotenv").config();

const app = require("./app");
const connectToDatabase = require("./config/db");

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  await connectToDatabase();

  app.listen(PORT, () => {
    console.log(`RoadEye API listening on port ${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start RoadEye API", error);
  process.exit(1);
});
