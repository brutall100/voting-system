// Entry point: `npm start` (reads settings from .env when it exists).
const path = require("node:path");
const { openDatabase } = require("./db");
const { createApp } = require("./app");

const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = path.resolve(__dirname, "..", process.env.DB_FILE || "data/votes.db");

const store = openDatabase(DB_FILE);
if (process.env.SEED_SAMPLE_POLLS !== "false") {
  store.seedIfEmpty();
}

const server = createApp(store).listen(PORT, () => {
  console.log(`Voting System is running on http://localhost:${PORT}`);
});

function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
