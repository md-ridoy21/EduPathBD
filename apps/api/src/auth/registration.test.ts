import assert from "node:assert/strict";
import test from "node:test";
import { reserveFirebaseUser, syncFirebaseUser, UsernameConflictError } from "../data/store.js";

test("registration reserves username and verified login keeps it", async () => {
  const username = `reserved_${Date.now().toString().slice(-8)}`;
  const email = `${username}@example.test`;
  const reserved = await reserveFirebaseUser({ firebaseUid: `firebase-${username}`, username, email, displayName: "Registration Test", emailVerified: false, phoneVerified: false });
  assert.equal(reserved.username, username);
  assert.equal(reserved.emailVerified, false);

  const verified = await syncFirebaseUser({ firebaseUid: `firebase-${username}`, email, displayName: "Verified Student", emailVerified: true, phoneVerified: false });
  assert.equal(verified.username, username);
  assert.equal(verified.displayName, "Verified Student");
  assert.equal(verified.emailVerified, true);
});

test("a reserved username cannot be claimed by another account", async () => {
  const username = `collision_${Date.now().toString().slice(-8)}`;
  await reserveFirebaseUser({ firebaseUid: `owner-${username}`, username, email: `owner-${username}@example.test`, displayName: "Owner", emailVerified: false, phoneVerified: false });
  await assert.rejects(
    reserveFirebaseUser({ firebaseUid: `other-${username}`, username, email: `other-${username}@example.test`, displayName: "Other", emailVerified: false, phoneVerified: false }),
    (error: unknown) => error instanceof UsernameConflictError
  );
});
