/**
 * When the menu wordmark sweep should play: on app launch, on the first menu
 * after a puzzle, and after a skin change — not on every return from
 * Settings, Archive, etc. (MenuView consumes the flag.)
 */
let pending = true;

/** Queue the sweep for the next menu. */
export function requestWordmarkSweep(): void {
  pending = true;
}

/** True once per request; MenuView calls this when it builds the wordmark. */
export function consumeWordmarkSweep(): boolean {
  const was = pending;
  pending = false;
  return was;
}
