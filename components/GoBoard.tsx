import React, { useRef, useMemo } from 'react';
import { StoneColor, Point, BoardTheme, Move, GameConfig, ScoreResult, Difficulty } from '../types';
import { getHoshiPoints } from '../utils/goLogic';
import { User, Bot, Crown } from 'lucide-react';

interface GoBoardProps {
  grid: (StoneColor | null)[][];
  onIntersectionClick: (x: number, y: number) => void;
  lastMove: Point | null;
  history: Move[];
  territoryMap?: number[][];
  isInteractive: boolean;
  theme: BoardTheme;
  config?: GameConfig | null;
  scoreResult?: ScoreResult | null;
  captures?: { black: number, white: number };
}

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
    novice: '小白',
    entry: '入门',
    beginner: '新手',
    elementary: '初级',
    intermediate: '中级',
    advanced: '高级',
    master: '大师',
    grandmaster: '特级'
};

const GoBoard: React.FC<GoBoardProps> = ({ 
  grid, 
  onIntersectionClick, 
  lastMove, 
  history,
  territoryMap, 
  isInteractive,
  theme,
  config,
  scoreResult,
  captures
}) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const size = grid.length;
  const hoshiPoints = getHoshiPoints(size);

  const isHoshi = (x: number, y: number) => hoshiPoints.some(p => p.x === x && p.y === y);

  // Create a map of coordinate "x,y" -> moveNumber
  const moveNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    history.forEach((move, index) => {
        if (!move.pass) {
            map.set(`${move.x},${move.y}`, index + 1);
        }
    });
    return map;
  }, [history]);

  // Theme configuration
  const getThemeStyles = (t: BoardTheme) => {
      switch(t) {
          case 'warm': return { bg: '#f5e6bb', line: '#594a2a', star: '#594a2a', footer: 'bg-stone-800' }; 
          case 'green': return { bg: '#3a5f45', line: '#aebfbe', star: '#aebfbe', footer: 'bg-stone-900' };
          case 'dark': return { bg: '#2d2d2d', line: '#888888', star: '#888888', footer: 'bg-black' };
          case 'paper': return { bg: '#f0f0f0', line: '#333333', star: '#333333', footer: 'bg-stone-800' };
          case 'wood': 
          default:
             return { bg: '', line: '#000000', star: '#000000', className: 'wood-texture', footer: 'bg-stone-900' }; 
      }
  };

  const styles = getThemeStyles(theme);
  
  // Player Identification
  const isPlayerBlack = config?.playerColor === 'black';
  const playerLabel = "我";
  const aiLabel = `AI (${config ? DIFFICULTY_LABELS[config.difficulty] : ''})`;

  // Winner logic
  const isGameOver = !!scoreResult;
  const winnerColor = scoreResult?.winner;
  const winMargin = scoreResult?.margin;

  // Active Player Logic
  const currentTurn = history.length === 0 ? 'black' : (history[history.length-1].color === 'black' ? 'white' : 'black');

  return (
    <div 
      id="go-board-visual"
      className="flex flex-col shadow-2xl rounded-lg overflow-hidden ring-1 ring-black/5"
      style={{ maxWidth: '650px', width: '100%' }}
    >
        {/* Main Board Area */}
        <div 
        ref={boardRef}
        className={`relative select-none p-1 sm:p-2 transition-colors duration-500 ${styles.className || ''}`}
        style={{
            width: '100%',
            aspectRatio: '1/1',
            backgroundColor: styles.bg || undefined
        }}
        >
        <div 
            className="w-full h-full border border-opacity-20"
            style={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(${size}, 1fr)`, 
            gridTemplateRows: `repeat(${size}, 1fr)`,
            borderColor: styles.line
            }}
        >
            {grid.map((row, y) => (
                row.map((stone, x) => {
                    const territoryOwner = territoryMap ? territoryMap[y][x] : 0;
                    const moveNum = moveNumberMap.get(`${x},${y}`);
                    
                    const isTop = y === 0;
                    const isBottom = y === size - 1;
                    const isLeft = x === 0;
                    const isRight = x === size - 1;

                    return (
                        <div
                            key={`${x}-${y}`}
                            onClick={() => isInteractive && onIntersectionClick(x, y)}
                            className={`relative flex items-center justify-center ${isInteractive ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                            {/* Lines */}
                            <div className="absolute h-px pointer-events-none" style={{ backgroundColor: styles.line, top: '50%', left: isLeft ? '50%' : '0', right: isRight ? '50%' : '0', transform: 'translateY(-50%)' }} />
                            <div className="absolute w-px pointer-events-none" style={{ backgroundColor: styles.line, left: '50%', top: isTop ? '50%' : '0', bottom: isBottom ? '50%' : '0', transform: 'translateX(-50%)' }} />

                            {/* Star Point */}
                            {isHoshi(x, y) && ( <div className="absolute w-[18%] h-[18%] rounded-full z-0 pointer-events-none" style={{ backgroundColor: styles.star }} /> )}

                            {/* Ghost Stone */}
                            {isInteractive && !stone && ( <div className="w-[90%] h-[90%] rounded-full opacity-0 hover:opacity-40 bg-black transition-opacity z-10 absolute" /> )}

                            {/* Stone */}
                            {stone && (
                                <div className={`w-[95%] h-[95%] rounded-full shadow-md z-20 relative flex items-center justify-center origin-center animate-stone-drop ${ stone === 'black' ? 'bg-gradient-to-br from-gray-800 to-black ring-1 ring-white/5' : 'bg-gradient-to-br from-white to-gray-200 ring-1 ring-black/10' }`}>
                                    {moveNum !== undefined && ( <span className={`text-[8px] sm:text-[10px] md:text-xs font-sans font-medium opacity-90 ${ stone === 'black' ? 'text-white' : 'text-black' }`}> {moveNum} </span> )}
                                    {lastMove && lastMove.x === x && lastMove.y === y && ( <div className={`absolute top-0 left-0 w-full h-full rounded-full border-2 ${stone === 'black' ? 'border-white/50' : 'border-black/50'}`} /> )}
                                </div>
                            )}

                            {/* Territory Marker */}
                            {!stone && territoryOwner !== 0 && (
                                <div className={`absolute w-3 h-3 z-10 opacity-80 shadow-sm ${territoryOwner === 1 ? 'bg-black' : 'bg-white border border-gray-400'}`} style={{ backgroundColor: territoryOwner === 1 ? styles.line : '#ffffff' }} />
                            )}
                        </div>
                    );
                })
            ))}
        </div>
        </div>

        {/* Atmospheric Status/Result Footer */}
        {config && (
            <div className={`relative p-4 text-white flex items-center justify-between overflow-hidden ${styles.footer}`}>
                 {/* Background Effects for Game Over */}
                {isGameOver && (
                    <div className={`absolute inset-0 bg-gradient-to-r ${winnerColor === 'black' ? 'from-amber-900/50 via-stone-900/50 to-stone-900' : 'from-stone-900 via-stone-900/50 to-amber-900/50'} z-0`}></div>
                )}

                {/* Black Player Info */}
                <div className={`relative z-10 flex flex-col items-center gap-2 transition-all duration-500 min-w-[80px] ${!isGameOver && currentTurn === 'black' ? 'scale-105 opacity-100' : 'opacity-70'} ${isGameOver && winnerColor !== 'black' ? 'blur-[1px] opacity-40' : ''}`}>
                    <div className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full ${!isGameOver && currentTurn === 'black' ? 'bg-white/10 ring-1 ring-white/20 shadow-lg' : ''}`}>
                        <div className="w-4 h-4 rounded-full bg-black ring-1 ring-white/30 shadow-sm"></div>
                        <span className="text-sm font-bold tracking-wide text-stone-100">
                            {isPlayerBlack ? playerLabel : aiLabel}
                        </span>
                        {isPlayerBlack && <User className="w-3 h-3 text-stone-400" />}
                        {!isPlayerBlack && <Bot className="w-3 h-3 text-stone-400" />}
                        
                        {/* Active Indicator Dot */}
                        {!isGameOver && currentTurn === 'black' && (
                             <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></span>
                        )}
                    </div>
                    {captures && <div className="text-[10px] text-stone-400 font-mono bg-black/20 px-2 py-0.5 rounded">提子: {captures.black}</div>}
                </div>

                {/* Center Status / Grand Result Display */}
                <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-2">
                    {isGameOver ? (
                        <div className="flex flex-col items-center animate-in zoom-in slide-in-from-bottom-4 duration-500">
                             <div className="flex items-center gap-2 mb-1">
                                 {winnerColor === 'black' && <Crown className="w-6 h-6 text-amber-400 fill-amber-400 animate-bounce" />}
                                 <span className="text-3xl sm:text-4xl font-serif font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 drop-shadow-sm tracking-tight">
                                    {winnerColor === 'black' ? '黑方胜' : '白方胜'}
                                 </span>
                                 {winnerColor === 'white' && <Crown className="w-6 h-6 text-amber-400 fill-amber-400 animate-bounce" />}
                             </div>
                             <div className="flex items-center gap-2 text-xs sm:text-sm text-amber-200/80 font-medium tracking-widest uppercase">
                                <span className="bg-gradient-to-r from-transparent via-amber-500/20 to-transparent px-4 py-0.5 border-y border-amber-500/20">
                                    胜 {winMargin?.toFixed(1)} 目
                                </span>
                             </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-1 opacity-50">
                             <div className="w-16 h-px bg-white/20"></div>
                             <div className="text-[12px] tracking-[0.2em] text-stone-400 font-bold">对弈</div>
                             <div className="w-16 h-px bg-white/20"></div>
                        </div>
                    )}
                </div>

                {/* White Player Info */}
                <div className={`relative z-10 flex flex-col items-center gap-2 transition-all duration-500 min-w-[80px] ${!isGameOver && currentTurn === 'white' ? 'scale-105 opacity-100' : 'opacity-70'} ${isGameOver && winnerColor !== 'white' ? 'blur-[1px] opacity-40' : ''}`}>
                    <div className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full ${!isGameOver && currentTurn === 'white' ? 'bg-white/10 ring-1 ring-white/20 shadow-lg' : ''}`}>
                        {!isPlayerBlack && <User className="w-3 h-3 text-stone-400" />}
                        {isPlayerBlack && <Bot className="w-3 h-3 text-stone-400" />}
                        <span className="text-sm font-bold tracking-wide text-stone-100">
                            {!isPlayerBlack ? playerLabel : aiLabel}
                        </span>
                        <div className="w-4 h-4 rounded-full bg-white shadow-sm"></div>

                        {/* Active Indicator Dot */}
                        {!isGameOver && currentTurn === 'white' && (
                             <span className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></span>
                        )}
                    </div>
                    {captures && <div className="text-[10px] text-stone-400 font-mono bg-black/20 px-2 py-0.5 rounded">提子: {captures.white}</div>}
                </div>
            </div>
        )}
    </div>
  );
};

export default GoBoard;