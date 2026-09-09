import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const scripts = sqliteTable('scripts', {
  id:text('id').primaryKey(), name:text('name').notNull(), author:text('author'), source:text('source').notNull(), externalId:text('external_id'), charactersJson:text('characters_json').notNull(), createdAt:integer('created_at').notNull(),
});
export const games = sqliteTable('games', {
  id:text('id').primaryKey(), code:text('code').notNull().unique(), name:text('name').notNull(), scriptId:text('script_id').notNull().references(()=>scripts.id), playerCount:integer('player_count').notNull(), status:text('status').notNull().default('OPEN'), scoringMode:text('scoring_mode').notNull().default('CORRECT_CHARACTER'), pointsPerCorrectCharacter:integer('points_per_correct_character').notNull().default(1), actualCharacterIdsJson:text('actual_character_ids_json'), narratorTokenHash:text('narrator_token_hash').notNull(), externalSource:text('external_source'), externalGameId:text('external_game_id'), externalGameUrl:text('external_game_url'), createdAt:integer('created_at').notNull(),
});
export const participants = sqliteTable('participants', {
  id:text('id').primaryKey(), gameId:text('game_id').notNull().references(()=>games.id), displayName:text('display_name').notNull(), localIdentityTokenHash:text('local_identity_token_hash').notNull(), createdAt:integer('created_at').notNull(),
},t=>[uniqueIndex('idx_participants_game_token').on(t.gameId,t.localIdentityTokenHash)]);
export const predictions = sqliteTable('predictions', {
  id:text('id').primaryKey(), gameId:text('game_id').notNull().references(()=>games.id), participantId:text('participant_id').notNull().references(()=>participants.id), characterIdsJson:text('character_ids_json').notNull(), submittedAt:integer('submitted_at').notNull(), updatedAt:integer('updated_at').notNull(),
},t=>[uniqueIndex('idx_predictions_game_participant').on(t.gameId,t.participantId)]);
