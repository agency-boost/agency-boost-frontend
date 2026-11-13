/**
 * **Something that can be an email address**: a name, an `@`, a domain with a dot. A screen's check before a round
 * trip, so it can say so under the field. The API's own check is looser — a lead's email needs only an `@` there
 * (`lead-input.ts`) — so this screen check is the stricter of the two, and a refusal from the API still counts.
 *
 * One pattern for every form that takes an address — *Profil saya*'s and the lead sheet's *Email* (P19.11-T3 AC-5;
 * UX-10: *validate only if filled*) — so the two never disagree about what a whole address is.
 */
export const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Whether what was typed reads as a whole address, spaces around it aside. */
export const looksLikeEmail = (typed: string) => EMAIL_SHAPE.test(typed.trim());
