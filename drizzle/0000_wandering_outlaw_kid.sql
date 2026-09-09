CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`script_id` text NOT NULL,
	`player_count` integer NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`scoring_mode` text DEFAULT 'CORRECT_CHARACTER' NOT NULL,
	`points_per_correct_character` integer DEFAULT 1 NOT NULL,
	`actual_character_ids_json` text,
	`narrator_token_hash` text NOT NULL,
	`external_source` text,
	`external_game_id` text,
	`external_game_url` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`script_id`) REFERENCES `scripts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_code_unique` ON `games` (`code`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`display_name` text NOT NULL,
	`local_identity_token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_participants_game_token` ON `participants` (`game_id`,`local_identity_token_hash`);--> statement-breakpoint
CREATE TABLE `predictions` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`character_ids_json` text NOT NULL,
	`submitted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_predictions_game_participant` ON `predictions` (`game_id`,`participant_id`);--> statement-breakpoint
CREATE TABLE `scripts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`author` text,
	`source` text NOT NULL,
	`external_id` text,
	`characters_json` text NOT NULL,
	`created_at` integer NOT NULL
);
