'use strict';

const session = require('express-session');
const { createHash } = require('node:crypto');
const TTL_MS = 2 * 60 * 60 * 1000;

// Share sessions across restarts/instances; never persist bearer IDs in clear.
class PostgresSessionStore extends session.Store {
  constructor(pool) {
    super();
    this.pool = pool;
    this.initialization = null;
    this.pruneTimer = null;
  }

  ready() {
    if (!this.initialization) {
      this.initialization = this.pool.query(`
        CREATE TABLE IF NOT EXISTS admin_sessions (
          sid_hash TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL
        )
      `).then(() => this.pool.query(
        'CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions(expires_at)'
      )).then(() => {
        this.pruneTimer = setInterval(() => {
          this.pool.query('DELETE FROM admin_sessions WHERE expires_at <= NOW()')
            .catch(() => console.error('ADMIN_SESSION_CLEANUP_ERROR'));
        }, 15 * 60 * 1000);
        this.pruneTimer.unref();
      }).catch(error => {
        this.initialization = null;
        throw error;
      });
    }
    return this.initialization;
  }

  key(sid) {
    return createHash('sha256').update(sid).digest('hex');
  }

  expiry(value) {
    const declared = value.cookie?.expires ? new Date(value.cookie.expires).getTime() : NaN;
    return new Date(Math.min(Number.isFinite(declared) ? declared : Date.now() + TTL_MS,
      Date.now() + TTL_MS));
  }

  execute(work, callback) {
    this.ready().then(work).then(value => callback(null, value), error => callback(error));
  }

  get(sid, callback) {
    this.execute(async () => {
      const result = await this.pool.query(
        'SELECT data FROM admin_sessions WHERE sid_hash=$1 AND expires_at>NOW()',
        [this.key(sid)]
      );
      return result.rows[0]?.data || null;
    }, callback);
  }

  set(sid, value, callback) {
    this.execute(() => this.pool.query(`
      INSERT INTO admin_sessions(sid_hash,data,expires_at) VALUES($1,$2::jsonb,$3)
      ON CONFLICT(sid_hash) DO UPDATE SET data=EXCLUDED.data,expires_at=EXCLUDED.expires_at
    `, [this.key(sid), JSON.stringify(value), this.expiry(value)]), callback);
  }

  touch(sid, value, callback) {
    this.execute(() => this.pool.query(
      'UPDATE admin_sessions SET expires_at=$2 WHERE sid_hash=$1 AND expires_at>NOW()',
      [this.key(sid), this.expiry(value)]
    ), callback);
  }

  destroy(sid, callback) {
    this.execute(() => this.pool.query(
      'DELETE FROM admin_sessions WHERE sid_hash=$1', [this.key(sid)]
    ), callback);
  }

  stop() {
    clearInterval(this.pruneTimer);
  }
}

module.exports = { PostgresSessionStore };
