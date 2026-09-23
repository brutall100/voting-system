<div align="center">

**English** · [Lietuvių](README.lt.md)

# 🗳️ Voting System

A friendly polling app where everyone gets exactly **one vote per poll**: cast it, change it or take it back.

[**Live demo**](https://brutall100.github.io/voting-system/) · [**Source code**](https://github.com/brutall100/voting-system)

<img src="docs/screenshot.webp" alt="Voting System in light mode: a big 'One person. One vote.' heading, vote counters and lavender ballot cards" width="1200" height="1172">

</div>

<p align="center">
  <img src="docs/screenshot-dark.webp" alt="The same page in dark mode with glowing ballots" width="560" height="547">
  <img src="docs/screenshot-mobile.webp" alt="Ballot cards on a 390px phone screen, light mode" width="195" height="422">
  <img src="docs/screenshot-mobile-dark.webp" alt="Ballot cards on a phone in dark mode with a 'Voted' stamp" width="195" height="422">
</p>

## About

This started as a simple up/down vote counter where you could click a button over and over and the number kept growing. Now it is a small polling app built around one fair rule: **one person, one vote**.

Each poll looks like a paper ballot with a perforated edge. When you vote, a little ballot flies into the card and a rubber **"Voted"** stamp lands on it. In the background, paper ballots float up slowly, like leaves in warm air.

The app runs in two modes:

| Mode | Where | Where the votes are stored |
|---|---|---|
| **Demo mode** | GitHub Pages (the live demo) | In your browser (`localStorage`) |
| **Live server** | Your computer, after `npm start` | In a real SQLite database file |

The page checks for the server by itself. A badge in the top bar tells you which mode you are in.

## Features

- ✅ **One vote per poll.** The database primary key `(poll_id, voter_id)` makes a second vote impossible, so clicking many times still counts once.
- 🔁 **Change your vote.** Pick another answer and your ballot moves; the total stays the same.
- ↩️ **Withdraw your vote.** Take your ballot back completely.
- ➕ **Create polls** with 2 to 6 answers. Empty and duplicate answers are rejected.
- 📊 **Live results** with percentage bars and numbers that count up.
- 🕵️ **Anonymous.** No names or sign-up. Each browser gets a random voter id in an `httpOnly` cookie.
- 🌗 **Light and dark mode.** It follows your system, has a toggle button, remembers your choice and doesn't flash on load.
- 🎈 **Live background** made of floating paper ballots, soft glows and faint lined paper.
- ♿ **Accessible:** "Skip to content" link, visible focus, real `<label>`s, `prefers-reduced-motion` support and WCAG AA contrast.
- 📱 **Works on phones** (tested at 390px, no sideways scrolling).

## Built with

- **HTML, CSS and vanilla JavaScript**, with no framework or build step.
- **Node.js 22** and **Express 5** for the API.
- **SQLite built into Node.js** (`node:sqlite`), so no database server or XAMPP is needed.
- **`node:test`** for the API tests.
- **Playwright** for the screenshots and browser checks.

### Colour palette

| Colour | HEX | Used for |
|---|---|---|
| ![#F4EEFF](https://placehold.co/20x20/F4EEFF/F4EEFF.png) | `#F4EEFF` | Page background (light), text (dark) |
| ![#DCD6F7](https://placehold.co/20x20/DCD6F7/DCD6F7.png) | `#DCD6F7` | Ballot cards and surfaces |
| ![#A6B1E1](https://placehold.co/20x20/A6B1E1/A6B1E1.png) | `#A6B1E1` | Glows and decoration; buttons in dark mode |
| ![#424874](https://placehold.co/20x20/424874/424874.png) | `#424874` | Text and buttons (light) |
| ![#16182B](https://placehold.co/20x20/16182B/16182B.png) | `#16182B` | Dark mode background (a deep shade of `#424874`) |

Contrast was checked with numbers: `#424874` on `#F4EEFF` is **7.7:1**, and on the cards it is **6.2:1**. `#A6B1E1` is too light for text on a light background (1.9:1), so it is only used for glows and decoration there. In dark mode it becomes the button colour (**8.3:1**).

All colours live as CSS variables at the top of [`css/style.css`](css/style.css), so you can swap the palette in a minute.

### Fonts (Google Fonts)

- **Henny Penny** for the logo, the big heading, the numbers and the stamp.
- **Overlock SC** for headings, buttons and ballot questions.
- **Sansation** for body text.

## What I learned

- How to make a rule impossible to break in the database (a composite primary key plus `ON CONFLICT ... DO UPDATE`), instead of only checking it in JavaScript.
- Why SQL queries must use `?` placeholders and never glue user text into the query.
- Keeping one front-end with two back-ends (a server API and a `localStorage` demo) behind the same interface.
- Building a live, animated background that stays fast: only `transform` and `opacity` are animated, and there are fewer particles on phones.
- Theming with CSS variables, dark mode without a flash, and checking contrast with real numbers.
- Writing API tests with the built-in `node:test` runner.

## Run it locally

You need **Node.js 22.5 or newer** ([download](https://nodejs.org/)).

```bash
git clone https://github.com/brutall100/voting-system.git
cd voting-system
npm install
cp .env.example .env    # optional: change the port or database path
npm start
```

Open **http://localhost:3000**. The badge should say **"Live server"**.

The `.env` file has three settings (the defaults work without it):

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `3000` | The port the server listens on |
| `DB_FILE` | `data/votes.db` | Where the SQLite database file is stored |
| `SEED_SAMPLE_POLLS` | `true` | Adds three sample polls when the database is empty |

Other commands:

```bash
npm run dev   # restarts the server when you change a file
npm test      # runs the API tests
```

**Demo mode without a server:** open the site on GitHub Pages or add `?demo` to the address (`http://localhost:3000/?demo`). The votes then stay in your browser only.

> Node 22 prints `ExperimentalWarning: SQLite is an experimental feature`. This is expected and everything still works.

## Project structure

```text
voting-system/
├── index.html            # the page
├── css/
│   └── style.css         # all styles; the palette lives in :root
├── js/
│   ├── theme-init.js     # sets the saved theme before paint (no flash)
│   ├── store.js          # data layer: ServerStore (API) and DemoStore (localStorage)
│   ├── background.js     # floating ballots in the live background
│   ├── effects.js        # theme toggle, ripple, scroll reveal, count-up, toast
│   └── app.js            # renders ballots, voting, "new poll" form
├── images/
│   └── favicon.svg
├── server/
│   ├── server.js         # entry point (npm start)
│   ├── app.js            # Express routes and validation
│   └── db.js             # SQLite schema and queries
├── test/
│   └── api.test.js       # API tests (npm test)
├── docs/                 # screenshots for this README
├── .env.example
├── package.json
└── LICENSE
```

### API

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/health` | Lets the page know the server is running |
| `GET` | `/api/polls` | Lists all polls with results and your vote |
| `POST` | `/api/polls` | Creates a poll: `{ "question": "...", "options": ["A", "B"] }` |
| `PUT` | `/api/polls/:id/vote` | Casts or changes your vote: `{ "optionId": 3 }` |
| `DELETE` | `/api/polls/:id/vote` | Withdraws your vote |

## Credits

- Fonts: [Henny Penny](https://fonts.google.com/specimen/Henny+Penny), [Overlock SC](https://fonts.google.com/specimen/Overlock+SC) and [Sansation](https://fonts.google.com/specimen/Sansation) from Google Fonts (SIL Open Font License).
- [Express](https://expressjs.com/) (MIT).
- Icons and illustrations are hand-made inline SVG.

## License

[MIT](LICENSE) © 2026 brutall100
