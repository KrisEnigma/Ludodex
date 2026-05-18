export function isBacktrackStep(existingIndex: number, chainLength: number): boolean {
  return chainLength >= 2 && existingIndex === chainLength - 2;
}
