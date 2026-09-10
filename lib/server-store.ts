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
  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }
  async all<T extends QueryRow>() {
    const rows = await queryRows(postgresSql(this.source), this.values);
    return { results: rows as T[] };
  }
  async first<T extends QueryRow>() {
    const rows = await queryRows(postgresSql(this.source), this.values);
    return (rows[0] as T | undefined) ?? null;
  }
  async run() {
    try {
      await queryRows(postgresSql(this.source), this.values);
    } catch (error) {
      throw new Error(`Error al ejecutar la consulta: ${this.source}`, {
        cause: error,
      });
    }
    return { success: true };
  }
}

let sqlClient: ReturnType<typeof neon> | null = null;
const developmentDatabase = globalThis as typeof globalThis & {
  quinielaPglite?: Promise<import('@electric-sql/pglite').PGlite>;
  quinielaDatabaseInitialization?: Promise<void>;
};
async function queryRows(source: string, values: unknown[]) {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    sqlClient ??= neon(databaseUrl);
    return (await sqlClient.query(source, values)) as Record<string, unknown>[];
  }
  if (process.env.NODE_ENV === 'production')
    throw new Error(
      'Falta DATABASE_URL. Conecta una base de datos Postgres al proyecto de Vercel.',
    );
  developmentDatabase.quinielaPglite ??= import('@electric-sql/pglite').then(
    ({ PGlite }) => new PGlite(process.env.PGLITE_DATA_DIR ?? '.pglite'),
  );
  const result = await (
    await developmentDatabase.quinielaPglite
  ).query(source, values);
  return result.rows as Record<string, unknown>[];
}

const store = {
  prepare: (source: string) => new PreparedStatement(source),
  async batch(statements: PreparedStatement[]) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  },
};
export const db = () => store;

export async function ensureDatabase() {
  developmentDatabase.quinielaDatabaseInitialization ??= (async () => {
    const d = db();
    await d.batch([
      d.prepare(
        'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, created_at BIGINT NOT NULL)',
      ),
      d.prepare(
        'CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at BIGINT NOT NULL, created_at BIGINT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id))',
      ),
      d.prepare(
        'CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL, created_at BIGINT NOT NULL, FOREIGN KEY(created_by) REFERENCES users(id))',
      ),
      d.prepare(
        "CREATE TABLE IF NOT EXISTS organization_seasons (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', starts_at BIGINT NOT NULL, ends_at BIGINT, created_by TEXT NOT NULL, created_at BIGINT NOT NULL, UNIQUE(organization_id,name), FOREIGN KEY(organization_id) REFERENCES organizations(id), FOREIGN KEY(created_by) REFERENCES users(id))",
      ),
      d.prepare(
        "CREATE TABLE IF NOT EXISTS organization_members (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'MEMBER', joined_at BIGINT NOT NULL, UNIQUE(organization_id,user_id), FOREIGN KEY(organization_id) REFERENCES organizations(id), FOREIGN KEY(user_id) REFERENCES users(id))",
      ),
      d.prepare(
        'CREATE TABLE IF NOT EXISTS organization_invites (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, code TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL, expires_at BIGINT, max_uses INTEGER, used_count INTEGER NOT NULL DEFAULT 0, created_at BIGINT NOT NULL, FOREIGN KEY(organization_id) REFERENCES organizations(id))',
      ),
      d.prepare(
        "CREATE TABLE IF NOT EXISTS app_games (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, organization_id TEXT NOT NULL, created_by TEXT NOT NULL, script_name TEXT NOT NULL, characters_json TEXT NOT NULL, player_count INTEGER NOT NULL, townsfolk_count INTEGER NOT NULL, outsider_count INTEGER NOT NULL, minion_count INTEGER NOT NULL, demon_count INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN', actual_character_ids_json TEXT, created_at BIGINT NOT NULL, FOREIGN KEY(organization_id) REFERENCES organizations(id))",
      ),
      d.prepare(
        'CREATE TABLE IF NOT EXISTS app_predictions (id TEXT PRIMARY KEY, game_id TEXT NOT NULL, user_id TEXT NOT NULL, character_ids_json TEXT NOT NULL, submitted_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, UNIQUE(game_id,user_id), FOREIGN KEY(game_id) REFERENCES app_games(id), FOREIGN KEY(user_id) REFERENCES users(id))',
      ),
      d.prepare(
        'CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash)',
      ),
      d.prepare(
        'CREATE INDEX IF NOT EXISTS idx_memberships_user ON organization_members(user_id)',
      ),
      d.prepare(
        'CREATE INDEX IF NOT EXISTS idx_app_games_organization ON app_games(organization_id)',
      ),
      d.prepare(
        'CREATE INDEX IF NOT EXISTS idx_seasons_organization ON organization_seasons(organization_id,created_at DESC)',
      ),
      d.prepare(
        'CREATE INDEX IF NOT EXISTS idx_invites_organization_created ON organization_invites(organization_id,created_at DESC)',
      ),
      d.prepare(
        'CREATE TABLE IF NOT EXISTS admin_audit_log (id TEXT PRIMARY KEY, actor_user_id TEXT NOT NULL, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT, details_json TEXT NOT NULL, created_at BIGINT NOT NULL, FOREIGN KEY(actor_user_id) REFERENCES users(id))',
      ),
      d.prepare(
        'CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC)',
      ),
    ]);
    await d
      .prepare('ALTER TABLE app_games ADD COLUMN IF NOT EXISTS season_id TEXT')
      .run();
    const organizations = await d
      .prepare(
        'SELECT id,created_by AS createdBy,created_at AS createdAt FROM organizations',
      )
      .all<{ id: string; createdBy: string; createdAt: number | string }>();
    for (const organization of organizations.results) {
      let season = await d
        .prepare(
          "SELECT id FROM organization_seasons WHERE organization_id=? ORDER BY CASE WHEN status='ACTIVE' THEN 0 ELSE 1 END,created_at DESC LIMIT 1",
        )
        .bind(organization.id)
        .first<{ id: string }>();
      if (!season) {
        season = { id: crypto.randomUUID() };
        await d
          .prepare(
            "INSERT INTO organization_seasons (id,organization_id,name,status,starts_at,created_by,created_at) VALUES (?,?,?,'ACTIVE',?,?,?)",
          )
          .bind(
            season.id,
            organization.id,
            'Temporada inicial',
            organization.createdAt,
            organization.createdBy,
            organization.createdAt,
          )
          .run();
      }
      await d
        .prepare(
          'UPDATE app_games SET season_id=? WHERE organization_id=? AND season_id IS NULL',
        )
        .bind(season.id, organization.id)
        .run();
    }
    await d
      .prepare(
        'CREATE INDEX IF NOT EXISTS idx_app_games_season ON app_games(season_id,created_at DESC)',
      )
      .run();
  })();
  return developmentDatabase.quinielaDatabaseInitialization;
}
