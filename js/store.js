// Data layer with one interface and two back-ends:
//  - ServerStore talks to the Node.js API (when you run `npm start`).
//  - DemoStore keeps everything in localStorage (GitHub Pages, no server).
// Both return polls in the same shape:
//   { id, question, createdAt, options: [{ id, label, votes }], totalVotes, myVote }

(function () {
  "use strict";

  const DEMO_KEY = "voting-system:demo-v1";

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

  class ApiError extends Error {}

  // ---------- Server ----------

  class ServerStore {
    constructor() {
      this.mode = "server";
    }

    async request(method, url, body) {
      const res = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(data.error || "The server did not answer.");
      return data;
    }

    async listPolls() {
      return (await this.request("GET", "api/polls")).polls;
    }

    async createPoll(question, options) {
      return (await this.request("POST", "api/polls", { question, options })).poll;
    }

    async vote(pollId, optionId) {
      return (await this.request("PUT", `api/polls/${encodeURIComponent(pollId)}/vote`, { optionId })).poll;
    }

    async withdraw(pollId) {
      return (await this.request("DELETE", `api/polls/${encodeURIComponent(pollId)}/vote`)).poll;
    }
  }

  // ---------- Demo (browser only) ----------

  class DemoStore {
    constructor() {
      this.mode = "demo";
      this.polls = this.load();
    }

    load() {
      try {
        const saved = JSON.parse(localStorage.getItem(DEMO_KEY));
        if (Array.isArray(saved)) return saved;
      } catch (e) {
        /* ignore broken or blocked storage */
      }
      return this.seed();
    }

    save() {
      try {
        localStorage.setItem(DEMO_KEY, JSON.stringify(this.polls));
      } catch (e) {
        /* storage blocked: data lives until the page is closed */
      }
    }

    seed() {
      let optionId = 1;
      const now = Date.now();
      const polls = SAMPLE_POLLS.map((sample, i) => ({
        id: newId(),
        question: sample.question,
        createdAt: new Date(now - i * 60000).toISOString(),
        options: sample.options.map((label, j) => ({ id: optionId++, label, votes: sample.votes[j] })),
        myVote: null,
      }));
      this.polls = polls;
      this.save();
      return polls;
    }

    find(pollId) {
      const poll = this.polls.find((p) => p.id === pollId);
      if (!poll) throw new ApiError("Poll not found.");
      return poll;
    }

    view(poll) {
      const copy = JSON.parse(JSON.stringify(poll));
      copy.totalVotes = copy.options.reduce((sum, o) => sum + o.votes, 0);
      return copy;
    }

    async listPolls() {
      return this.polls.map((p) => this.view(p));
    }

    async createPoll(question, options) {
      let nextId = Math.max(0, ...this.polls.flatMap((p) => p.options.map((o) => o.id))) + 1;
      const poll = {
        id: newId(),
        question,
        createdAt: new Date().toISOString(),
        options: options.map((label) => ({ id: nextId++, label, votes: 0 })),
        myVote: null,
      };
      this.polls.unshift(poll);
      this.save();
      return this.view(poll);
    }

    // Same rule as the database: one ballot per voter per poll.
    async vote(pollId, optionId) {
      const poll = this.find(pollId);
      const target = poll.options.find((o) => o.id === optionId);
      if (!target) throw new ApiError("This option is not part of the poll.");
      if (poll.myVote !== optionId) {
        const previous = poll.options.find((o) => o.id === poll.myVote);
        if (previous) previous.votes -= 1;
        target.votes += 1;
        poll.myVote = optionId;
        this.save();
      }
      return this.view(poll);
    }

    async withdraw(pollId) {
      const poll = this.find(pollId);
      const previous = poll.options.find((o) => o.id === poll.myVote);
      if (previous) previous.votes -= 1;
      poll.myVote = null;
      this.save();
      return this.view(poll);
    }
  }

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  // Uses the real server when it answers, otherwise the demo store.
  async function connectStore() {
    // Static hosting has no API, so skip the check (and its 404) right away.
    const staticHost = location.protocol === "file:" || location.hostname.endsWith("github.io");
    if (staticHost || new URLSearchParams(location.search).has("demo")) {
      return new DemoStore();
    }
    try {
      const res = await fetch("api/health", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.mode === "server") return new ServerStore();
    } catch (e) {
      /* no server (GitHub Pages or file://) */
    }
    return new DemoStore();
  }

  window.VotingStore = { connectStore, ApiError };
})();
