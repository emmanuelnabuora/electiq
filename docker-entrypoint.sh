#!/bin/sh
# Applies any pending migrations before the app starts. `prisma migrate
# deploy` is the non-interactive, production-safe command (unlike
# `migrate dev`, it never generates new migrations or prompts) and is
# safe to run on every container start — it's a no-op if the schema is
# already current. If this fails, the container should not come up
# serving traffic against a schema it doesn't match, so `set -e` stops
# the entrypoint here rather than starting the app anyway.
set -e
npx prisma migrate deploy
exec "$@"
