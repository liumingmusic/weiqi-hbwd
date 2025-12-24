
export type StoneColor = 'black' | 'white';
export type PlayerType = 'human' | 'ai';
export type GamePhase = 'home' | 'setup' | 'playing' | 'scoring' | 'finished' | 'tsumego-list' | 'tsumego-playing';
export type Difficulty = 'novice' | 'entry' | 'beginner' | 'elementary' | 'intermediate' | 'advanced' | 'master' | 'grandmaster';
export type BoardTheme = 'wood' | 'warm' | 'green' | 'dark' | 'paper';
export type AiMode = 'local' | 'online';

export interface Point {
  x: number;
  y: number;
}

export interface BoardState {
  grid: (StoneColor | null)[][];
  size: number;
}

export interface Move {
  x: number;
  y: number;
  color: StoneColor;
  captures: number;
  pass?: boolean;
}

export interface GameConfig {
  boardSize: number; // 9, 13, 19
  boardTheme: BoardTheme;
  handicap: number;
  playerColor: StoneColor; // The human's color
  difficulty: Difficulty;
  komi: number;
  aiMode: AiMode;
}

export interface ScoreResult {
  blackTerritory: number;
  whiteTerritory: number;
  blackCaptures: number;
  whiteCaptures: number;
  komi: number;
  winner: StoneColor;
  margin: number;
}

export interface TsumegoNode {
    // Key is "x,y" of the user's move
    [key: string]: {
        response?: Point; // AI's response move
        next?: TsumegoNode; // Next set of valid branches
        status: 'correct' | 'wrong' | 'continue';
        message?: string; // Feedback message
    };
}

export interface TsumegoProblem {
    id: string;
    title: string;
    description: string;
    difficulty: Difficulty;
    boardSize: number;
    initialStones: { x: number, y: number, color: StoneColor }[];
    solutionTree: TsumegoNode;
}
