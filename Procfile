# Heroku process — single web dyno runs the unified API + dashboard server.
# DATABASE_URL (Postgres) is injected by the Heroku Postgres add-on; when unset
# the server falls back to the local SQLite database at DATABASE_PATH.
web: node apps/api/dist/index.js
