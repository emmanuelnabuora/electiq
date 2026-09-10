/** Shared error type for server actions. Not itself a "use server" module —
 *  files with that directive may only export async functions, so this
 *  class lives separately and is imported by the action modules. */
export class ActionError extends Error {}
