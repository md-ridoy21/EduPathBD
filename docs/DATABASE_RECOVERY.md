# Database backup, integrity and recovery

These controls protect the PostgreSQL data that powers accounts, profiles, saved items, applications, comments, ratings, moderation and admin content. They do not replace the hosting provider's encrypted off-site snapshots; use both.

## Security model

- `pg_dump` creates a compressed PostgreSQL custom-format archive.
- Production backup creation fails unless `BACKUP_ENCRYPTION_KEY` has at least 32 characters.
- OpenSSL encrypts the archive with AES-256-CBC, PBKDF2 and 600,000 iterations before the final file is published.
- A sidecar JSON manifest records the application version, non-secret database identity, byte size and SHA-256 checksum.
- Retention deletes only recognized EduPath backup/manifest pairs. It never recursively deletes the backup directory.
- Restore is dry-run by default. Execution requires the exact database name; production additionally requires `RESTORE_APPROVED=true`.
- Database passwords remain in child-process environment variables and are not placed in command-line arguments or manifests.

Keep `BACKUP_ENCRYPTION_KEY` in the deployment secret manager and in a separately protected recovery record. Losing the key makes encrypted backups unrecoverable.

## Create an encrypted backup

With local PostgreSQL client tools installed:

```bash
export DATABASE_URL='postgresql://...'
export BACKUP_ENCRYPTION_KEY='a-separate-random-secret-at-least-32-characters'
export BACKUP_DIR='/secure/edupath-backups'
npm run db:backup
```

With the production Compose stack:

```bash
docker compose --profile operations run --rm db-operations scripts/database-backup.mjs
```

Schedule that command in the host/provider scheduler. Copy completed `.dump.enc` and `.json` pairs to encrypted off-site object storage. Alert when a scheduled command fails or no new manifest appears within 26 hours.

## Run integrity checks

```bash
npm run db:integrity
```

or:

```bash
docker compose --profile operations run --rm db-operations scripts/database-integrity.mjs
```

The command fails on invalid rating/date/tuition ranges, case-insensitive account duplicates, verified records without sources, or verified non-HTTPS media. Pending content older than 30 days is a warning; add `--strict` to fail on warnings.

## Restore drill

Always rehearse against a temporary database first. The first command verifies the checksum, decrypts to a restricted temporary directory, and asks `pg_restore` to list the archive; it does not alter the database.

```bash
export DATABASE_URL='postgresql://.../edupath_restore_drill'
export BACKUP_ENCRYPTION_KEY='the-original-backup-key'
npm run db:restore -- --file /secure/edupath-backups/FILE.dump.enc
```

After reviewing the target and stopping application writes, execute deliberately:

```bash
export RESTORE_APPROVED=true
npm run db:restore -- \
  --file /secure/edupath-backups/FILE.dump.enc \
  --execute \
  --confirm-db edupath_restore_drill
npm run db:integrity -- --strict
```

For Compose, replace `npm run db:restore --` with:

```bash
docker compose --profile operations run --rm \
  -e RESTORE_APPROVED=true \
  db-operations scripts/database-restore.mjs
```

and append the same `--file`, `--execute`, and `--confirm-db` arguments. Backup files inside Compose are under `/backups/postgres/`.

## Release rollback order

1. Stop new writes and record the incident time.
2. Preserve logs and create a current backup if the database is reachable.
3. Roll the API/web container back to the last known compatible image.
4. If a migration must be reversed, restore the pre-release backup into a new database; do not improvise destructive SQL on the only production database.
5. Point the previous application release to the restored database.
6. Run `/api/ready`, `npm run db:integrity -- --strict`, the API verifier and a focused login/application/comment smoke test.
7. Record recovery point objective (data lost, if any), recovery time, root cause and preventive action.

Run a restore drill before launch and at least monthly. A backup is not proven until a separate database has been restored and checked successfully.
