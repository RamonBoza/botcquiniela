import { neon } from '@neondatabase/serverless';

type QueryRow = Record<string, unknown>;

function postgresSql(source: string) {
  let parameter = 0;
  return source
    .replace(/\?/g, () => `$${++parameter}`)
    .replace(/\bAS\s+([a-z]+[A-Z][A-Za-z0-9]*)/g, 'AS "$1"');
}

class PreparedStatement {
  private values: unknown[] = [];
  constructor(private readonly source: string) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  async all<T extends QueryRow>() { const rows = await client().query(postgresSql(this.source), this.values); return { results: rows as T[] }; }
  async first<T extends QueryRow>() { const rows = await client().query(postgresSql(this.source), this.values); return ((rows as Record<string, unknown>[])[0] as T | undefined) ?? null; }
  async run() { await client().query(postgresSql(this.source), this.values); return { success: true }; }
}

let sqlClient: ReturnType<typeof neon> | null = null;
function client() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Falta DATABASE_URL. Conecta una base de datos Postgres al proyecto de Vercel.');
  sqlClient ??= neon(databaseUrl);
  return sqlClient;
}

const store = {
  prepare: (source: string) => new PreparedStatement(source),
  async batch(statements: PreparedStatement[]) { const results = []; for (const statement of statements) results.push(await statement.run()); return results; },
};
export const db = () => store;

let initialization: Promise<void> | null = null;
export async function ensureDatabase() {
  initialization ??= (async () => {
    const d = db();
    await d.batch([
      d.prepare('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, created_at BIGINT NOT NULL)'),
      d.prepare('CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at BIGINT NOT NULL, created_at BIGINT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id))'),
      d.prepare('CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL, created_at BIGINT NOT NULL, FOREIGN KEY(created_by) REFERENCES users(id))'),
      d.prepare("CREATE TABLE IF NOT EXISTS organization_members (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'MEMBER', joined_at BIGINT NOT NULL, UNIQUE(organization_id,user_id), FOREIGN KEY(organization_id) REFERENCES organizations(id), FOREIGN KEY(user_id) REFERENCES users(id))"),
      d.prepare('CREATE TABLE IF NOT EXISTS organization_invites (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, code TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL, expires_at BIGINT, max_uses INTEGER, used_count INTEGER NOT NULL DEFAULT 0, created_at BIGINT NOT NULL, FOREIGN KEY(organization_id) REFERENCES organizations(id))'),
      d.prepare("CREATE TABLE IF NOT EXISTS app_games (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, organization_id TEXT NOT NULL, created_by TEXT NOT NULL, script_name TEXT NOT NULL, characters_json TEXT NOT NULL, player_count INTEGER NOT NULL, townsfolk_count INTEGER NOT NULL, outsider_count INTEGER NOT NULL, minion_count INTEGER NOT NULL, demon_count INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN', actual_character_ids_json TEXT, created_at BIGINT NOT NULL, FOREIGN KEY(organization_id) REFERENCES organizations(id))"),
      d.prepare('CREATE TABLE IF NOT EXISTS app_predictions (id TEXT PRIMARY KEY, game_id TEXT NOT NULL, user_id TEXT NOT NULL, character_ids_json TEXT NOT NULL, submitted_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, UNIQUE(game_id,user_id), FOREIGN KEY(game_id) REFERENCES app_games(id), FOREIGN KEY(user_id) REFERENCES users(id))'),
      d.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash)'),
      d.prepare('CREATE INDEX IF NOT EXISTS idx_memberships_user ON organization_members(user_id)'),
      d.prepare('CREATE INDEX IF NOT EXISTS idx_app_games_organization ON app_games(organization_id)'),
      d.prepare('CREATE INDEX IF NOT EXISTS idx_invites_organization_created ON organization_invites(organization_id,created_at DESC)'),
    ]);
  })();
  return initialization;
}
