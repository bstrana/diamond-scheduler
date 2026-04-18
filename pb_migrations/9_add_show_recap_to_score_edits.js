/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("score_edits");
  collection.fields.add(new BoolField({ name: "show_recap", required: false }));
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("score_edits");
  collection.fields.removeByName("show_recap");
  app.save(collection);
});
