import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { openDb } from "./db/client.js";

const port = Number(process.env.PORT ?? 8787);
const dbPath = process.env.FEED_DB ?? "./feed.db";

const app = createApp({ db: openDb(dbPath) });

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Magic Feed API on http://localhost:${info.port} (database ${dbPath})`);
});
