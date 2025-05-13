import { AccessPoint, Product, Geofence } from '../types/navigation';

export const GRID_SIZE = 10;
export const SCAN_INTERVAL = 2000; // 2 seconds
export const API_URL = 'http:192.168.8.115:5000'; // localhost for Android emulator

export const accessPoints: AccessPoint[] = [
  { x: 1, y: 1, mac: '22:08:aa:e2:be:e2' }, //router
  { x: 8, y: 1, mac: '92:1c:65:cb:92:be' },//tablet
  { x: 4, y: 8, mac: 'e2:c2:64:65:bc:51' },//msi
];

export const products: Product[] = [
  { name: 'Milk', aisle: 'Aisle 1', coordinates: { x: 2, y: 3 } },
  { name: 'Bread', aisle: 'Aisle 1', coordinates: { x: 2, y: 7 } },
  { name: 'Apples', aisle: 'Aisle 2', coordinates: { x: 6, y: 3 } },
  { name: 'Pasta', aisle: 'Aisle 2', coordinates: { x: 6, y: 7 } },
  { name: 'Cheese', aisle: 'Central Area', coordinates: { x: 4, y: 5 } },
];

export const geofences: Geofence[] = [
  { label: 'Aisle 1', bounds: { minX: 2, maxX: 3, minY: 2, maxY: 8 } },
  { label: 'Aisle 2', bounds: { minX: 6, maxX: 7, minY: 2, maxY: 8 } },
  { label: 'Central Area', bounds: { minX: 4, maxX: 5, minY: 4, maxY: 6 } },
];

// Grid configuration
export const grid: number[][] = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));

// Set walls
for (let i = 0; i < GRID_SIZE; i++) {
  grid[0][i] = 1; // Top wall
  grid[GRID_SIZE-1][i] = 1; // Bottom wall
  grid[i][0] = 1; // Left wall
  grid[i][GRID_SIZE-1] = 1; // Right wall
}

// Set entrance
grid[0][1] = 0;

// Set aisles
for (let y = 2; y <= 8; y++) {
  for (let x of [2, 3, 6, 7]) {
    grid[y][x] = 0;
  }
}

// Set central aisle
for (let x = 1; x <= 8; x++) {
  grid[5][x] = 0;
}

// Set shelves
const shelves = [
  { y: 2, x: 1, h: 3, w: 1 },
  { y: 2, x: 4, h: 3, w: 1 },
  { y: 6, x: 1, h: 3, w: 1 },
  { y: 6, x: 4, h: 3, w: 1 }
];

shelves.forEach(shelf => {
  for (let y = shelf.y; y < shelf.y + shelf.h; y++) {
    for (let x = shelf.x; x < shelf.x + shelf.w; x++) {
      grid[y][x] = 1;
    }
  }
}); 