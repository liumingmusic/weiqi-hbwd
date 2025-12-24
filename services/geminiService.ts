import { GoogleGenAI } from "@google/genai";
import { StoneColor, Difficulty, AiMode, TsumegoProblem } from "../types";
import { makeMove, getGroupInfo, getHoshiPoints, getOpponent } from "../utils/goLogic";

// --- HELPERS ---

// Helper: Check if a move fills one's own simple eye (Bad move usually)
const isEye = (grid: (StoneColor | null)[][], x: number, y: number, color: StoneColor): boolean => {
    const size = grid.length;
    // 1. Orthogonal check
    const neighbors = [
        { x: x + 1, y: y }, { x: x - 1, y: y },
        { x: x, y: y + 1 }, { x: x, y: y - 1 }
    ];
    for (const n of neighbors) {
        if (n.x >= 0 && n.x < size && n.y >= 0 && n.y < size) {
            if (grid[n.y][n.x] !== color) return false;
        }
    }
    // 2. Diagonal check (simplified)
    let diagEnemyCount = 0;
    const diagonals = [
        { x: x + 1, y: y + 1 }, { x: x - 1, y: y - 1 },
        { x: x - 1, y: y + 1 }, { x: x + 1, y: y - 1 }
    ];
    for (const d of diagonals) {
        if (d.x >= 0 && d.x < size && d.y >= 0 && d.y < size) {
            if (grid[d.y][d.x] !== color && grid[d.y][d.x] !== null) diagEnemyCount++;
        }
    }
    return diagEnemyCount < 2;
};

// Helper: Evaluate Shape (3x3 pattern)
// Returns a score bonus/penalty
const getShapeScore = (grid: (StoneColor | null)[][], x: number, y: number, color: StoneColor): number => {
    const size = grid.length;
    let score = 0;
    
    // Check for "Empty Triangle" (Bad shape) - Simple detection
    // X X
    // X .  <- if we play at dot, and it forms a clumpsy triangle
    const neighbors = [
        {dx: 1, dy: 0}, {dx: 0, dy: 1}, {dx: -1, dy: 0}, {dx: 0, dy: -1}
    ];

    let friendlyNeighbors = 0;
    let emptyNeighbors = 0;
    
    neighbors.forEach(n => {
        const nx = x + n.dx;
        const ny = y + n.dy;
        if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
            if (grid[ny][nx] === color) friendlyNeighbors++;
            else if (grid[ny][nx] === null) emptyNeighbors++;
        }
    });

    // Penalize over-concentration (Dumpling shape / Empty triangle candidate)
    if (friendlyNeighbors >= 3) {
        score -= 40;
    }

    // Tiger's mouth detection (simplified) - Good Shape
    // . X
    // X . <- Play here
    const diagonals = [
        {dx: 1, dy: 1}, {dx: -1, dy: -1}, {dx: -1, dy: 1}, {dx: 1, dy: -1}
    ];
    
    // Check Hane (Head of two stones)
    // O O
    // X . <- Play here to hane
    const opponent = getOpponent(color);
    neighbors.forEach(n => {
        const nx = x + n.dx;
        const ny = y + n.dy;
        if (nx >=0 && nx < size && ny >= 0 && ny < size && grid[ny][nx] === opponent) {
             // If opponent has another opponent stone next to it
             neighbors.forEach(n2 => {
                 const nnx = nx + n2.dx;
                 const nny = ny + n2.dy;
                 if (nnx >=0 && nnx < size && nny >= 0 && nny < size && grid[nny][nnx] === opponent) {
                     // Check if this move 'heads' them.
                     score += 15; // Hane bonus
                 }
             });
        }
    });

    return score;
}

// --- LOCAL AI ENGINE LOGIC ---
const getLocalMove = async (
    grid: (StoneColor | null)[][],
    aiColor: StoneColor,
    difficulty: Difficulty,
    lastMove: {x: number, y: number} | null
): Promise<{x: number, y: number} | 'PASS'> => {
    
    // Simulate thinking time based on difficulty
    let thinkTime = 300;
    if (difficulty === 'novice') thinkTime = 200;
    else if (difficulty === 'intermediate') thinkTime = 500;
    else if (difficulty === 'master') thinkTime = 800;
    else if (difficulty === 'grandmaster') thinkTime = 1000;
    
    await new Promise(resolve => setTimeout(resolve, thinkTime));

    const size = grid.length;
    const opponent = getOpponent(aiColor);
    const validMoves: {x: number, y: number, score: number}[] = [];
    
    // Game Stage Analysis
    let movesCount = 0;
    for(let r=0; r<size; r++) for(let c=0; c<size; c++) if(grid[r][c]) movesCount++;

    const isOpening = movesCount < (size === 19 ? 50 : 20);
    const isEndGame = movesCount > (size * size * 0.85);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (grid[y][x] !== null) continue;

            // 0. PRE-FILTER: Don't fill own eye unless it captures something
            // We check this loosely here, will verify capture later
            const looksLikeEye = isEye(grid, x, y, aiColor);

            // 1. SIMULATE THE MOVE
            const result = makeMove(grid, x, y, aiColor);
            if (!result.success) continue; // Illegal move

            // --- BASE NOISE (Randomness) ---
            let noiseRange = 0;
            switch (difficulty) {
                case 'novice': noiseRange = 80; break;
                case 'entry': noiseRange = 60; break;
                case 'beginner': noiseRange = 50; break;
                case 'elementary': noiseRange = 30; break;
                case 'intermediate': noiseRange = 15; break;
                case 'advanced': noiseRange = 8; break;
                case 'master': noiseRange = 3; break;
                case 'grandmaster': noiseRange = 0; break; // Pure calculation
            }
            let score = Math.random() * noiseRange;

            // --- TACTICAL ANALYSIS (Life & Death) ---

            const { liberties: myLiberties } = getGroupInfo(result.newGrid, x, y);
            const myLibCount = myLiberties.length;
            const captures = result.captures;

            // A. Capturing Stones (Huge Bonus)
            if (captures > 0) {
                score += 800; // Base capture bonus
                score += captures * 100; // More stones = better
                
                // If we captured, and it was a "Self-Atari" (1 liberty left), it's usually okay because we resolved a fight.
                // But if we captured 1 stone and are still in Atari, it might be a "Snapback" trap.
                if (myLibCount === 1 && captures === 1) {
                    score -= 300; // Caution against snapbacks
                }
            }

            // B. Self-Atari Check (CRITICAL for weak AI prevention)
            if (myLibCount === 1) {
                if (captures === 0) {
                     // If we didn't capture, playing into Atari is usually suicide or bad reading.
                     // Novice might do it, Grandmaster never does unless it's a specific sacrifice (too complex for this heuristic).
                     const penalty = ['master', 'grandmaster', 'advanced'].includes(difficulty) ? 5000 : 200;
                     score -= penalty;
                }
            } else if (myLibCount === 2) {
                // Shortage of liberties warning
                if (['master', 'grandmaster'].includes(difficulty)) {
                    score -= 20; 
                }
            }

            // C. Save Own Stones (Atari Defense)
            const neighbors = [{x:x+1,y}, {x:x-1,y}, {x,y:y+1}, {x,y:y-1}];
            let savedGroupBonus = 0;
            for (const n of neighbors) {
                if (n.x >=0 && n.x < size && n.y >= 0 && n.y < size) {
                    if (grid[n.y][n.x] === aiColor) {
                        const preGroup = getGroupInfo(grid, n.x, n.y);
                        // If a neighbor group was in Atari (1 liberty) and now has more
                        if (preGroup.liberties.length === 1 && myLibCount > 1) {
                            savedGroupBonus = 600 + (preGroup.group.length * 50);
                        }
                    }
                }
            }
            score += savedGroupBonus;

            // D. Atari Attack (Putting opponent in Atari)
            let atariAttackBonus = 0;
            for (const n of neighbors) {
                if (n.x >=0 && n.x < size && n.y >= 0 && n.y < size) {
                    if (result.newGrid[n.y][n.x] === opponent) {
                        const enemyGroup = getGroupInfo(result.newGrid, n.x, n.y);
                        if (enemyGroup.liberties.length === 1) {
                            // We put them in Atari!
                            atariAttackBonus += 150 + (enemyGroup.group.length * 20);
                        }
                        // Cut check: If we reduced their liberties significantly
                        const preEnemyGroup = getGroupInfo(grid, n.x, n.y);
                        if (preEnemyGroup.liberties.length > enemyGroup.liberties.length) {
                             score += 10; // Pressure bonus
                        }
                    }
                }
            }
            score += atariAttackBonus;

            // --- STRATEGIC ANALYSIS ---

            // E. Opening Theory (High weights for corners/sides early game)
            if (isOpening) {
                const distToEdgeX = Math.min(x, size - 1 - x);
                const distToEdgeY = Math.min(y, size - 1 - y);
                
                // Star points (4,4), Komoku (3,4), Sansan (3,3)
                // In 0-indexed: 3, 2
                const isThirdLine = distToEdgeX === 2 || distToEdgeY === 2;
                const isFourthLine = distToEdgeX === 3 || distToEdgeY === 3;

                if (isThirdLine && isFourthLine) {
                    score += 120; // Prime corners (3-4 points)
                } else if (isFourthLine && isFourthLine) {
                    score += 100; // Star points (4-4)
                } else if (isThirdLine && isThirdLine) {
                    score += 80; // Sansan (3-3)
                }
                
                // Edge Avoidance in opening
                if (distToEdgeX === 0 || distToEdgeY === 0) score -= 100;
                if (distToEdgeX === 1 || distToEdgeY === 1) score -= 50;

                // Center Avoidance in opening (unless specific fighting)
                if (distToEdgeX > 4 && distToEdgeY > 4) score -= 10;
            }

            // F. Proximity / Local Fighting
            if (lastMove && !isOpening) {
                const dist = Math.abs(x - lastMove.x) + Math.abs(y - lastMove.y);
                // Respond locally
                if (dist <= 2) score += 40;
                else if (dist <= 4) score += 20;
            }

            // G. Shape Analysis (Master/Grandmaster only)
            if (['advanced', 'master', 'grandmaster'].includes(difficulty)) {
                score += getShapeScore(grid, x, y, aiColor);
            }

            // H. Don't fill own eyes (Severe Penalty)
            if (looksLikeEye && captures === 0) {
                score -= 10000;
            }
            
            // I. End Game: Avoid DAME (neutral points) if possible unless necessary
            if (isEndGame && captures === 0 && savedGroupBonus === 0 && atariAttackBonus === 0) {
                 // Check if it's territory boundary or just neutral
                 // Simplified: small penalty to encourage passing if only dame left
                 if (score < 10) score -= 5;
            }

            validMoves.push({x, y, score});
        }
    }

    if (validMoves.length === 0) return 'PASS';
    
    // Sort moves by score descending
    validMoves.sort((a, b) => b.score - a.score);

    // Filter out moves that are terrible relative to the best move (Pruning)
    const bestScore = validMoves[0].score;
    
    // PASS Logic
    // If the best move is negative or very low value in endgame, pass.
    let passThreshold = -500;
    if (isEndGame) passThreshold = 5; // In endgame, if no move gives points, pass
    
    // However, basic AI shouldn't pass too early
    if (bestScore < passThreshold) {
        return 'PASS';
    }

    // Selection Logic based on difficulty
    let topN = 1;
    switch (difficulty) {
        case 'novice': topN = validMoves.length; break; // Anything goes
        case 'entry': topN = 20; break;
        case 'beginner': topN = 10; break;
        case 'elementary': topN = 5; break;
        case 'intermediate': topN = 3; break;
        case 'advanced': topN = 2; break;
        case 'master': topN = 2; break; // Slight variety
        case 'grandmaster': topN = 1; break; // Always the best calculated move
    }

    // Ensure we don't crash if topN > validMoves
    const candidates = validMoves.slice(0, Math.min(topN, validMoves.length));
    
    // Select randomly from candidates (weighted by rank?)
    // For lower levels, uniform random among candidates.
    // For higher levels, bias towards index 0.
    let selectedIndex = 0;
    if (difficulty === 'grandmaster') {
        selectedIndex = 0;
    } else {
        selectedIndex = Math.floor(Math.random() * candidates.length);
    }

    return candidates[selectedIndex];
};

// --- REMOTE GEMINI LOGIC ---
const formatBoard = (grid: (StoneColor | null)[][]): string => {
  const size = grid.length;
  const ALPHABET = "ABCDEFGHJKLMNOPQRST";
  const cols = ALPHABET.slice(0, size);
  let output = "   " + cols.split('').join(' ') + "\n";
  for (let y = 0; y < size; y++) {
    const rowNum = size - y;
    const rowNumStr = rowNum < 10 ? ` ${rowNum}` : `${rowNum}`;
    let rowStr = `${rowNumStr} `;
    for (let x = 0; x < size; x++) {
      const cell = grid[y][x];
      rowStr += (cell === 'black' ? 'X' : cell === 'white' ? 'O' : '.') + " ";
    }
    output += rowStr + `${rowNum}\n`;
  }
  return output;
};

const getRemoteMove = async (
    grid: (StoneColor | null)[][],
    aiColor: StoneColor,
    difficulty: Difficulty,
    lastMove: {x: number, y: number} | null
): Promise<{x: number, y: number} | 'PASS'> => {
    
    if (!process.env.API_KEY) throw new Error("No API Key");

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const size = grid.length;
    const boardStr = formatBoard(grid);
    const colorStr = aiColor === 'black' ? 'Black (X)' : 'White (O)';
    const modelName = 'gemini-3-flash-preview';

    let levelDesc = "";
    switch(difficulty) {
        case 'novice': levelDesc = "play like a complete novice who barely knows the rules, making random moves."; break;
        case 'entry': levelDesc = "play like a beginner who makes many mistakes."; break;
        case 'beginner': levelDesc = "play like a weak amateur (20k-15k level)."; break;
        case 'elementary': levelDesc = "play like an average amateur (15k-10k level)."; break;
        case 'intermediate': levelDesc = "play like a solid amateur (10k-5k level)."; break;
        case 'advanced': levelDesc = "play like a strong amateur (single digit kyu to 1 dan)."; break;
        case 'master': levelDesc = "play like a professional go player."; break;
        case 'grandmaster': levelDesc = "play like a world champion or superhuman AI (9 dan pro level)."; break;
    }

    let systemInstruction = `You are a Go AI. Board size: ${size}x${size}. You must ${levelDesc}`;
    if (['master', 'grandmaster', 'advanced'].includes(difficulty)) {
        systemInstruction += " If there are no profitable moves left (game is over), you MUST pass.";
    }

    const prompt = `
      Board:\n${boardStr}
      You: ${colorStr}
      Last Move: ${lastMove ? `x=${lastMove.x},y=${lastMove.y}` : 'None'}
      Task: Return JSON {"x": int, "y": int} or {"pass": true}.
      If the board is settled, return {"pass": true}.
    `;

    const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: { systemInstruction, responseMimeType: "application/json" }
    });

    const result = JSON.parse(response.text || "{}");
    if (result.pass) return 'PASS';
    if (typeof result.x === 'number' && typeof result.y === 'number') {
        return { x: result.x, y: result.y };
    }
    throw new Error("Invalid format");
};

// --- MAIN AI EXPORT ---
export const getAIMove = async (
  grid: (StoneColor | null)[][],
  aiColor: StoneColor,
  difficulty: Difficulty,
  lastMove: {x: number, y: number} | null,
  aiMode: AiMode
): Promise<{x: number, y: number} | 'PASS'> => {
  
  if (aiMode === 'online') {
      if (navigator.onLine && process.env.API_KEY) {
          try {
              const move = await getRemoteMove(grid, aiColor, difficulty, lastMove);
              return move;
          } catch (e) {
              console.warn("Online AI failed, attempting fallback...", e);
          }
      } else {
          console.warn("Offline or missing Key, using Local AI.");
      }
  }

  // Local Mode (or fallback)
  return getLocalMove(grid, aiColor, difficulty, lastMove);
};
