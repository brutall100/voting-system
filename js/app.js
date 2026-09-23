// Main app: renders the ballots, handles voting and the "new poll" form.
(function () {
  "use strict";

  const { connectStore, ApiError } = window.VotingStore;
  const { reveal, countTo, showToast, flyBallot } = window.VotingEffects;

  const MIN_OPTIONS = 2;
  const MAX_OPTIONS = 6;

  const grid = document.getElementById("pollGrid");
  const pollTemplate = document.getElementById("pollTemplate");
  const optionTemplate = document.getElementById("optionTemplate");
  const modeBadge = document.getElementById("modeBadge");
  const stats = {
    polls: document.getElementById("statPolls"),
    votes: document.getElementById("statVotes"),
    mine: document.getElementById("statMine"),
  };

  const form = document.getElementById("createForm");
  const questionInput = document.getElementById("question");
  const optionList = document.getElementById("optionInputs");
  const addOptionButton = document.getElementById("addOption");
  const formError = document.getElementById("formError");

  let store;
  let polls = [];

  // ---------- Rendering ----------

  function plural(n, word) {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
  }

  function updateStats() {
    countTo(stats.polls, polls.length);
    countTo(stats.votes, polls.reduce((sum, p) => sum + p.totalVotes, 0));
    countTo(stats.mine, polls.filter((p) => p.myVote !== null).length);
  }

  function createCard(poll, index) {
    const card = pollTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.id = poll.id;
    card.querySelector(".ballot__serial").textContent = `Ballot Nº ${String(index + 1).padStart(2, "0")}`;
    card.querySelector(".ballot__question").textContent = poll.question;

    const list = card.querySelector(".ballot__options");
    for (const option of poll.options) {
      const item = optionTemplate.content.firstElementChild.cloneNode(true);
      const input = item.querySelector(".choice__input");
      input.name = `poll-${poll.id}`;
      input.value = option.id;
      item.dataset.optionId = option.id;
      item.querySelector(".choice__text").textContent = option.label;
      list.appendChild(item);
    }

    const cardForm = card.querySelector(".ballot__form");
    cardForm.addEventListener("change", () => syncButtons(card));
    cardForm.addEventListener("submit", (event) => {
      event.preventDefault();
      castVote(card);
    });
    card.querySelector(".ballot__withdraw").addEventListener("click", () => withdrawVote(card));

    fillCard(card, poll);
    return card;
  }

  // Writes the latest numbers into an existing card.
  function fillCard(card, poll) {
    const total = poll.totalVotes;
    card.querySelector(".ballot__total").textContent = plural(total, "vote");
    card.classList.toggle("has-voted", poll.myVote !== null);

    for (const item of card.querySelectorAll(".choice")) {
      const option = poll.options.find((o) => o.id === Number(item.dataset.optionId));
      const share = total ? option.votes / total : 0;
      const isMine = poll.myVote === option.id;
      const input = item.querySelector(".choice__input");

      item.classList.toggle("is-mine", isMine);
      input.checked = isMine;
      item.querySelector(".choice__count").textContent = `${Math.round(share * 100)}% · ${option.votes}`;
      item.querySelector(".choice__fill").style.transform = `scaleX(${share})`;
    }
    syncButtons(card);
  }

  function syncButtons(card) {
    const poll = polls.find((p) => p.id === card.dataset.id);
    const picked = card.querySelector(".choice__input:checked");
    const pickedId = picked ? Number(picked.value) : null;
    const cast = card.querySelector(".ballot__cast");
    const withdraw = card.querySelector(".ballot__withdraw");

    cast.disabled = pickedId === null || pickedId === poll.myVote;
    cast.querySelector(".btn__label").textContent = poll.myVote === null ? "Cast vote" : "Change vote";
    withdraw.hidden = poll.myVote === null;
  }

  function renderAll() {
    grid.textContent = "";
    if (!polls.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No polls yet. Start the first one below!";
      grid.appendChild(empty);
    }
    polls.forEach((poll, index) => grid.appendChild(createCard(poll, index)));
    grid.setAttribute("aria-busy", "false");
    reveal(grid.querySelectorAll(".reveal"));
    updateStats();
  }

  function replacePoll(updated) {
    polls = polls.map((p) => (p.id === updated.id ? updated : p));
    const card = grid.querySelector(`[data-id="${CSS.escape(updated.id)}"]`);
    if (card) fillCard(card, updated);
    updateStats();
  }

  // ---------- Actions ----------

  async function withBusy(card, action) {
    card.classList.add("is-busy");
    card.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try {
      await action();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : "Could not reach the server. Try again.");
      if (!(error instanceof ApiError)) console.warn(error);
    } finally {
      card.classList.remove("is-busy");
      card.querySelector(".ballot__withdraw").disabled = false;
      syncButtons(card);
    }
  }

  function castVote(card) {
    const picked = card.querySelector(".choice__input:checked");
    if (!picked) return;
    const hadVote = card.classList.contains("has-voted");
    const button = card.querySelector(".ballot__cast");

    withBusy(card, async () => {
      const updated = await store.vote(card.dataset.id, Number(picked.value));
      flyBallot(button, card.querySelector(".ballot__head"));
      replacePoll(updated);
      restamp(card);
      showToast(hadVote ? "Your vote was moved." : "Ballot in the box. Thanks for voting!");
    });
  }

  function withdrawVote(card) {
    withBusy(card, async () => {
      const updated = await store.withdraw(card.dataset.id);
      replacePoll(updated);
      showToast("Your vote was withdrawn.");
    });
  }

  // Replays the stamp animation after every cast.
  function restamp(card) {
    const stamp = card.querySelector(".ballot__stamp");
    stamp.classList.remove("is-pressed");
    void stamp.offsetWidth;
    stamp.classList.add("is-pressed");
  }

  // ---------- New poll form ----------

  function addOptionField(value = "") {
    const index = optionList.children.length + 1;
    const item = document.createElement("li");
    item.className = "option-input";

    const id = `option-${Date.now().toString(36)}-${index}`;
    const label = document.createElement("label");
    label.className = "visually-hidden";
    label.htmlFor = id;
    label.textContent = `Answer ${index}`;

    const input = document.createElement("input");
    input.type = "text";
    input.id = id;
    input.maxLength = 60;
    input.autocomplete = "off";
    input.placeholder = `Answer ${index}`;
    input.value = value;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "option-input__remove";
    remove.setAttribute("aria-label", `Remove answer ${index}`);
    remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    remove.addEventListener("click", () => {
      item.remove();
      renumberOptions();
      optionList.querySelector("input")?.focus();
    });

    item.append(label, input, remove);
    optionList.appendChild(item);
    renumberOptions();
    return input;
  }

  function renumberOptions() {
    const items = [...optionList.children];
    items.forEach((item, i) => {
      item.querySelector("label").textContent = `Answer ${i + 1}`;
      item.querySelector("input").placeholder = `Answer ${i + 1}`;
      const remove = item.querySelector("button");
      remove.setAttribute("aria-label", `Remove answer ${i + 1}`);
      remove.hidden = items.length <= MIN_OPTIONS;
    });
    addOptionButton.hidden = items.length >= MAX_OPTIONS;
  }

  function resetForm() {
    form.reset();
    optionList.textContent = "";
    for (let i = 0; i < MIN_OPTIONS; i++) addOptionField();
  }

  function formProblem(question, options) {
    if (!question) return "Please write a question.";
    const unique = new Set(options.map((o) => o.toLowerCase()));
    if (unique.size !== options.length) return "Two answers are the same. Make each one different.";
    if (options.length < MIN_OPTIONS) return `Add at least ${MIN_OPTIONS} answers.`;
    return "";
  }

  addOptionButton.addEventListener("click", () => addOptionField().focus());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = questionInput.value.replace(/\s+/g, " ").trim();
    const options = [...optionList.querySelectorAll("input")]
      .map((input) => input.value.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const problem = formProblem(question, options);
    formError.textContent = problem;
    questionInput.setAttribute("aria-invalid", String(!question));
    if (problem) return;

    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const poll = await store.createPoll(question, options);
      polls.unshift(poll);
      renderAll();
      resetForm();
      showToast("Your poll is open for votes.");
      const card = grid.querySelector(`[data-id="${CSS.escape(poll.id)}"]`);
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.querySelector(".choice__input").focus({ preventScroll: true });
    } catch (error) {
      formError.textContent = error instanceof ApiError ? error.message : "Could not reach the server. Try again.";
    } finally {
      submit.disabled = false;
    }
  });

  // ---------- Start ----------

  async function start() {
    resetForm();
    store = await connectStore();
    modeBadge.dataset.mode = store.mode;
    modeBadge.textContent = store.mode === "server" ? "Live server" : "Demo mode";
    modeBadge.title =
      store.mode === "server"
        ? "Votes are saved in the SQLite database on the server."
        : "No server here: votes are saved in this browser only.";

    try {
      polls = await store.listPolls();
    } catch (error) {
      polls = [];
      showToast("Could not load the polls.");
    }
    renderAll();
  }

  start();
})();
