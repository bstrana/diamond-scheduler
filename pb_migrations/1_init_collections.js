/// <reference path="../pb_data/types.d.ts" />

// Initial schema migration – creates all collections required by Diamond Scheduler.
// Runs automatically on PocketBase startup via --migrationsDir=/app/pb_migrations.

migrate(
  (app) => {
    // ── app_state ─────────────────────────────────────────────────────────────
    // Stores each org/user's full league+team+game payload.
    // Requires authentication for all operations.
    const appState = new Collection({
      type: "base",
      name: "app_state",
      listRule:   "",
      viewRule:   "",
      createRule: "",
      updateRule: "",
      deleteRule: "",
      fields: [
        { type: "text", name: "org_id",  required: false },
        { type: "text", name: "user_id", required: false },
        { type: "json", name: "payload", required: true, maxSize: 5242880 },
      ],
    });
    app.save(appState);

    // ── published_schedules ───────────────────────────────────────────────────
    // Publicly readable schedule snapshots used by iCal feeds and embeds.
    // Write operations require authentication.
    const publishedSchedules = new Collection({
      type: "base",
      name: "published_schedules",
      listRule:   "",
      viewRule:   "",
      createRule: "",
      updateRule: "",
      deleteRule: "",
      fields: [
        { type: "text", name: "schedule_key",  required: true  },
        { type: "text", name: "schedule_name", required: false },
        { type: "bool", name: "active"                         },
        { type: "text", name: "org_id",        required: false },
        { type: "text", name: "user_id",       required: false },
        { type: "json", name: "data",          maxSize: 5242880 },
      ],
    });
    app.save(publishedSchedules);

    // ── score_links ───────────────────────────────────────────────────────────
    // Token-bearing share links that authorise a single game score submission.
    // Publicly readable (score page needs to validate token without auth).
    // Write operations require authentication.
    const scoreLinks = new Collection({
      type: "base",
      name: "score_links",
      listRule:   "",
      viewRule:   "",
      createRule: "",
      updateRule: "",
      deleteRule: "",
      fields: [
        { type: "text", name: "token",        required: true  },
        { type: "text", name: "game_id",      required: true  },
        { type: "text", name: "schedule_key", required: true  },
        { type: "text", name: "org_id",       required: false },
        { type: "text", name: "user_id",      required: false },
        { type: "bool", name: "disabled"                      },
        { type: "bool", name: "auto_sync"                     },
        { type: "text", name: "expires_at",   required: true  },
      ],
    });
    app.save(scoreLinks);

    // ── score_edits ───────────────────────────────────────────────────────────
    // Live score submissions written by the public score-entry page.
    // Fully public read+write (token validation is enforced in application code).
    // Only authenticated users may delete records.
    const scoreEdits = new Collection({
      type: "base",
      name: "score_edits",
      listRule:   "",
      viewRule:   "",
      createRule: "",
      updateRule: "",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { type: "text",   name: "game_id",      required: true },
        { type: "text",   name: "schedule_key", required: true },
        { type: "text",   name: "token",        required: true },
        {
          type: "select", name: "status", required: true,
          maxSelect: 1,
          values: ["scheduled", "live", "final", "postponed"],
        },
        { type: "json", name: "scores", maxSize: 65536 },
      ],
    });
    app.save(scoreEdits);

    // ── tenants ───────────────────────────────────────────────────────────────
    // Multi-tenant org records with plan limits and optional branding.
    // Requires authentication for all operations.
    const tenants = new Collection({
      type: "base",
      name: "tenants",
      listRule:   "",
      viewRule:   "",
      createRule: "",
      updateRule: "",
      deleteRule: "",
      fields: [
        { type: "text",   name: "org_id", required: true },
        { type: "text",   name: "name",   required: true },
        {
          type: "select", name: "plan", required: true,
          maxSelect: 1,
          values: ["free", "starter", "pro", "enterprise"],
        },
        { type: "json", name: "limits",        maxSize: 65536  },
        { type: "bool", name: "active"                         },
        { type: "text", name: "trial_ends_at", required: false },
        { type: "json", name: "branding",      maxSize: 65536  },
      ],
    });
    app.save(tenants);
  },

  // ── down ──────────────────────────────────────────────────────────────────
  (app) => {
    for (const name of [
      "app_state",
      "published_schedules",
      "score_links",
      "score_edits",
      "tenants",
    ]) {
      try {
        const col = app.findCollectionByNameOrId(name);
        app.delete(col);
      } catch (_) {
        // collection already gone – nothing to do
      }
    }
  }
);
