const express = require('express');
const cors = require('cors');
const PF = require('pathfinding');
const winston = require('winston');

const app = express();
const port = 5000;

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Middleware
app.use(cors());
app.use(express.json());

// Grid configuration
const GRID_SIZE = 10;
const grid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));

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

// Pathfinding endpoint
app.post('/api/navigation/find-path', (req, res) => {
  try {
    const { start, end } = req.body;
    
    logger.info('Received pathfinding request', { start, end });

    // Validate input
    if (!start || !end || 
        !Number.isInteger(start.x) || !Number.isInteger(start.y) ||
        !Number.isInteger(end.x) || !Number.isInteger(end.y)) {
      logger.error('Invalid input coordinates', { start, end });
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    // Check if start and end are within bounds
    if (start.x < 0 || start.x >= GRID_SIZE || start.y < 0 || start.y >= GRID_SIZE ||
        end.x < 0 || end.x >= GRID_SIZE || end.y < 0 || end.y >= GRID_SIZE) {
      logger.error('Coordinates out of bounds', { start, end });
      return res.status(400).json({ error: 'Coordinates out of bounds' });
    }

    // Check if start and end are walkable
    if (grid[start.y][start.x] === 1 || grid[end.y][end.x] === 1) {
      logger.error('Start or end position is not walkable', { start, end });
      return res.status(400).json({ error: 'Start or end position is not walkable' });
    }

    // Create pathfinding grid
    const pfGrid = new PF.Grid(grid.map(row => [...row]));
    const finder = new PF.AStarFinder({
      allowDiagonal: false,
      dontCrossCorners: true
    });

    // Find path
    const path = finder.findPath(start.x, start.y, end.x, end.y, pfGrid);

    if (path.length === 0) {
      logger.error('No path found', { start, end });
      return res.status(404).json({ error: 'No path found' });
    }

    logger.info('Path found successfully', { path });
    res.json({ path });
  } catch (error) {
    logger.error('Error in pathfinding', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  console.log(`Server running on port ${port}`);
});