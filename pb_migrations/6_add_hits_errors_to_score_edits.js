/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("score_edits");
  collection.fields.add(new NumberField({ name: "hits_away",   required: false }));
  collection.fields.add(new NumberField({ name: "hits_home",   required: false }));
  collection.fields.add(new NumberField({ name: "errors_away", required: false }));
  collection.fields.add(new NumberField({ name: "errors_home", required: false }));
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("score_edits");
  collection.fields.removeByName("hits_away");
  collection.fields.removeByName("hits_home");
  collection.fields.removeByName("errors_away");
  collection.fields.removeByName("errors_home");
  app.save(collection);
});
