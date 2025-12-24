import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  BoardState, StoneColor, GameConfig, Move, 
  GamePhase, Point, ScoreResult, Difficulty 
} from './types';
import { 
  createEmptyGrid, makeMove, generateSGF, 
  calculateTerritory, getHoshiPoints 
} from './utils/goLogic';
import { getAIMove } from './services/geminiService';
import GoBoard from './components/GoBoard';
import SetupModal from './components/SetupModal';
import SavedGamesModal from './components/SavedGamesModal';
import HomeScreen from './components/HomeScreen';
import { 
  RotateCcw, Flag, Download, Camera, 
  ChevronRight, Circle, Play, RefreshCw, Undo2, 
  Save, FolderOpen, Eye, SkipBack, SkipForward, FastForward, Rewind, Home, Hash, Disc, Repeat 
} from 'lucide-react';

declare global {
  interface Window {
    html2canvas: any;
  }
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

const App: React.FC = () => {
  const [grid, setGrid] = useState<(StoneColor | null)[][]>(createEmptyGrid(19));
  const [turn, setTurn] = useState<StoneColor>('black');
  const [captures, setCaptures] = useState({ black: 0, white: 0 });
  const [history, setHistory] = useState<Move[]>([]);
  
  // Initial phase is 'home'
  const [phase, setPhase] = useState<GamePhase>('home'); 
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [territoryMap, setTerritoryMap] = useState<number[][] | undefined>(undefined);
  const [notification, setNotification] = useState<string | null>(null);
  
  // New States for Review & Storage
  const [showSavedGames, setShowSavedGames] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewIndex, setReviewIndex] = useState<number>(0);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);

  const boardHistoryRef = useRef<string[]>([]);

  // Function to actually save data to localStorage
  const performSave = useCallback((currentConfig: GameConfig, currentHistory: Move[], isAuto = false) => {
      if (!currentConfig || currentHistory.length === 0) return;
      if (isReviewMode && isAuto) return; // Don't auto-save if just reviewing and resigning/exiting

      const raw = localStorage.getItem('zenGoSavedGames');
      let games = raw ? JSON.parse(raw) : [];

      const gameData = {
          id: currentGameId || Date.now().toString(),
          timestamp: Date.now(),
          config: currentConfig,
          history: currentHistory,
          autoSaved: isAuto
      };
      
      // If we have a current ID, update that specific game instead of creating a new one
      const existingIndex = games.findIndex((g: any) => g.id === currentGameId);
      
      if (existingIndex >= 0) {
          games[existingIndex] = { ...games[existingIndex], ...gameData };
      } else {
          games.push(gameData);
          if (!currentGameId) {
             setCurrentGameId(gameData.id);
          }
      }
      
      localStorage.setItem('zenGoSavedGames', JSON.stringify(games));
      
      if (!isAuto) {
          alert("棋谱已成功保存！");
      }
  }, [currentGameId, isReviewMode]);

  const startGame = (newConfig: GameConfig) => {
    const empty = createEmptyGrid(newConfig.boardSize);
    const newHistory: Move[] = [];
    let initialGrid = empty;
    let initialTurn: StoneColor = 'black';

    // Apply Handicap
    if (newConfig.handicap > 0) {
      const hoshiPoints = getHoshiPoints(newConfig.boardSize);
      const pointsToPlace = hoshiPoints.slice(0, newConfig.handicap);
      
      pointsToPlace.forEach(p => {
        initialGrid[p.y][p.x] = 'black';
        newHistory.push({ x: p.x, y: p.y, color: 'black', captures: 0 });
      });
      
      initialTurn = 'white';
    }

    setTurn(initialTurn);
    setGrid(initialGrid);
    setConfig(newConfig);
    setPhase('playing');
    setHistory(newHistory);
    setCaptures({ black: 0, white: 0 });
    setScoreResult(null);
    setTerritoryMap(undefined);
    setIsReviewMode(false);
    setCurrentGameId(Date.now().toString()); // Start with a new ID
    boardHistoryRef.current = [];
  };

  const restartGame = () => {
    if (config) {
      startGame(config);
    }
  };

  const handleIntersectionClick = useCallback(async (x: number, y: number) => {
    if (phase !== 'playing') return;
    if (isAiThinking) return;
    if (isReviewMode) return; 
    if (config?.playerColor !== turn) return; 

    executeMove(x, y, turn);
  }, [phase, isAiThinking, config, turn, isReviewMode]);

  const executeMove = (x: number, y: number, color: StoneColor, isPass = false) => {
    if (territoryMap) setTerritoryMap(undefined);

    if (isPass) {
      setHistory(prev => [...prev, { x: -1, y: -1, color, captures: 0, pass: true }]);
      setTurn(color === 'black' ? 'white' : 'black');
      
      // Check if this pass ends the game (double pass)
      const lastMove = history[history.length - 1];
      if (lastMove && lastMove.pass) {
        endGame();
      }
      return true;
    }

    const result = makeMove(grid, x, y, color);
    if (!result.success) return false;

    const boardHash = JSON.stringify(result.newGrid);
    if (boardHistoryRef.current.includes(boardHash)) {
      alert("打劫规则：不能立即全局同型。");
      return false;
    }

    setGrid(result.newGrid);
    setCaptures(prev => ({
      ...prev,
      [color]: prev[color] + result.captures
    }));
    setHistory(prev => [...prev, { x, y, color, captures: result.captures }]);
    setTurn(color === 'black' ? 'white' : 'black');
    boardHistoryRef.current.push(boardHash);

    return true;
  };

  const replayGame = (moves: Move[], targetConfig: GameConfig) => {
      const size = targetConfig.boardSize;
      let tempGrid = createEmptyGrid(size);
      let tempCaptures = { black: 0, white: 0 };
      const tempBoardHistory: string[] = [];

      moves.forEach(move => {
          if (!move.pass) {
              const res = makeMove(tempGrid, move.x, move.y, move.color);
              if (res.success) {
                  tempGrid = res.newGrid;
                  tempCaptures[move.color] += res.captures;
                  tempBoardHistory.push(JSON.stringify(tempGrid));
              }
          }
      });
      
      const lastMove = moves[moves.length - 1];
      const nextTurn = lastMove ? (lastMove.color === 'black' ? 'white' : 'black') : (targetConfig.handicap > 0 ? 'white' : 'black');

      return {
          grid: tempGrid,
          captures: tempCaptures,
          turn: nextTurn,
          boardHistory: tempBoardHistory
      };
  };

  const handleUndo = () => {
    if (isAiThinking || !config || history.length === 0 || isReviewMode) return;
    if (territoryMap) setTerritoryMap(undefined);
    if (history.length <= config.handicap) return;

    let stepsToUndo = 0;
    const lastMove = history[history.length - 1];
    
    // Simple logic: undo AI move + player move
    if (lastMove.color !== config.playerColor) {
        stepsToUndo = 2; 
    } else {
        stepsToUndo = 2; 
    }

    if (history.length - stepsToUndo < config.handicap) {
        if (history.length - 1 >= config.handicap) {
            stepsToUndo = 1;
        } else {
            return;
        }
    }

    const newHistory = history.slice(0, history.length - stepsToUndo);
    const restoredState = replayGame(newHistory, config);
    
    setHistory(newHistory);
    setGrid(restoredState.grid);
    setCaptures(restoredState.captures);
    setTurn(restoredState.turn);
    boardHistoryRef.current = restoredState.boardHistory;
    setScoreResult(null);
    setPhase('playing');
  };

  useEffect(() => {
    if (phase !== 'playing' || !config || isReviewMode) return;
    
    if (turn !== config.playerColor) {
      const performAiMove = async () => {
        setIsAiThinking(true);
        const lastMove = history.length > 0 && !history[history.length-1].pass 
            ? history[history.length-1] 
            : null;

        // Pass the selected AI Mode to the service
        const aiMove = await getAIMove(grid, turn, config.difficulty, lastMove, config.aiMode);
        
        if (aiMove === 'PASS') {
          // AI Passes
          setNotification(`AI (${DIFFICULTY_LABELS[config.difficulty]}) 停一手`);
          setTimeout(() => setNotification(null), 3000);
          executeMove(0, 0, turn, true);
        } else {
          const success = executeMove(aiMove.x, aiMove.y, turn);
          if (!success) {
            console.warn("AI illegal move, forcing pass");
            executeMove(0, 0, turn, true);
          }
        }
        setIsAiThinking(false);
      };

      performAiMove();
    }
  }, [turn, phase, config, grid, isReviewMode]);

  const endGame = () => {
    setPhase('scoring');
    calculateScore(true); 
    // Auto-save on end
    if (config && history.length > 0) {
        performSave(config, history, true);
    }
  };

  const calculateScore = (isFinal = false) => {
    if (!config) return;
    const { black: bArea, white: wArea, territoryMap } = calculateTerritory(grid);
    const komi = config.komi;
    
    const totalBlack = bArea; 
    const totalWhite = wArea + komi;

    setTerritoryMap(territoryMap);
    
    if (isFinal) {
        setScoreResult({
            blackTerritory: bArea,
            whiteTerritory: wArea,
            blackCaptures: captures.black,
            whiteCaptures: captures.white,
            komi,
            winner: totalBlack > totalWhite ? 'black' : 'white',
            margin: Math.abs(totalBlack - totalWhite)
        });
    }
  };

  const toggleEstimation = () => {
      if (territoryMap) {
          setTerritoryMap(undefined);
      } else {
          calculateScore(false);
      }
  };

  const handlePass = () => {
    if (config?.playerColor === turn) {
        executeMove(0, 0, turn, true);
        // Note: The AI response is handled in the useEffect
    }
  };
  
  const handleResign = () => {
    setPhase('finished');
    setScoreResult({
        blackTerritory: 0, whiteTerritory: 0, blackCaptures: 0, whiteCaptures: 0, komi: 0,
        winner: turn === 'black' ? 'white' : 'black',
        margin: 0 
    });
    // Auto-save on resign
    if (config && history.length > 0) {
        performSave(config, history, true);
    }
  };

  const handleManualSave = () => {
      if (config) {
          performSave(config, history);
      }
  };

  const loadSavedGame = (game: any) => {
      setConfig(game.config);
      setHistory(game.history);
      setIsReviewMode(true);
      setReviewIndex(game.history.length);
      setCurrentGameId(game.id); // Track this specific game ID
      
      const restored = replayGame(game.history, game.config);
      setGrid(restored.grid);
      setCaptures(restored.captures);
      setTurn(restored.turn);
      setPhase('playing');
      setScoreResult(null);
      setTerritoryMap(undefined);
      setShowSavedGames(false);
  };

  const jumpToMove = (index: number) => {
      if (!config) return;
      if (index < 0 || index > history.length) return;
      const partialHistory = history.slice(0, index);
      const restored = replayGame(partialHistory, config);
      setGrid(restored.grid);
      setCaptures(restored.captures);
      setReviewIndex(index);
  };

  const enterReviewMode = () => {
      setIsReviewMode(true);
      setReviewIndex(history.length);
  };

  const resumeGame = () => {
      if (config) {
        const restored = replayGame(history, config);
        setGrid(restored.grid);
        setCaptures(restored.captures);
        setTurn(restored.turn);
        setPhase('playing');
      }
      setIsReviewMode(false);
  };

  const goHome = () => {
      setPhase('home');
      setConfig(null);
      setGrid(createEmptyGrid(19));
      setCurrentGameId(null);
  };

  const downloadSGF = () => {
    if (!config) return;
    const sgfContent = generateSGF(history, config.handicap, config.komi, config.boardSize, scoreResult?.winner === 'black' ? 'B+Resign' : 'W+Resign');
    const blob = new Blob([sgfContent], { type: 'application/x-go-sgf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zengo_${new Date().getTime()}.sgf`;
    a.click();
  };

  const takeScreenshot = () => {
    const boardElement = document.getElementById('go-board-visual');
    if (boardElement && window.html2canvas) {
      window.html2canvas(boardElement).then((canvas: HTMLCanvasElement) => {
        const link = document.createElement('a');
        link.download = 'board-state.png';
        link.href = canvas.toDataURL();
        link.click();
      });
    } else {
        alert("组件未加载完成，请稍后。");
    }
  };

  const getEstimationStats = () => {
      if (!territoryMap || !config) return null;
      const { black, white } = calculateTerritory(grid);
      return { black, white, komi: config.komi };
  };
  const est = getEstimationStats();

  const isGameFinished = phase === 'scoring' || phase === 'finished';

  // --- RENDER ---

  if (phase === 'home') {
      return (
        <>
            <HomeScreen 
                onNewGame={() => setPhase('setup')}
                onHistory={() => setShowSavedGames(true)}
            />
            {showSavedGames && <SavedGamesModal onLoad={loadSavedGame} onClose={() => setShowSavedGames(false)} />}
        </>
      );
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-stone-100 font-sans">
      {phase === 'setup' && (
          <SetupModal 
            onStart={startGame} 
            onCancel={() => setPhase('home')} 
          />
      )}
      
      {showSavedGames && <SavedGamesModal onLoad={loadSavedGame} onClose={() => setShowSavedGames(false)} />}
      
      {/* Header - Z-Index boosted to 30 */}
      <header className="w-full bg-white shadow-sm p-4 flex justify-between items-center z-30 sticky top-0">
        <div className="flex items-center gap-2 cursor-pointer" onClick={goHome} title="返回首页">
           <div className="w-8 h-8 bg-stone-900 rounded-md flex items-center justify-center text-white font-bold text-xl">禅</div>
           <h1 className="text-xl font-bold text-stone-800 hidden sm:block">黑白问道</h1>
        </div>
        
        {phase === 'playing' && (
            <div className="flex items-center gap-2 bg-stone-100 rounded-full px-3 py-1 text-sm font-medium">
                {isReviewMode ? (
                    <span className="text-amber-600 flex items-center gap-1"><Eye className="w-4 h-4"/> 复盘模式</span>
                ) : (
                    <span className="text-stone-600">
                        {config?.aiMode === 'online' ? '云端对战' : '本地对战'}
                    </span>
                )}
            </div>
        )}

        <div className="flex gap-2">
             <button onClick={goHome} className="p-2 text-stone-600 hover:bg-stone-100 rounded-full" title="首页">
                <Home className="w-5 h-5" />
             </button>
             <button onClick={() => setShowSavedGames(true)} className="p-2 text-stone-600 hover:bg-stone-100 rounded-full" title="本地存档">
                <FolderOpen className="w-5 h-5" />
             </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl p-4 flex flex-col md:flex-row gap-6 items-start justify-center">
        
        {/* Left Column: Board - Added z-0 to create stacking context */}
        <div className="w-full md:flex-1 flex justify-center flex-col items-center gap-4 relative z-0">
            <GoBoard 
                grid={grid} 
                onIntersectionClick={handleIntersectionClick} 
                lastMove={history.length > 0 && !history[history.length-1].pass ? history[history.length-1] : null}
                history={history}
                territoryMap={territoryMap}
                isInteractive={phase === 'playing' && !isAiThinking && !isReviewMode}
                theme={config?.boardTheme || 'wood'}
                config={config}
                scoreResult={scoreResult}
                captures={captures}
            />
            
            {/* Notification Overlay */}
            {notification && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-black/80 text-white px-6 py-3 rounded-full shadow-xl animate-in fade-in zoom-in duration-300 pointer-events-none">
                    {notification}
                </div>
            )}
            
            {/* Review Controls (Only visible in review mode) */}
            {isReviewMode && (
                <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-stone-200">
                    <button onClick={() => jumpToMove(0)} className="p-2 hover:bg-stone-100 rounded"><Rewind className="w-5 h-5"/></button>
                    <button onClick={() => jumpToMove(reviewIndex - 1)} className="p-2 hover:bg-stone-100 rounded"><SkipBack className="w-5 h-5"/></button>
                    <span className="font-mono text-sm w-16 text-center">{reviewIndex} / {history.length}</span>
                    <button onClick={() => jumpToMove(reviewIndex + 1)} className="p-2 hover:bg-stone-100 rounded"><SkipForward className="w-5 h-5"/></button>
                    <button onClick={() => jumpToMove(history.length)} className="p-2 hover:bg-stone-100 rounded"><FastForward className="w-5 h-5"/></button>
                </div>
            )}
        </div>

        {/* Right Column: Control Center */}
        <div className="w-full md:w-80 flex flex-col gap-4">
            
            {/* Main Control Panel */}
            <div className="bg-white p-5 rounded-xl shadow-md border border-stone-200 transition-all duration-300">
                
                {/* 1. Game Status Bar */}
                <div className="flex items-center justify-between bg-stone-50 p-3 rounded-lg border border-stone-100 mb-4">
                    <div className="flex items-center gap-2">
                        {isAiThinking ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
                        ) : (
                            isGameFinished ? (
                                <Flag className="w-4 h-4 text-stone-500 fill-current" />
                            ) : (
                                <Disc className={`w-4 h-4 ${turn === 'black' ? 'text-black fill-current' : 'text-stone-400'}`} />
                            )
                        )}
                        <span className="text-sm font-bold text-stone-700">
                             {isAiThinking ? 'AI 思考中...' : (isGameFinished ? '对局结束' : (turn === 'black' ? '黑方落子' : '白方落子'))}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-stone-500 bg-white px-2 py-1 rounded border border-stone-200">
                        <Hash className="w-3 h-3" />
                        <span className="font-mono">{history.length}</span>
                    </div>
                </div>

                {/* 2. Estimation Details (Conditional) */}
                {territoryMap && est && (
                    <div className="mb-4 bg-amber-50 rounded-lg p-3 border border-amber-100 animate-in fade-in slide-in-from-top-2">
                        <div className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1">
                            <Eye className="w-3 h-3" /> 形势判断 (预估)
                        </div>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between items-center text-stone-800">
                                <span className="flex items-center gap-1"><div className="w-2 h-2 bg-black rounded-full"></div> 黑方</span>
                                <span className="font-mono">{est.black} 目</span>
                            </div>
                            <div className="flex justify-between items-center text-stone-600">
                                <span className="flex items-center gap-1"><div className="w-2 h-2 bg-white border border-stone-300 rounded-full"></div> 白方 (+{est.komi})</span>
                                <span className="font-mono">{est.white + est.komi} 目</span>
                            </div>
                            <div className="border-t border-amber-200/50 mt-1 pt-1 flex justify-between items-center font-bold text-amber-700">
                                <span>领先</span>
                                <span>
                                    {est.black > (est.white + est.komi) ? '黑' : '白'} +{Math.abs(est.black - (est.white + est.komi)).toFixed(1)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. Action Buttons Grid */}
                {isGameFinished ? (
                     <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                        <button 
                            onClick={restartGame}
                            className="w-full py-3 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 flex items-center justify-center gap-2 shadow-sm transition-colors"
                        >
                            <Repeat className="w-4 h-4" /> 再来一局
                        </button>
                        
                         <button 
                            onClick={() => setPhase('home')}
                            className="w-full py-3 bg-stone-100 text-stone-700 font-bold rounded-lg hover:bg-stone-200 flex items-center justify-center gap-2 transition-colors"
                        >
                            <Home className="w-4 h-4" /> 返回首页
                        </button>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100 mt-2">
                             <button 
                                onClick={handleManualSave}
                                className="py-2 text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 flex items-center justify-center gap-1 transition-colors text-sm" 
                            >
                                <Save className="w-4 h-4" /> 保存
                            </button>
                            <button 
                                onClick={enterReviewMode}
                                className="py-2 text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 flex items-center justify-center gap-1 transition-colors text-sm"
                            >
                                <RotateCcw className="w-4 h-4"/> 复盘
                            </button>
                        </div>
                         <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={downloadSGF} 
                                className="py-2 text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 flex items-center justify-center gap-1 transition-colors text-sm" 
                            >
                                <Download className="w-4 h-4" /> SGF
                            </button>
                            <button 
                                onClick={takeScreenshot} 
                                className="py-2 text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 flex items-center justify-center gap-1 transition-colors text-sm" 
                            >
                                <Camera className="w-4 h-4" /> 截图
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {isReviewMode ? (
                             <button 
                                onClick={resumeGame}
                                className="w-full py-3 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 flex items-center justify-center gap-2 transition-colors shadow-sm"
                            >
                                <Play className="w-4 h-4" /> 结束复盘
                            </button>
                        ) : (
                            <>
                                {/* Primary Gameplay Actions */}
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={handlePass}
                                        disabled={turn !== config?.playerColor || isAiThinking}
                                        className="py-2.5 bg-stone-100 text-stone-700 font-medium rounded-lg text-sm hover:bg-stone-200 disabled:opacity-50 transition-colors"
                                    >
                                        停一手
                                    </button>
                                    <button 
                                        onClick={handleUndo}
                                        disabled={isAiThinking || history.length <= (config?.handicap || 0)}
                                        className="py-2.5 bg-stone-100 text-stone-700 font-medium rounded-lg text-sm hover:bg-stone-200 disabled:opacity-50 flex items-center justify-center gap-1 transition-colors"
                                    >
                                        <Undo2 className="w-4 h-4"/> 悔棋
                                    </button>
                                </div>
                                
                                {/* Analysis Tools */}
                                <button 
                                    onClick={toggleEstimation}
                                    className={`w-full py-2.5 border rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${territoryMap ? 'bg-amber-100 border-amber-300 text-amber-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                                >
                                    <Eye className="w-4 h-4" /> 
                                    {territoryMap ? '关闭形势判断' : '形势判断'}
                                </button>
                                
                                {/* System Tools */}
                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-100 mt-2">
                                    <button 
                                        onClick={handleManualSave}
                                        className="p-2 text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 flex flex-col items-center justify-center gap-1 transition-colors" 
                                        title="保存"
                                    >
                                        <Save className="w-4 h-4" /> 
                                        <span className="text-[10px]">保存</span>
                                    </button>
                                    <button 
                                        onClick={downloadSGF} 
                                        className="p-2 text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 flex flex-col items-center justify-center gap-1 transition-colors" 
                                        title="SGF"
                                    >
                                        <Download className="w-4 h-4" /> 
                                        <span className="text-[10px]">SGF</span>
                                    </button>
                                    <button 
                                        onClick={takeScreenshot} 
                                        className="p-2 text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 flex flex-col items-center justify-center gap-1 transition-colors" 
                                        title="截图"
                                    >
                                        <Camera className="w-4 h-4" /> 
                                        <span className="text-[10px]">截图</span>
                                    </button>
                                </div>

                                {/* Danger / Meta Actions */}
                                <div className="grid grid-cols-2 gap-2 pt-2">
                                    <button 
                                        onClick={enterReviewMode}
                                        className="py-2 border border-stone-200 text-stone-500 rounded-lg text-xs hover:bg-stone-50 flex items-center justify-center gap-1 transition-colors"
                                    >
                                        <RotateCcw className="w-3 h-3"/> 复盘模式
                                    </button>
                                    <button 
                                        onClick={handleResign}
                                        className="py-2 border border-red-100 text-red-400 rounded-lg text-xs hover:bg-red-50 hover:text-red-600 transition-colors"
                                    >
                                        认输
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
      </main>
      
      {/* Footer Version Info */}
      <footer className="py-4 text-stone-400 text-xs font-mono opacity-50">
        v1.0
      </footer>
    </div>
  );
};

export default App;