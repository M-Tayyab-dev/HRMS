#!/bin/sh
# Creates the least-privileged application role (no superuser, no BYPASSRLS).
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE hrms_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${PG_APP_PASSWORD}';
EOSQL
