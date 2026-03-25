/// <reference path="../pb_data/types.d.ts" />

// Each Cloudron app instance has its own PocketBase database, so the app_id
// field that was used to multiplex records from multiple apps in a shared DB
// is no longer needed. Remove it from existing collections.

migrate(
  (app) => {
    for (const colName of ["app_state", "published_schedules"]) {
      try {
        const col = app.findCollectionByNameOrId(colName);
        col.fields = col.fields.filter((f) => f.name !== "app_id");
        app.save(col);
      } catch (_) {}
    }
  },
  // down – restore app_id as a nullable text field
  (app) => {
    for (const colName of ["app_state", "published_schedules"]) {
      try {
        const col = app.findCollectionByNameOrId(colName);
        col.fields.push({ type: "text", name: "app_id", required: false });
        app.save(col);
      } catch (_) {}
    }
  }
);
