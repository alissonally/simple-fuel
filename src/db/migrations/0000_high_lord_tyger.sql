CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fuelings` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`segment_id` text NOT NULL,
	`date` text NOT NULL,
	`odometer_km` integer NOT NULL,
	`price_per_liter_milli` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`liters_ml` integer NOT NULL,
	`full_tank` integer NOT NULL,
	`fuel_type` text NOT NULL,
	`exclude_from_average` integer DEFAULT false NOT NULL,
	`station` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`segment_id`) REFERENCES `odometer_segments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `fuel_seg_odo_idx` ON `fuelings` (`segment_id`,`odometer_km`);--> statement-breakpoint
CREATE INDEX `fuel_vehicle_date_idx` ON `fuelings` (`vehicle_id`,`date`);--> statement-breakpoint
CREATE TABLE `odometer_segments` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`started_on` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `seg_vehicle_idx` ON `odometer_segments` (`vehicle_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`plate` text,
	`brand` text,
	`model` text,
	`year` integer,
	`default_fuel` text NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
