/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("score_edits");
  collection.fields.add(new TextField({ name: "pitcher", required: false }));
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("score_edits");
  collection.fields.removeByName("pitcher");
  app.save(collection);
});
