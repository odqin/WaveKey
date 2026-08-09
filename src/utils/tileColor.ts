export interface TileColorData {
    bg: string;
    icon: string;
}

/**
 * Tile accent palette — a curated, harmonious family (Apple's actual dark-mode system colors)
 * bg matches theme.css --tile-0 … --tile-7.
 * icon is a very dark shade of the same hue for contrast on the chip.
 */
const TILE_PALETTE: TileColorData[] = [
    { bg: '#0A84FF', icon: '#002554' }, // blue
    { bg: '#30D158', icon: '#173404' }, // green
    { bg: '#5E5CE6', icon: '#181745' }, // indigo
    { bg: '#FF9F0A', icon: '#412402' }, // orange
    { bg: '#FF375F', icon: '#520B1A' }, // pink
    { bg: '#BF5AF2', icon: '#3A1249' }, // purple — fixed, was indigo's shade
    { bg: '#64D2FF', icon: '#04342C' }, // teal
    { bg: '#FFD60A', icon: '#4D4000' }, // yellow
];
/**
 * Deterministically picks a tile background color for a given sound ID.
 * Uses a simple djb2-style hash so the color is stable across restarts.
 */
export function tileColor(id: string): TileColorData {
    let hash = 5381;
    for (let i = 0; i < id.length; i++) {
        hash = ((hash << 5) + hash) ^ id.charCodeAt(i);
        hash = hash >>> 0; // keep unsigned 32-bit
    }
    return TILE_PALETTE[hash % 8];
}
