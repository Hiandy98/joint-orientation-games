CREATE TABLE "warn_shell_progress" (
	"group_id" integer PRIMARY KEY NOT NULL,
	"milestones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"penalty_points" integer DEFAULT 0 NOT NULL
);
