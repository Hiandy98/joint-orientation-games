ALTER TABLE "warn_shell_secrets" RENAME TO "password_solved";--> statement-breakpoint
ALTER TABLE "password_solved" RENAME COLUMN "key" TO "stage";--> statement-breakpoint
ALTER TABLE "password_solved" ADD CONSTRAINT "password_solved_group_id_stage_area_pk" PRIMARY KEY("group_id","stage","area");--> statement-breakpoint
ALTER TABLE "password_solved" ADD COLUMN "group_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "password_solved" ADD COLUMN "area" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "password_solved" ADD COLUMN "solved_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "password_solved" DROP COLUMN "value";