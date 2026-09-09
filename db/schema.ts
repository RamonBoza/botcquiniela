import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id:text('id').primaryKey(), username:text('username').notNull().unique(), displayName:text('display_name').notNull(), passwordHash:text('password_hash').notNull(), passwordSalt:text('password_salt').notNull(), createdAt:integer('created_at').notNull(),
});
export const sessions = sqliteTable('sessions', {
  id:text('id').primaryKey(), userId:text('user_id').notNull().references(()=>users.id), tokenHash:text('token_hash').notNull().unique(), expiresAt:integer('expires_at').notNull(), createdAt:integer('created_at').notNull(),
});
export const organizations = sqliteTable('organizations', {
  id:text('id').primaryKey(), name:text('name').notNull(), slug:text('slug').notNull().unique(), createdBy:text('created_by').notNull().references(()=>users.id), externalSource:text('external_source'), externalOrganizationId:text('external_organization_id'), createdAt:integer('created_at').notNull(),
});
export const organizationMembers = sqliteTable('organization_members', {
  id:text('id').primaryKey(), organizationId:text('organization_id').notNull().references(()=>organizations.id), userId:text('user_id').notNull().references(()=>users.id), role:text('role').notNull().default('MEMBER'), joinedAt:integer('joined_at').notNull(),
},t=>[uniqueIndex('idx_organization_members_org_user').on(t.organizationId,t.userId)]);
export const organizationInvites = sqliteTable('organization_invites', {
  id:text('id').primaryKey(), organizationId:text('organization_id').notNull().references(()=>organizations.id), code:text('code').notNull().unique(), createdBy:text('created_by').notNull().references(()=>users.id), expiresAt:integer('expires_at'), maxUses:integer('max_uses'), usedCount:integer('used_count').notNull().default(0), createdAt:integer('created_at').notNull(),
});

export const scripts = sqliteTable('scripts', {
  id:text('id').primaryKey(), name:text('name').notNull(), author:text('author'), source:text('source').notNull(), externalId:text('external_id'), charactersJson:text('characters_json').notNull(), createdAt:integer('created_at').notNull(),
});
export const games = sqliteTable('games', {
  id:text('id').primaryKey(), code:text('code').notNull().unique(), name:text('name').notNull(), organizationId:text('organization_id').references(()=>organizations.id), createdBy:text('created_by').references(()=>users.id), scriptId:text('script_id').notNull().references(()=>scripts.id), playerCount:integer('player_count').notNull(), townsfolkCount:integer('townsfolk_count').notNull().default(0), outsiderCount:integer('outsider_count').notNull().default(0), minionCount:integer('minion_count').notNull().default(0), demonCount:integer('demon_count').notNull().default(1), status:text('status').notNull().default('OPEN'), scoringMode:text('scoring_mode').notNull().default('CORRECT_CHARACTER'), pointsPerCorrectCharacter:integer('points_per_correct_character').notNull().default(1), actualCharacterIdsJson:text('actual_character_ids_json'), narratorTokenHash:text('narrator_token_hash').notNull(), externalSource:text('external_source'), externalGameId:text('external_game_id'), externalGameUrl:text('external_game_url'), createdAt:integer('created_at').notNull(),
});
export const participants = sqliteTable('participants', {
  id:text('id').primaryKey(), gameId:text('game_id').notNull().references(()=>games.id), displayName:text('display_name').notNull(), localIdentityTokenHash:text('local_identity_token_hash').notNull(), createdAt:integer('created_at').notNull(),
},t=>[uniqueIndex('idx_participants_game_token').on(t.gameId,t.localIdentityTokenHash)]);
export const predictions = sqliteTable('predictions', {
  id:text('id').primaryKey(), gameId:text('game_id').notNull().references(()=>games.id), participantId:text('participant_id').notNull().references(()=>participants.id), characterIdsJson:text('character_ids_json').notNull(), submittedAt:integer('submitted_at').notNull(), updatedAt:integer('updated_at').notNull(),
},t=>[uniqueIndex('idx_predictions_game_participant').on(t.gameId,t.participantId)]);
