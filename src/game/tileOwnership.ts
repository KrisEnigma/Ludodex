export type PartOwnershipEntry = {
  id: string;
  path: string[];
};

export type TileOwnershipState = {
  ownership: Map<string, Set<string>>;
};

export function buildTileOwnership(entries: PartOwnershipEntry[]): TileOwnershipState {
  const ownership = new Map<string, Set<string>>();

  for (const entry of entries) {
    for (const coord of entry.path) {
      if (!ownership.has(coord)) {
        ownership.set(coord, new Set<string>());
      }
      ownership.get(coord)!.add(entry.id);
    }
  }

  return { ownership };
}

export function applySolvedPart(
  state: TileOwnershipState,
  entry: PartOwnershipEntry
): string[] {
  const deactivatedCoords: string[] = [];

  for (const coord of entry.path) {
    const owners = state.ownership.get(coord);
    if (!owners) continue;

    owners.delete(entry.id);
    if (owners.size === 0) {
      deactivatedCoords.push(coord);
    }
  }

  return deactivatedCoords;
}
