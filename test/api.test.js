// Run with: npm test
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { openDatabase } = require("../server/db");
const { createApp } = require("../server/app");

let server;
let baseUrl;

before(async () => {
  const store = openDatabase(":memory:");
  server = createApp(store).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://localhost:${server.address().port}/api`;
});

after(() => server.close());

// A tiny client that keeps its own cookie, like one browser.
function client() {
  let cookie = "";
  return async (method, url, body) => {
    const res = await fetch(baseUrl + url, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    return { status: res.status, data: await res.json() };
  };
}

async function newPoll(call) {
  const { data } = await call("POST", "/polls", {
    question: "Tea or coffee?",
    options: ["Tea", "Coffee"],
  });
  return data.poll;
}

test("creates a poll with options", async () => {
  const call = client();
  const poll = await newPoll(call);
  assert.equal(poll.question, "Tea or coffee?");
  assert.deepEqual(poll.options.map((o) => o.label), ["Tea", "Coffee"]);
  assert.equal(poll.totalVotes, 0);
});

test("rejects polls without enough options", async () => {
  const call = client();
  const res = await call("POST", "/polls", { question: "Only one?", options: ["Yes", "yes "] });
  assert.equal(res.status, 400);
});

test("the same voter never counts twice", async () => {
  const call = client();
  const poll = await newPoll(call);
  const [tea, coffee] = poll.options;

  await call("PUT", `/polls/${poll.id}/vote`, { optionId: tea.id });
  await call("PUT", `/polls/${poll.id}/vote`, { optionId: tea.id });
  let res = await call("PUT", `/polls/${poll.id}/vote`, { optionId: coffee.id });

  assert.equal(res.data.poll.totalVotes, 1);
  assert.equal(res.data.poll.myVote, coffee.id);

  res = await call("DELETE", `/polls/${poll.id}/vote`);
  assert.equal(res.data.poll.totalVotes, 0);
  assert.equal(res.data.poll.myVote, null);
});

test("different voters are counted separately", async () => {
  const alex = client();
  const sam = client();
  const poll = await newPoll(alex);

  await alex("PUT", `/polls/${poll.id}/vote`, { optionId: poll.options[0].id });
  const res = await sam("PUT", `/polls/${poll.id}/vote`, { optionId: poll.options[0].id });
  assert.equal(res.data.poll.options[0].votes, 2);
});

test("rejects an option from another poll", async () => {
  const call = client();
  const first = await newPoll(call);
  const second = await newPoll(call);
  const res = await call("PUT", `/polls/${first.id}/vote`, { optionId: second.options[0].id });
  assert.equal(res.status, 400);
});

test("unknown poll returns 404", async () => {
  const call = client();
  const res = await call("PUT", "/polls/nope/vote", { optionId: 1 });
  assert.equal(res.status, 404);
});
