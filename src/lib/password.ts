/**
 * **The shortest password a form accepts** (the product owner, 2026-11-01): `/register`, the reset link,
 * `/choose-a-password` and *Ubah kata sandi* on `/profile` each say it in their hint and hold the button until it is met.
 *
 * **The server's rule, mirrored** — `PASSWORD.MIN_LENGTH` in the backend's `domain/constants/password.ts`
 * (`metrics-and-definitions.md` §B.30), which `PasswordService` and the DTOs enforce. Mirrored so a form can say
 * *Minimal 8 karakter* before a round trip, as `PHONE_NATIONAL_DIGITS` mirrors its server's bounds; `password.spec.ts`
 * reads that file from disk and fails the day the two differ. The server's answer is the one that counts.
 */
export const PASSWORD_MIN_LENGTH = 8;
