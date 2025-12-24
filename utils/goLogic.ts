import { StoneColor, Point } from '../types';

// Hoshi points generator based on size
export const getHoshiPoints = (size: number): Point[] => {
  if (size === 9) {
    return [
      { x: 2, y: 2 }, { x: 6, y: 2 },
      { x: 4, y: 4 },
      { x: 2, y: 6 }, { x: 6, y: 6 }
    ];
  }
  if (size === 13) {
    return [
      { x: 3, y: 3 }, { x: 9, y: 3 },
      { x: 6, y: 6 },
      { x: 3, y: 9 }, { x: 9, y: 9 }
    ];
  }
  // Default 19x19
  return [
    { x: 3, y: 3 }, { x: 9, y: 3 }, { x: 15, y: 3 },
    { x: 3, y: 9 }, { x: 9, y: 9 }, { x: 15, y: 9 },
    { x: 3, y: 15 }, { x: 9, y: 15 }, { x: 15, y: 15 },
  ];
};

export const createEmptyGrid = (size: number): (StoneColor | null)[][] => {
  return Array(size).fill(null).map(() => Array(size).fill(null));
};

export const getOpponent = (color: StoneColor): StoneColor => color === 'black' ? 'white' : 'black';

// Deep clone grid
export const cloneGrid = (grid: (StoneColor | null)[][]) => grid.map(row => [...row]);

// Check if point is on board
const isOnBoard = (x: number, y: number, size: number) => {
  return x >= 0 && x < size && y >= 0 && y < size;
};

// Get group of stones and their liberties
export const getGroupInfo = (
  grid: (StoneColor | null)[][],
  x: number,
  y: number
): { group: Point[], liberties: Point[] } => {
  const size = grid.length;
  const color = grid[y][x];
  if (!color) return { group: [], liberties: [] };

  const group: Point[] = [];
  const liberties: Set<string> = new Set(); // store as "x,y" string to avoid dupes
  const visited = new Set<string>();
  const queue: Point[] = [{ x, y }];

  visited.add(`${x},${y}`);

  while (queue.length > 0) {
    const p = queue.shift()!;
    group.push(p);

    const neighbors = [
      { x: p.x + 1, y: p.y },
      { x: p.x - 1, y: p.y },
      { x: p.x, y: p.y + 1 },
      { x: p.x, y: p.y - 1 },
    ];

    for (const n of neighbors) {
      if (!isOnBoard(n.x, n.y, size)) continue;
      
      const nKey = `${n.x},${n.y}`;
      if (grid[n.y][n.x] === null) {
        liberties.add(nKey);
      } else if (grid[n.y][n.x] === color && !visited.has(nKey)) {
        visited.add(nKey);
        queue.push(n);
      }
    }
  }

  const libertyPoints = Array.from(liberties).map(s => {
    const [lx, ly] = s.split(',').map(Number);
    return { x: lx, y: ly };
  });

  return { group, liberties: libertyPoints };
};

// Attempt to make a move
// Returns: { success: boolean, newGrid: ..., captures: number }
export const makeMove = (
  currentGrid: (StoneColor | null)[][],
  x: number,
  y: number,
  color: StoneColor
): { success: boolean, newGrid: (StoneColor | null)[][], captures: number } => {
  const size = currentGrid.length;
  
  if (!isOnBoard(x, y, size) || currentGrid[y][x] !== null) {
    return { success: false, newGrid: currentGrid, captures: 0 };
  }

  const nextGrid = cloneGrid(currentGrid);
  nextGrid[y][x] = color;

  let captures = 0;
  const opponent = getOpponent(color);
  const neighbors = [
    { x: x + 1, y: y }, { x: x - 1, y: y },
    { x: x, y: y + 1 }, { x: x, y: y - 1 },
  ];

  // 1. Check for captures of opponent
  neighbors.forEach(n => {
    if (isOnBoard(n.x, n.y, size) && nextGrid[n.y][n.x] === opponent) {
      const { group, liberties } = getGroupInfo(nextGrid, n.x, n.y);
      if (liberties.length === 0) {
        // Capture!
        captures += group.length;
        group.forEach(stone => {
          nextGrid[stone.y][stone.x] = null;
        });
      }
    }
  });

  // 2. Check for suicide (self has no liberties)
  const { liberties: selfLiberties } = getGroupInfo(nextGrid, x, y);
  if (selfLiberties.length === 0) {
    // Suicide rule: invalid unless it captured something
    if (captures === 0) {
      return { success: false, newGrid: currentGrid, captures: 0 };
    }
  }

  return { success: true, newGrid: nextGrid, captures };
};

// Simplified Chinese/Area Scoring estimation using Flood Fill
export const calculateTerritory = (grid: (StoneColor | null)[][]): { black: number, white: number, territoryMap: number[][] } => {
  const size = grid.length;
  // 0: neutral, 1: black territory, 2: white territory
  const map = Array(size).fill(0).map(() => Array(size).fill(0));
  let blackTerritory = 0;
  let whiteTerritory = 0;
  const visited = new Set<string>();

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const key = `${x},${y}`;
      if (grid[y][x] !== null) {
        // Actual stones count as points in area scoring
        continue;
      }
      if (visited.has(key)) continue;

      // Start flood fill for empty region
      const region: Point[] = [];
      const touchColors = new Set<StoneColor>();
      const queue = [{x, y}];
      visited.add(key);
      
      let qIndex = 0;
      while(qIndex < queue.length) {
        const p = queue[qIndex++];
        region.push(p);

        const neighbors = [
            { x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y },
            { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 },
        ];

        for(const n of neighbors) {
            if(!isOnBoard(n.x, n.y, size)) continue;
            
            if (grid[n.y][n.x] !== null) {
                touchColors.add(grid[n.y][n.x]!);
            } else {
                const nKey = `${n.x},${n.y}`;
                if(!visited.has(nKey)) {
                    visited.add(nKey);
                    queue.push(n);
                }
            }
        }
      }

      // Determine ownership
      if (touchColors.size === 1) {
        const owner = Array.from(touchColors)[0];
        if (owner === 'black') {
          blackTerritory += region.length;
          region.forEach(p => map[p.y][p.x] = 1);
        } else {
          whiteTerritory += region.length;
          region.forEach(p => map[p.y][p.x] = 2);
        }
      }
    }
  }

  // Add live stones to score (Area scoring)
  for(let y=0; y<size; y++){
      for(let x=0; x<size; x++){
          if(grid[y][x] === 'black') blackTerritory++;
          if(grid[y][x] === 'white') whiteTerritory++;
      }
  }

  return { black: blackTerritory, white: whiteTerritory, territoryMap: map };
};

export const generateSGF = (history: {x: number, y: number, color: StoneColor, pass?: boolean}[], handicap: number, komi: number, size: number, winner?: string) => {
    const date = new Date().toISOString().split('T')[0];
    const alphabet = "abcdefghijklmnopqrs"; // sufficient for up to 19x19
    
    let sgf = `(;GM[1]FF[4]CA[UTF-8]AP[ZenGo]SZ[${size}]ST[2]DT[${date}]KM[${komi}]HA[${handicap}]`;
    if(winner) sgf += `RE[${winner}]`;
    
    sgf += "\n";

    history.forEach(move => {
        const c = move.color === 'black' ? 'B' : 'W';
        if (move.pass) {
            sgf += `;${c}[]`;
        } else {
            const xChar = alphabet[move.x];
            const yChar = alphabet[move.y];
            sgf += `;${c}[${xChar}${yChar}]`;
        }
    });

    sgf += ")";
    return sgf;
};
