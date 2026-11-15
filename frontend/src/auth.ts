// Demo accounts, kept in this browser only. Passwords are salted and hashed (PBKDF2-SHA256),
// never stored as typed. There is no account server, so an account works on one device.
import type { Profile } from "./profile";

const KEY = "accounts";
const ITER = 100_000;

interface Account {
  name: string;
  research: boolean;
  salt: string;
  hash: string;
}

type Store = Record<string, Account>;

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const norm = (email: string) => email.trim().toLowerCase();

function load(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

function save(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: ITER }, key, 256);
  return hex(bits);
}

export const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

/** Create an account. Returns an error message, or the new profile. */
export async function signUp(name: string, email: string, password: string, research: boolean): Promise<Profile | string> {
  const e = norm(email);
  if (!validEmail(e)) return "Enter a valid email.";
  if (password.length < 8) return "Use at least 8 characters for the password.";
  const store = load();
  if (store[e]) return "An account with this email already exists. Log in instead.";
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  store[e] = { name: name.trim(), research, salt, hash: await hashPassword(password, salt) };
  save(store);
  return { name: name.trim(), research, email: e };
}

/** Check email and password. Returns an error message, or the profile. */
export async function logIn(email: string, password: string): Promise<Profile | string> {
  const e = norm(email);
  const acct = load()[e];
  // Same message for both cases, so the form does not reveal which emails exist.
  if (!acct || (await hashPassword(password, acct.salt)) !== acct.hash) return "Email or password is wrong.";
  return { name: acct.name, research: acct.research, email: e };
}

/** Keep the account in step when the user edits their name or research switch. */
export function updateAccount(p: Profile) {
  if (!p.email) return;
  const store = load();
  const acct = store[p.email];
  if (!acct) return;
  store[p.email] = { ...acct, name: p.name, research: p.research };
  save(store);
}
