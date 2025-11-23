CREATE TABLE "response_proofs" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" varchar(500) NOT NULL,
	"url" text NOT NULL,
	"method" varchar(10) NOT NULL,
	"status_code" bigint NOT NULL,
	"status_text" varchar(255),
	"proof" text NOT NULL,
	"user_id" varchar(255),
	"sponsor_id" text,
	"action_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "response_proofs" ADD CONSTRAINT "response_proofs_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_proofs" ADD CONSTRAINT "response_proofs_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE set null ON UPDATE no action;