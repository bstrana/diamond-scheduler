/// <reference path="../pb_data/types.d.ts" />

// Strengthen score_edits createRule to verify the submitted token exists in
// score_links and is not disabled. This prevents a cross-origin attacker from
// injecting a fake final score by crafting a valid game_id + schedule_key pair
// with an arbitrary token value.
//
// PocketBase's cross-collection filter syntax:
//   @collection.score_links.token ?= <value>   → at least one score_links record
//                                                 has a matching token field
//
// Combined with the existing checks from migrations 11 and 12:
//   - x_internal_token header present (nginx-injected)
//   - data.token, game_id, schedule_key non-empty
//   - submitted token actually exists and is active in score_links
//
// down() restores the migration-12 createRule (token non-empty check only).

migrate(
  (app) => {
    try {
      const col = app.findCollectionByNameOrId("score_edits");
      col.createRule =
        "@request.headers.x_internal_token != ''" +
        " && @request.data.token != ''" +
        " && @request.data.game_id != ''" +
        " && @request.data.schedule_key != ''" +
        " && @collection.score_links.token ?= @request.data.token" +
        " && @collection.score_links.disabled != true";
      app.save(col);
    } catch (_) {}
  },

  // down — restore migration-12 createRule
  (app) => {
    try {
      const col = app.findCollectionByNameOrId("score_edits");
      col.createRule =
        "@request.headers.x_internal_token != ''" +
        " && @request.data.token != ''" +
        " && @request.data.game_id != ''" +
        " && @request.data.schedule_key != ''";
      app.save(col);
    } catch (_) {}
  }
);
