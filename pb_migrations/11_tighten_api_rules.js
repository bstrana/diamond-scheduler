/// <reference path="../pb_data/types.d.ts" />

// Tighten PocketBase API rules.
//
// The SPA connects to PocketBase directly from the browser without PocketBase-
// level auth (Keycloak handles identity at the application layer). Every
// collection needs open read/write/create for the SPA to function. What we
// CAN close without breaking anything:
//
//   1. deleteRule = null on all collections — records are never deleted via the
//      browser API; destruction only happens through the PocketBase admin UI.
//
//   2. score_edits createRule — require token, game_id, schedule_key to be
//      non-empty so random posts are rejected at the rule level.
//
//   3. score_edits updateRule — require the caller to supply the same token
//      that is already stored on the record (prevents one scorer overwriting
//      a different game's score entry).
//
// Deeper protection (locking writes behind a server-side secret header) would
// require routing all browser→PocketBase traffic through the Express proxy and
// is left for a future architectural change.

migrate(
  (app) => {
    // ── score_edits ──────────────────────────────────────────────────────────
    try {
      const col = app.findCollectionByNameOrId("score_edits");
      col.createRule = "@request.data.token != '' && @request.data.game_id != '' && @request.data.schedule_key != ''";
      col.updateRule = "token = @request.data.token";
      col.deleteRule = null;
      app.save(col);
    } catch (_) {}

    // ── score_links ──────────────────────────────────────────────────────────
    try {
      const col = app.findCollectionByNameOrId("score_links");
      col.deleteRule = null;
      app.save(col);
    } catch (_) {}

    // ── published_schedules ──────────────────────────────────────────────────
    try {
      const col = app.findCollectionByNameOrId("published_schedules");
      col.deleteRule = null;
      app.save(col);
    } catch (_) {}

    // ── app_state ────────────────────────────────────────────────────────────
    try {
      const col = app.findCollectionByNameOrId("app_state");
      col.deleteRule = null;
      app.save(col);
    } catch (_) {}

    // ── tenants ──────────────────────────────────────────────────────────────
    try {
      const col = app.findCollectionByNameOrId("tenants");
      col.deleteRule = null;
      app.save(col);
    } catch (_) {}
  },

  // down — restore previous open rules
  (app) => {
    for (const name of ["score_edits", "score_links", "published_schedules", "app_state", "tenants"]) {
      try {
        const col = app.findCollectionByNameOrId(name);
        col.createRule = "";
        col.updateRule = "";
        col.deleteRule = "";
        app.save(col);
      } catch (_) {}
    }
  }
);
