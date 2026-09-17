const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'flow.json');

/**
 * FlowDB is a tiny JSON-file-backed store for FLOW ratings.
 *
 * Structure on disk:
 * {
 *   "users": {
 *     "<discordUserId>": { "flow": 0, "wins": 0, "losses": 0, "username": "last-seen-name" }
 *   }
 * }
 *
 * Writes are synchronous and atomic (write to a temp file, then rename)
 * so a crash mid-write can't corrupt the store. This is plenty robust
 * for a single-process Discord bot; if you ever shard across processes,
 * swap this for SQLite/Postgres instead.
 */
class FlowDB {
  constructor() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) {
      this.data = { users: {}, settings: {} };
      this._save();
    } else {
      try {
        this.data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (!this.data.users) this.data.users = {};
        if (!this.data.settings) this.data.settings = {};
      } catch (err) {
        console.error('Failed to parse flow.json, starting fresh. Error:', err);
        this.data = { users: {}, settings: {} };
        this._save();
      }
    }

    // Default report window: 7 minutes. Evaluators can change this with
    // /setreporttime; it's persisted here so it survives restarts.
    if (typeof this.data.settings.reportTimeoutMinutes !== 'number') {
      this.data.settings.reportTimeoutMinutes = 7;
      this._save();
    }
  }

  _save() {
    const tmpFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmpFile, DATA_FILE);
  }

  /** Ensures a user record exists and returns it (does not persist by itself). */
  _record(userId) {
    if (!this.data.users[userId]) {
      this.data.users[userId] = { flow: 0, wins: 0, losses: 0, username: null };
    }
    return this.data.users[userId];
  }

  /** Get a user's record, creating it with 0 FLOW if new. Optionally cache their display name. */
  getUser(userId, username = null) {
    const rec = this._record(userId);
    if (username && rec.username !== username) {
      rec.username = username;
      this._save();
    }
    return { ...rec };
  }

  /**
   * Adjusts a user's FLOW by `delta` (can be negative). FLOW is floored at 0,
   * matching the D Tier band of 0-200. Returns the updated record.
   */
  addFlow(userId, delta, { win, loss } = {}) {
    const rec = this._record(userId);
    rec.flow = Math.max(0, rec.flow + delta);
    if (win) rec.wins += 1;
    if (loss) rec.losses += 1;
    this._save();
    return { ...rec };
  }

  /** Directly sets FLOW to an exact value (floored at 0). Used by /addflow and /subflow. */
  setFlow(userId, value) {
    const rec = this._record(userId);
    rec.flow = Math.max(0, value);
    this._save();
    return { ...rec };
  }

  /** Directly sets (replaces, does not add to) a user's win count. Used by /w. */
  setWins(userId, value) {
    const rec = this._record(userId);
    rec.wins = Math.max(0, value);
    this._save();
    return { ...rec };
  }

  /** Directly sets (replaces, does not add to) a user's loss count. Used by /l. */
  setLosses(userId, value) {
    const rec = this._record(userId);
    rec.losses = Math.max(0, value);
    this._save();
    return { ...rec };
  }

  /** Returns [ [userId, record], ... ] sorted by FLOW descending. */
  getLeaderboard() {
    return Object.entries(this.data.users).sort((a, b) => b[1].flow - a[1].flow);
  }

  /** How many minutes players currently get to report a duel result. */
  getReportTimeoutMinutes() {
    return this.data.settings.reportTimeoutMinutes;
  }

  /** Milliseconds equivalent of getReportTimeoutMinutes(), for setTimeout/collector use. */
  getReportTimeoutMs() {
    return this.data.settings.reportTimeoutMinutes * 60 * 1000;
  }

  /** Sets the report window (in minutes) for duels started from now on. */
  setReportTimeoutMinutes(minutes) {
    this.data.settings.reportTimeoutMinutes = minutes;
    this._save();
    return minutes;
  }
}

module.exports = new FlowDB();
