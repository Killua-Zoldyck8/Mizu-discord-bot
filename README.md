# 🌊 Mizu FLOW Bot

A Discord bot implementing the Mizu clan's FLOW rating system: mutually-agreed duels,
automatic FLOW updates, tiers, and a leaderboard.

## Features

- **`/duel @opponent`** — Challenge someone. They get Accept/Decline buttons.
  If accepted, both players get a 1-minute cooldown, then "I Won" / "I Lost"
  buttons appear. If your answers disagree, FLOW updates automatically and the
  bot announces the winner. If you both click the same button (both "won" or
  both "lost"), nothing changes — the bot flags the conflict.
- **`/addflow @user amount`** and **`/subflow @user amount`** — restricted to
  members with the configured Evaluator role (or server Administrators).
- **`/w @user amount`** and **`/l @user amount`** — evaluator-only, directly
  *sets* (does not add to) a player's win/loss count.
- **`/leaderboard`** — ranked list of everyone's FLOW, paginated 10 at a time.
- **`/flow [@user]`** — check your own FLOW/Tier, or someone else's.
- **`/cancelduel`** — cancels your current duel at any stage (pending accept,
  on cooldown, or waiting on results), so nobody gets stuck waiting on a
  result that isn't coming. Either participant can use it, and so can
  Evaluators.
- **`/setreporttime minutes`** — evaluator-only. Changes how long players get
  to report a result after the cooldown ends (default **7 minutes**, range
  1-30). Only affects duels started after the change.

Tiers match the spec exactly:

| Tier | FLOW |
|---|---|
| 👑 Mizu's Elite | 1000+ |
| 🔴 S Tier | 800+ |
| 🟠 A Tier | 600+ |
| 🟡 B Tier | 400+ |
| 🟢 C Tier | 200+ |
| 🟤 D Tier | 0–200 |

FLOW never drops below 0. The amount won/lost per duel scales with the
pre-duel rating gap between the two players, so a high-FLOW player can't
farm easy wins off much weaker members, and upsets are rewarded:

| FLOW Difference | Higher-rated player wins | Lower-rated player wins |
|---|---:|---:|
| 0–49 | +5 / −3 | +5 / −3 |
| 50–99 | +4 / −4 | +6 / −2 |
| 100–149 | +3 / −5 | +7 / −1 |
| 150–249 | +2 / −6 | +8 / −1 |
| 250+ | +1 / −7 | +8 / −1 |

Tune this in `utils/flowCalculator.js` (the `BRACKETS` array) if you want to
change the numbers or add finer-grained brackets.

## Setup

1. **Create a Discord application & bot**
   - Go to https://discord.com/developers/applications → New Application.
   - Under "Bot", create a bot user and copy its **token**.
   - Under "OAuth2" → "General", copy the **Application (Client) ID**.
   - Under "Bot", enable the **Server Members Intent** (needed to resolve
     roles/usernames reliably).

2. **Invite the bot to your server**
   - OAuth2 → URL Generator → scopes: `bot`, `applications.commands`.
   - Permissions: at minimum `Send Messages`, `Embed Links`, `Read Message History`.
   - Open the generated URL and add the bot to your server.

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Fill in `DISCORD_TOKEN`, `CLIENT_ID`, optionally `GUILD_ID` (for instant
   command registration on one server while testing), and
   `EVALUATOR_ROLE_ID` (the role ID for your Mizu Evaluation Team — right-click
   the role in Discord with Developer Mode on → Copy Role ID).

4. **Install & register commands**
   ```bash
   npm install
   npm run deploy   # registers the slash commands with Discord
   npm start        # runs the bot
   ```

## Data storage

FLOW ratings are stored in `data/flow.json`, written atomically on every
change. That's enough for a single-instance bot. If you outgrow it (multiple
processes, need for concurrent writes, backups, etc.), swap `database.js`
for SQLite or Postgres — every other file only calls `db.getUser()`,
`db.addFlow()`, `db.setFlow()`, and `db.getLeaderboard()`, so the rest of the
bot doesn't need to change.

## Notes on the duel flow

- Pending duels are tracked in memory only (not persisted), so a bot restart
  clears any duel that's mid-flight rather than risking a stale or
  double-counted result.
- A player can't start or be dragged into a second duel while one is already
  pending/in-cooldown/awaiting results.
- If the opponent doesn't respond to the challenge within 60 seconds, or
  either player doesn't report a result within 5 minutes of the cooldown
  ending, the duel is cancelled with no FLOW changes.
