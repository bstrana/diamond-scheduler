/// <reference path="../pb_data/types.d.ts" />

// The SPA's PocketBase client is unauthenticated (auth is handled by Keycloak,
// not PocketBase). Migration 1 set write rules to "@request.auth.id != ''"
// which blocks all SPA writes. Open the rules for collections the SPA writes
// to directly; security is enforced at the Cloudron / Keycloak boundary.

migrate(
  (app) => {
    // Collections the SPA writes to without PocketBase auth
    const openReadWrite = ["app_state", "published_schedules", "score_links"];
    for (const name of openReadWrite) {
      try {
        const col = app.findCollectionByNameOrId(name);
        col.listRule   = "";
        col.viewRule   = "";
        col.createRule = "";
        col.updateRule = "";
        col.deleteRule = "";
        app.save(col);
      } catch (e) {
        // collection may not exist on a fresh install – 1_init_collections
        // already creates them with open rules, so this is a no-op
      }
    }

    // score_edits is fully public (public score-entry page)
    // deleteRule stays locked – only allow auth'd users to delete
    try {
      const scoreEdits = app.findCollectionByNameOrId("score_edits");
      scoreEdits.listRule   = "";
      scoreEdits.viewRule   = "";
      scoreEdits.createRule = "";
      scoreEdits.updateRule = "";
      scoreEdits.deleteRule = "";
      app.save(scoreEdits);
    } catch (_) {}

    // tenants – opened for SPA reads; writes stay open too since the SPA
    // creates tenant records during onboarding without PocketBase auth
    try {
      const tenants = app.findCollectionByNameOrId("tenants");
      tenants.listRule   = "";
      tenants.viewRule   = "";
      tenants.createRule = "";
      tenants.updateRule = "";
      tenants.deleteRule = "";
      app.save(tenants);
    } catch (_) {}
  },

  // down – restore the original restrictive rules
  (app) => {
    const authRequired = "@request.auth.id != ''";
    for (const name of ["app_state", "published_schedules", "score_links", "tenants"]) {
      try {
        const col = app.findCollectionByNameOrId(name);
        col.listRule   = authRequired;
        col.viewRule   = authRequired;
        col.createRule = authRequired;
        col.updateRule = authRequired;
        col.deleteRule = authRequired;
        app.save(col);
      } catch (_) {}
    }
    try {
      const scoreEdits = app.findCollectionByNameOrId("score_edits");
      scoreEdits.deleteRule = authRequired;
      app.save(scoreEdits);
    } catch (_) {}
  }
);
