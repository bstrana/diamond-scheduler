/// <reference path="../pb_data/types.d.ts" />

// Migration 5: add linescore boolean field to score_edits collection
migrate((app) => {
  const collection = app.findCollectionByNameOrId("score_edits");
  collection.fields.add(new BoolField({ name: "linescore", required: false }));
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("score_edits");
  collection.fields.removeByName("linescore");
  app.save(collection);
});
