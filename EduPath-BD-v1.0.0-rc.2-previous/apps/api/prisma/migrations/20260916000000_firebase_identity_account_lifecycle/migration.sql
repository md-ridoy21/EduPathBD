-- Link application accounts to immutable Firebase identities. Existing users are
-- backfilled safely during their next verified Firebase session.
ALTER TABLE "User" ADD COLUMN "firebaseUid" TEXT;
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");
