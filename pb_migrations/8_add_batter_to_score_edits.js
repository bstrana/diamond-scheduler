/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("score_edits");
  collection.fields.add(new TextField({ name: "batter",  required: false }));
  collection.fields.add(new TextField({ name: "batting", required: false }));
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("score_edits");
  collection.fields.removeByName("batter");
  collection.fields.removeByName("batting");
  app.save(collection);
});
