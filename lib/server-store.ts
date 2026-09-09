import { env } from 'cloudflare:workers';

type Bindings={DB:D1Database};
const db=()=> (env as unknown as Bindings).DB;
let initialized=false;

export async function ensureDatabase(){
  if(initialized)return;
  const d=db();
  await d.batch([
    d.prepare('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, created_at INTEGER NOT NULL)'),
    d.prepare('CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id))'),
    d.prepare('CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL, created_at INTEGER NOT NULL, FOREIGN KEY(created_by) REFERENCES users(id))'),
    d.prepare("CREATE TABLE IF NOT EXISTS organization_members (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'MEMBER', joined_at INTEGER NOT NULL, UNIQUE(organization_id,user_id), FOREIGN KEY(organization_id) REFERENCES organizations(id), FOREIGN KEY(user_id) REFERENCES users(id))"),
    d.prepare('CREATE TABLE IF NOT EXISTS organization_invites (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, code TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL, expires_at INTEGER, max_uses INTEGER, used_count INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, FOREIGN KEY(organization_id) REFERENCES organizations(id))'),
    d.prepare("CREATE TABLE IF NOT EXISTS app_games (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, organization_id TEXT NOT NULL, created_by TEXT NOT NULL, script_name TEXT NOT NULL, characters_json TEXT NOT NULL, player_count INTEGER NOT NULL, townsfolk_count INTEGER NOT NULL, outsider_count INTEGER NOT NULL, minion_count INTEGER NOT NULL, demon_count INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN', actual_character_ids_json TEXT, created_at INTEGER NOT NULL, FOREIGN KEY(organization_id) REFERENCES organizations(id))"),
    d.prepare('CREATE TABLE IF NOT EXISTS app_predictions (id TEXT PRIMARY KEY, game_id TEXT NOT NULL, user_id TEXT NOT NULL, character_ids_json TEXT NOT NULL, submitted_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(game_id,user_id), FOREIGN KEY(game_id) REFERENCES app_games(id), FOREIGN KEY(user_id) REFERENCES users(id))'),
    d.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash)'),
    d.prepare('CREATE INDEX IF NOT EXISTS idx_memberships_user ON organization_members(user_id)'),
    d.prepare('CREATE INDEX IF NOT EXISTS idx_app_games_organization ON app_games(organization_id)'),
  ]);
  initialized=true;
}

export {db};
