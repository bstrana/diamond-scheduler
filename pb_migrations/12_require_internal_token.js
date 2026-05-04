/// <reference path="../pb_data/types.d.ts" />

// Require X-Internal-Token on all PocketBase collection operations.
//
// nginx always injects this header into /_pb/ proxy requests (set in start.sh
// from the persisted /app/data/pb_internal_token file). This migration is
// therefore safe to apply regardless of the PB_WRITE_PROTECTION flag — requests
// going through nginx always carry the token; only direct container-local calls
// (e.g. via SSH) would be rejected.
//
// score_edits keeps its migration-11 create/update data-validation rules,
// combined with the token requirement. The Node.js proxy validates Keycloak
// tokens for writes on the other four collections at the application layer.
//
// Rollback: run migration down (restores migration-11 rules) or set
// PB_WRITE_PROTECTION=false in config.env + restart (nginx reverts to direct,
// token still injected, rules still satisfied — functionally identical to before).

const TOKEN_RULE = "@request.headers.x_internal_token != ''";

migrate(
  (app) => {
    // ── app_state ────────────────────────────────────────────────────────────
    try {
      const col = app.findCollectionByNameOrId("app_state");
      col.listRule   = TOKEN_RULE;
      col.viewRule   = TOKEN_RULE;
      col.createRule = TOKEN_RULE;
      col.updateRule = TOKEN_RULE;
      col.deleteRule = null;
      app.save(col);
    } catch (_) {}

    // ── tenants ──────────────────────────────────────────────────────────────
    try {
      const col = app.findCollectionByNameOrId("tenants");
      col.listRule   = TOKEN_RULE;
      col.viewRule   = TOKEN_RULE;
      col.createRule = TOKEN_RULE;
      col.updateRule = TOKEN_RULE;
      col.deleteRule = null;
      app.save(col);
    } catch (_) {}

    // ── score_links ──────────────────────────────────────────────────────────
    try {
      const col = app.findCollectionByNameOrId("score_links");
      col.listRule   = TOKEN_RULE;
      col.viewRule   = TOKEN_RULE;
      col.createRule = TOKEN_RULE;
      col.updateRule = TOKEN_RULE;
      col.deleteRule = null;
      app.save(col);
    } catch (_) {}

    // ── published_schedules ──────────────────────────────────────────────────
    try {
      const col = app.findCollectionByNameOrId("published_schedules");
      col.listRule   = TOKEN_RULE;
      col.viewRule   = TOKEN_RULE;
      col.createRule = TOKEN_RULE;
      col.updateRule = TOKEN_RULE;
      col.deleteRule = null;
      app.save(col);
    } catch (_) {}

    // ── score_edits ──────────────────────────────────────────────────────────
    // Preserves migration-11 data-validation rules, extended with token check.
    // Score page is public but still goes through nginx (token injected).
    try {
      const col = app.findCollectionByNameOrId("score_edits");
      col.listRule   = TOKEN_RULE;
      col.viewRule   = TOKEN_RULE;
      col.createRule = TOKEN_RULE + " && @request.data.token != '' && @request.data.game_id != '' && @request.data.schedule_key != ''";
      col.updateRule = TOKEN_RULE + " && token = @request.data.token";
      col.deleteRule = null;
      app.save(col);
    } catch (_) {}
  },

  // down — restore migration-11 rules (token requirement removed)
  (app) => {
    try {
      const col = app.findCollectionByNameOrId("app_state");
      col.listRule = col.viewRule = col.createRule = col.updateRule = "";
      col.deleteRule = null;
      app.save(col);
    } catch (_) {}

    try {
      const col = app.findCollectionByNameOrId("tenants");
      col.listRule = col.viewRule = col.createRule = col.updateRule = "";
      col.deleteRule = null;
      app.save(col);
    } catch (_) {}

    try {
      const col = app.findCollectionByNameOrId("score_links");
      col.listRule = col.viewRule = col.createRule = col.updateRule = "";
      col.deleteRule = null;
      app.save(col);
    } catch (_) {}

    try {
      const col = app.findCollectionByNameOrId("published_schedules");
      col.listRule = col.viewRule = col.createRule = col.updateRule = "";
      col.deleteRule = null;
      app.save(col);
    } catch (_) {}

    try {
      const col = app.findCollectionByNameOrId("score_edits");
      col.listRule   = "";
      col.viewRule   = "";
      col.createRule = "@request.data.token != '' && @request.data.game_id != '' && @request.data.schedule_key != ''";
      col.updateRule = "token = @request.data.token";
      col.deleteRule = null;
      app.save(col);
    } catch (_) {}
  }
);
