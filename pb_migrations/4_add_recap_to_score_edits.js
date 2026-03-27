/// <reference path="../pb_data/types.d.ts" />

// Migration 4: add recap text field to score_edits collection
migrate((app) => {
  const collection = app.findCollectionByNameOrId("score_edits");
  collection.fields.add(new TextField({ name: "recap", required: false }));
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("score_edits");
  collection.fields.removeByName("recap");
  app.save(collection);
});
