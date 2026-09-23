// Database layer: SQLite built into Node.js 22+ (node:sqlite).
// Every query uses ? placeholders, never string concatenation.
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS polls (
    id         TEXT PRIMARY KEY,
    question   TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS options (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id  TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    label    TEXT NOT NULL,
    position INTEGER NOT NULL
  );

  -- One voter can hold exactly one vote per poll: the primary key enforces it.
  CREATE TABLE IF NOT EXISTS votes (
    poll_id    TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    voter_id   TEXT NOT NULL,
    option_id  INTEGER NOT NULL REFERENCES options(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (poll_id, voter_id)
  );
`;

const SAMPLE_POLLS = [
  {
    question: "Which pizza should we order for Friday?",
    options: ["Margherita", "Pepperoni", "Four cheese", "Hawaiian"],
    votes: [3, 5, 2, 1],
  },
  {
    question: "Best time for the weekly team meeting?",
    options: ["Monday morning", "Wednesday lunch", "Friday afternoon"],
    votes: [2, 6, 1],
  },
  {
    question: "Should the office get a coffee machine upgrade?",
    options: ["Yes, please!", "No, it is fine"],
    votes: [9, 2],
  },
];

function openDatabase(file = ":memory:") {
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return createStore(db);
}

function createStore(db) {
  const stmt = {
    allPolls: db.prepare("SELECT id, question, created_at FROM polls ORDER BY created_at DESC, rowid DESC"),
    pollById: db.prepare("SELECT id, question, created_at FROM polls WHERE id = ?"),
    pollExists: db.prepare("SELECT 1 FROM polls WHERE id = ?"),
    optionsOf: db.prepare(`
      SELECT o.id, o.label, COUNT(v.voter_id) AS votes
      FROM options o LEFT JOIN votes v ON v.option_id = o.id
      WHERE o.poll_id = ?
      GROUP BY o.id ORDER BY o.position`),
    myVote: db.prepare("SELECT option_id FROM votes WHERE poll_id = ? AND voter_id = ?"),
    optionInPoll: db.prepare("SELECT 1 FROM options WHERE id = ? AND poll_id = ?"),
    insertPoll: db.prepare("INSERT INTO polls (id, question) VALUES (?, ?)"),
    insertOption: db.prepare("INSERT INTO options (poll_id, label, position) VALUES (?, ?, ?)"),
    upsertVote: db.prepare(`
      INSERT INTO votes (poll_id, voter_id, option_id) VALUES (?, ?, ?)
      ON CONFLICT (poll_id, voter_id)
      DO UPDATE SET option_id = excluded.option_id, created_at = datetime('now')`),
    deleteVote: db.prepare("DELETE FROM votes WHERE poll_id = ? AND voter_id = ?"),
    countPolls: db.prepare("SELECT COUNT(*) AS n FROM polls"),
  };

  function getPoll(id, voterId) {
    const poll = stmt.pollById.get(id);
    return poll ? withDetails(poll, voterId) : null;
  }

  function withDetails(poll, voterId) {
    const options = stmt.optionsOf.all(poll.id).map((o) => ({ ...o }));
    const mine = voterId ? stmt.myVote.get(poll.id, voterId) : undefined;
    return {
      id: poll.id,
      question: poll.question,
      createdAt: poll.created_at,
      options,
      totalVotes: options.reduce((sum, o) => sum + o.votes, 0),
      myVote: mine ? mine.option_id : null,
    };
  }

  function transaction(fn) {
    db.exec("BEGIN");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }

  const store = {
    listPolls(voterId) {
      return stmt.allPolls.all().map((p) => withDetails(p, voterId));
    },

    getPoll,

    createPoll(question, labels) {
      const id = randomUUID();
      transaction(() => {
        stmt.insertPoll.run(id, question);
        labels.forEach((label, i) => stmt.insertOption.run(id, label, i));
      });
      return id;
    },

    // Returns false when the poll or the option does not exist.
    castVote(pollId, voterId, optionId) {
      if (!stmt.optionInPoll.get(optionId, pollId)) return false;
      stmt.upsertVote.run(pollId, voterId, optionId);
      return true;
    },

    removeVote(pollId, voterId) {
      return stmt.deleteVote.run(pollId, voterId).changes > 0;
    },

    pollExists(pollId) {
      return Boolean(stmt.pollExists.get(pollId));
    },

    seedIfEmpty() {
      if (stmt.countPolls.get().n > 0) return;
      transaction(() => {
        SAMPLE_POLLS.forEach((sample, p) => {
          const id = randomUUID();
          db.prepare("INSERT INTO polls (id, question, created_at) VALUES (?, ?, datetime('now', ?))")
            .run(id, sample.question, `-${p} minutes`);
          sample.options.forEach((label, i) => {
            const { lastInsertRowid } = stmt.insertOption.run(id, label, i);
            for (let n = 0; n < sample.votes[i]; n++) {
              stmt.upsertVote.run(id, `sample-${randomUUID()}`, lastInsertRowid);
            }
          });
        });
      });
    },

    close() {
      db.close();
    },
  };

  return store;
}

module.exports = { openDatabase, SAMPLE_POLLS };
