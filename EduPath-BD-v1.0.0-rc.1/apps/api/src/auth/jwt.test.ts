import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { issueAppToken, verifyAppToken } from "./jwt.js";
import { config } from "../config.js";

const student = {
  sub: "user_123",
  username: "student_one",
  email: "student@example.com",
  displayName: "Student One",
  role: "STUDENT" as const,
  emailVerified: true,
  phoneVerified: false
};

test("app token preserves the verified user and role", () => {
  const token = issueAppToken(student);
  const payload = verifyAppToken(token);
  assert.equal(payload.sub, student.sub);
  assert.equal(payload.username, student.username);
  assert.equal(payload.role, "STUDENT");
  assert.equal(payload.emailVerified, true);
});

test("modified token is rejected", () => {
  const token = issueAppToken(student);
  assert.throws(() => verifyAppToken(`${token.slice(0, -2)}xx`));
});

test("token with wrong audience is rejected", () => {
  const token = jwt.sign(student, config.jwtSecret, { algorithm: "HS256", audience: "another-app", issuer: "edupath-api" });
  assert.throws(() => verifyAppToken(token));
});
