/**
 * Generate a password hash for inserting a user directly in the database (e.g. pgAdmin).
 * Usage: node scripts/hash-password.js [password]
 * Default password: "password"
 * Prints the hash and a sample INSERT for the users table.
 */
import { randomBytes, scryptSync } from "node:crypto";

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}.${hash.toString("hex")}`;
}

const password = process.argv[2] ?? "password";
const email = "admin@example.com";
const hash = hashPassword(password);

console.log("-- Password hash (use in password_hash column):");
console.log(hash);
console.log("");
console.log("-- Full INSERT for pgAdmin (users table):");
console.log(
  `INSERT INTO users (id, email, password_hash, created_at)\nVALUES (gen_random_uuid(), '${email}', '${hash}', NOW())\nON CONFLICT (email) DO NOTHING;`
);
