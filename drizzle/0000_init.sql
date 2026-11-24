CREATE TABLE `event_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`field` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`reason` text NOT NULL,
	`actor` text NOT NULL,
	`scan_id` text,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `changes_event` ON `event_changes` (`event_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`place_id` text NOT NULL,
	`venue` text,
	`category` text NOT NULL,
	`interests` text NOT NULL,
	`suitability` text NOT NULL,
	`state` text NOT NULL,
	`review_state` text NOT NULL,
	`review_reasons` text NOT NULL,
	`confidence` real NOT NULL,
	`price` text,
	`booking_url` text,
	`ticket_sale_cutoff` text,
	`created_at` text NOT NULL,
	`last_updated` text NOT NULL,
	`last_checked` text NOT NULL,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_place` ON `events` (`place_id`);--> statement-breakpoint
CREATE INDEX `events_review` ON `events` (`review_state`);--> statement-breakpoint
CREATE TABLE `places` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`country` text NOT NULL,
	`timezone` text NOT NULL,
	`aliases` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scans` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`external_id` text NOT NULL,
	`url` text,
	`raw` text NOT NULL,
	`content_hash` text NOT NULL,
	`state` text NOT NULL,
	`event_id` text,
	`note` text,
	`fetched_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`processed_at` text,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scans_source_ext_hash` ON `scans` (`source_id`,`external_id`,`content_hash`);--> statement-breakpoint
CREATE INDEX `scans_state` ON `scans` (`state`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`kind` text NOT NULL,
	`place_id` text NOT NULL,
	`active` integer NOT NULL,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `terms` (
	`kind` text NOT NULL,
	`term` text NOT NULL,
	`status` text NOT NULL,
	`reason` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `terms_kind_term` ON `terms` (`kind`,`term`);--> statement-breakpoint
CREATE TABLE `times` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`type` text NOT NULL,
	`start` text,
	`end` text,
	`precision` text NOT NULL,
	`rrule` text,
	`exceptions` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`note` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `times_event` ON `times` (`event_id`);