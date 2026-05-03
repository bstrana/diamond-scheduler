/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("score_edits");
  collection.fields.add(new NumberField({ name: "pitch_count", required: false }));
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("score_edits");
  collection.fields.removeByName("pitch_count");
  app.save(collection);
});
