CREATE TABLE "grouppoint_points" (
	"group_id" integer PRIMARY KEY NOT NULL,
	"points" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warn_shell_secrets" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
