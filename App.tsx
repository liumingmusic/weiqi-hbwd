import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  BoardState, StoneColor, GameConfig, Move, 
  GamePhase, Point, ScoreResult, Difficulty, TsumegoProblem, TsumegoNode
} from './types';
import { 
  createEmptyGrid, makeMove, generateSGF, 
  calculateTerritory, getHoshiPoints 
} from './utils/goLogic';
import { tsumegoProblems } from './utils/tsumegoData';
import { getAIMove } from './services/geminiService';
import GoBoard from './components/GoBoard';
import SetupModal from './components/SetupModal';
import SavedGamesModal from './components/SavedGamesModal';
import HomeScreen from './components/HomeScreen';
import TsumegoList from './components/TsumegoList';
import { 
  RotateCcw, Flag, Download, Camera, 
  ChevronRight, Circle, Play, RefreshCw, Undo2, 
  Save, FolderOpen, Eye, SkipBack, SkipForward, FastForward, Rewind, Home, Hash, Disc, Repeat, ArrowLeft, Lightbulb 
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
  
  // Phase state
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

  // Tsumego States
  const [currentTsumego, setCurrentTsumego] = useState<TsumegoProblem | null>(null);
  const [tsumegoNode, setTsumegoNode] = useState<TsumegoNode | null>(null);
  const [tsumegoStatus, setTsumegoStatus] = useState<'playing' | 'success' | 'fail'>('playing');
  const [solvedTsumegoIds, setSolvedTsumegoIds] = useState<string[]>([]);

  const boardHistoryRef = useRef<string[]>([]);

  // Init Solved Problems
  useEffect(() => {
    const savedSolved = localStorage.getItem('zenGoSolvedTsumego');
    if (savedSolved) {
        try {
            setSolvedTsumegoIds(JSON.parse(savedSolved));
        } catch (e) {
            console.error("Failed to load solved tsumegos", e);
        }
    }
  }, []);

  const markTsumegoSolved = (id: string) => {
    setSolvedTsumegoIds(prev => {
        if (prev.includes(id)) return prev;
        const newIds = [...prev, id];
        localStorage.setItem('zenGoSolvedTsumego', JSON.stringify(newIds));
        return newIds;
    });
  };

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
    setCurrentGameId(Date.now().toString()); 
    boardHistoryRef.current = [];
  };

  const startTsumego = (problem: TsumegoProblem) => {
      // Clear any lingering notifications from previous games/problems
      setNotification(null);
      
      const empty = createEmptyGrid(problem.boardSize);
      // Place initial stones
      problem.initialStones.forEach(s => {
          if (s.y < empty.length && s.x < empty.length) {
              empty[s.y][s.x] = s.color;
          }
      });

      setGrid(empty);
      setTurn('black'); // User is always black in these problems
      setPhase('tsumego-playing');
      setCurrentTsumego(problem);
      setTsumegoNode(problem.solutionTree);
      setTsumegoStatus('playing');
      setHistory([]);
      setCaptures({black: 0, white: 0});
      setConfig({ // Mock config for display
          boardSize: problem.boardSize,
          boardTheme: 'wood',
          handicap: 0,
          playerColor: 'black',
          difficulty: problem.difficulty,
          komi: 0,
          aiMode: 'local'
      });
  };

  const handleNextTsumego = () => {
      if (!currentTsumego) return;
      // Because tsumegoProblems is sorted, we can just find the index
      const currentIndex = tsumegoProblems.findIndex(p => p.id === currentTsumego.id);
      
      if (currentIndex >= 0 && currentIndex < tsumegoProblems.length - 1) {
          startTsumego(tsumegoProblems[currentIndex + 1]);
      } else {
          setNotification("已是列表最后一题！");
          setTimeout(() => setNotification(null), 2000);
      }
  };

  const restartGame = () => {
    if (config && phase === 'finished') {
      startGame(config);
    } else if (phase === 'tsumego-playing' && currentTsumego) {
        startTsumego(currentTsumego);
    }
  };

  const handleIntersectionClick = useCallback(async (x: number, y: number) => {
    if (isAiThinking || isReviewMode) return;

    if (phase === 'playing') {
        if (config?.playerColor !== turn) return; 
        executeMove(x, y, turn);
    } else if (phase === 'tsumego-playing') {
        if (turn !== 'black') return; // User turn only
        if (tsumegoStatus !== 'playing') return;

        handleTsumegoMove(x, y);
    }

  }, [phase, isAiThinking, config, turn, isReviewMode, tsumegoNode, tsumegoStatus]);

  const handleTsumegoMove = async (x: number, y: number): Promise<boolean> => {
      // 1. User Move
      const result = makeMove(grid, x, y, 'black');
      if (!result.success) return false;

      setGrid(result.newGrid);
      setHistory(prev => [...prev, { x, y, color: 'black', captures: result.captures }]);
      
      const key = `${x},${y}`;
      const branch = tsumegoNode?.[key];

      if (!branch) {
          // Wrong move (not in tree)
          setTsumegoStatus('fail');
          setNotification("回答错误：不在正解路径中");
          setTimeout(() => setNotification(null), 2000);
          return true;
      }

      // Check status
      if (branch.status === 'wrong') {
          setTsumegoStatus('fail');
          setNotification(branch.message || "回答错误");
          // If there is a refutation response, play it
          if (branch.response) {
               setIsAiThinking(true);
               await new Promise(r => setTimeout(r, 500));
               const aiRes = makeMove(result.newGrid, branch.response.x, branch.response.y, 'white');
               if (aiRes.success) {
                   setGrid(aiRes.newGrid);
                   setHistory(prev => [...prev, { x: branch.response!.x, y: branch.response!.y, color: 'white', captures: aiRes.captures }]);
               }
               setIsAiThinking(false);
          }
          return true;
      }

      if (branch.status === 'correct') {
          setTsumegoStatus('success');
          setNotification(branch.message || "恭喜，回答正确！");
          if (currentTsumego) markTsumegoSolved(currentTsumego.id);
          return true;
      }

      // If status is 'continue', check response
      if (branch.response) {
           setIsAiThinking(true);
           setTurn('white');
           
           await new Promise(r => setTimeout(r, 600));
           
           const aiRes = makeMove(result.newGrid, branch.response.x, branch.response.y, 'white');
           if (aiRes.success) {
               setGrid(aiRes.newGrid);
               setHistory(prev => [...prev, { x: branch.response!.x, y: branch.response!.y, color: 'white', captures: aiRes.captures }]);
               
               // Advance the tree
               if (branch.next) {
                   setTsumegoNode(branch.next);
                   setTurn('black');
               } else {
                   setTsumegoStatus('success');
                   if (currentTsumego) markTsumegoSolved(currentTsumego.id);
                   setNotification(branch.message || "恭喜，回答正确！");
               }
           }
           setIsAiThinking(false);
      }
      return true;
  };

  const handleTsumegoHint = async () => {
      if (!tsumegoNode || phase !== 'tsumego-playing') return;
      
      // Find the first correct or continue move in the current node
      const correctMoveKey = Object.keys(tsumegoNode).find(key => {
          const status = tsumegoNode[key].status;
          return status === 'correct' || status === 'continue';
      });

      if (correctMoveKey) {
          const [x, y] = correctMoveKey.split(',').map(Number);
          
          // CRITICAL FIX: Verify the move is valid before proclaiming success
          // Check if space is occupied or suicidal
          const testResult = makeMove(grid, x, y, 'black');
          if (!testResult.success) {
              setNotification("AI 提示错误：正解坐标非法 (此题数据可能有误)");
              return;
          }

          const success = await handleTsumegoMove(x, y);
          if (success) {
            setNotification("AI 已为您走出正解。");
          } else {
            // Should not happen if testResult.success was true, but safe fallback
            setNotification("AI 落子失败。");
          }
          setTimeout(() => setNotification(null), 2000);
      } else {
          setNotification("当前局面无预设正解，请尝试悔棋。");
          setTimeout(() => setNotification(null), 2000);
      }
  };

  const executeMove = (x: number, y: number, color: StoneColor, isPass = false) => {
    if (territoryMap) setTerritoryMap(undefined);

    if (isPass) {
      setHistory(prev => [...prev, { x: -1, y: -1, color, captures: 0, pass: true }]);
      setTurn((color === 'black' ? 'white' : 'black') as StoneColor);
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
    setTurn((color === 'black' ? 'white' : 'black') as StoneColor);
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
      const nextTurn: StoneColor = lastMove ? (lastMove.color === 'black' ? 'white' : 'black') : (targetConfig.handicap > 0 ? 'white' : 'black');

      return {
          grid: tempGrid,
          captures: tempCaptures,
          turn: nextTurn,
          boardHistory: tempBoardHistory
      };
  };

  const handleUndo = () => {
    if (isAiThinking || !config || history.length === 0 || isReviewMode) return;
    
    // Tsumego Undo
    if (phase === 'tsumego-playing') {
        if (window.confirm("死活题模式下建议重新挑战。确定要悔棋吗？")) {
             // Logic to step back 2 steps if AI responded
             let steps = 1;
             if (history.length >= 2 && history[history.length-1].color === 'white') steps = 2;
             
             const newHistory = history.slice(0, history.length - steps);
             // Rebuild grid from initial
             const empty = createEmptyGrid(currentTsumego!.boardSize);
             currentTsumego!.initialStones.forEach(s => empty[s.y][s.x] = s.color);
             
             newHistory.forEach(m => {
                 makeMove(empty, m.x, m.y, m.color); // Assume valid
             });
             setGrid(empty);
             setHistory(newHistory);
             setTsumegoStatus('playing');
             startTsumego(currentTsumego!); // Force restart for now
        }
        return;
    }

    if (territoryMap) setTerritoryMap(undefined);
    if (history.length <= config.handicap) return;

    let stepsToUndo = 0;
    const lastMove = history[history.length - 1];
    
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

        const aiMove = await getAIMove(grid, turn, config.difficulty, lastMove, config.aiMode);
        
        if (aiMove === 'PASS') {
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
    }
  };
  
  const handleResign = () => {
    setPhase('finished');
    setScoreResult({
        blackTerritory: 0, whiteTerritory: 0, blackCaptures: 0, whiteCaptures: 0, komi: 0,
        winner: turn === 'black' ? 'white' : 'black',
        margin: 0 
    });
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
      setCurrentGameId(game.id);
      
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
      setScoreResult(null);
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

  // --- RENDER ---

  if (phase === 'home') {
      return (
        <>
            <HomeScreen 
                onNewGame={() => setPhase('setup')}
                onHistory={() => setShowSavedGames(true)}
                onTsumego={() => setPhase('tsumego-list')}
            />
            {showSavedGames && <SavedGamesModal onLoad={loadSavedGame} onClose={() => setShowSavedGames(false)} />}
        </>
      );
  }

  if (phase === 'tsumego-list') {
      return (
          <TsumegoList 
              onSelectProblem={startTsumego}
              onBack={() => setPhase('home')}
              solvedProblemIds={solvedTsumegoIds}
          />
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
      
      {/* Header */}
      <header className="w-full bg-white shadow-sm px-3 py-3 sm:p-4 flex justify-between items-center z-30 sticky top-0">
        <div className="flex items-center gap-2 cursor-pointer" onClick={goHome} title="返回首页">
           <div className="w-7 h-7 sm:w-8 sm:h-8 bg-stone-900 rounded-md flex items-center justify-center text-white font-bold text-lg sm:text-xl">禅</div>
           <h1 className="text-lg sm:text-xl font-bold text-stone-800 hidden sm:block">黑白问道</h1>
        </div>
        
        {phase === 'playing' && (
            <div className="flex items-center gap-2 bg-stone-100 rounded-full px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm font-medium">
                {isReviewMode ? (
                    <span className="text-amber-600 flex items-center gap-1"><Eye className="w-3 h-3 sm:w-4 sm:h-4"/> 复盘模式</span>
                ) : (
                    <span className="text-stone-600">
                        {config?.aiMode === 'online' ? '云端对战' : '本地对战'}
                    </span>
                )}
            </div>
        )}
        {phase === 'tsumego-playing' && (
            <div className="flex items-center gap-2 bg-amber-100 text-amber-800 rounded-full px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm font-bold truncate max-w-[150px] sm:max-w-none">
                死活题：{currentTsumego?.title}
            </div>
        )}

        <div className="flex gap-1 sm:gap-2">
             <button onClick={goHome} className="p-1.5 sm:p-2 text-stone-600 hover:bg-stone-100 rounded-full" title="首页">
                <Home className="w-4 h-4 sm:w-5 sm:h-5" />
             </button>
             {phase !== 'tsumego-playing' && (
                <button onClick={() => setShowSavedGames(true)} className="p-1.5 sm:p-2 text-stone-600 hover:bg-stone-100 rounded-full" title="本地存档">
                    <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
             )}
        </div>
      </header>

      {/* Main Content: Reduced padding for mobile (px-2) */}
      <main className="flex-1 w-full max-w-5xl px-2 py-4 sm:p-4 flex flex-col md:flex-row gap-4 sm:gap-6 items-start justify-center">
        
        {/* Left Column: Board */}
        <div className="w-full md:flex-1 flex justify-center flex-col items-center gap-4 relative z-0">
            <GoBoard 
                grid={grid} 
                onIntersectionClick={handleIntersectionClick} 
                lastMove={history.length > 0 && !history[history.length-1].pass ? history[history.length-1] : null}
                history={history}
                territoryMap={territoryMap}
                isInteractive={(phase === 'playing' || phase === 'tsumego-playing') && !isAiThinking && !isReviewMode && tsumegoStatus === 'playing'}
                theme={config?.boardTheme || 'wood'}
                config={config}
                scoreResult={scoreResult}
                captures={captures}
            />
            
            {/* Notification */}
            {notification && (
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-4 py-2 sm:px-6 sm:py-3 rounded-full shadow-xl animate-in fade-in zoom-in duration-300 pointer-events-none font-bold text-sm sm:text-base whitespace-nowrap ${
                    tsumegoStatus === 'success' ? 'bg-green-600 text-white' : 
                    tsumegoStatus === 'fail' ? 'bg-red-600 text-white' : 'bg-black/80 text-white'
                }`}>
                    {notification}
                </div>
            )}
            
            {/* Review Controls */}
            {isReviewMode && (
                <div className="flex items-center gap-2 sm:gap-4 bg-white p-2 rounded-xl shadow-sm border border-stone-200 overflow-x-auto w-full justify-center">
                    <button onClick={() => jumpToMove(0)} className="p-2 hover:bg-stone-100 rounded"><Rewind className="w-4 h-4 sm:w-5 sm:h-5"/></button>
                    <button onClick={() => jumpToMove(reviewIndex - 1)} className="p-2 hover:bg-stone-100 rounded"><SkipBack className="w-4 h-4 sm:w-5 sm:h-5"/></button>
                    <span className="font-mono text-xs sm:text-sm w-12 sm:w-16 text-center">{reviewIndex} / {history.length}</span>
                    <button onClick={() => jumpToMove(reviewIndex + 1)} className="p-2 hover:bg-stone-100 rounded"><SkipForward className="w-4 h-4 sm:w-5 sm:h-5"/></button>
                    <button onClick={() => jumpToMove(history.length)} className="p-2 hover:bg-stone-100 rounded"><FastForward className="w-4 h-4 sm:w-5 sm:h-5"/></button>
                </div>
            )}
        </div>

        {/* Right Column: Control Center */}
        <div className="w-full md:w-80 flex flex-col gap-4">
            
            <div className="bg-white p-3 sm:p-5 rounded-xl shadow-md border border-stone-200 transition-all duration-300">
                
                {phase === 'tsumego-playing' ? (
                    // --- TSUMEGO CONTROLS ---
                    <div className="space-y-4">
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-sm text-amber-900">
                            <h3 className="font-bold mb-1">题目描述</h3>
                            <p className="text-xs sm:text-sm">{currentTsumego?.description}</p>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-4">
                            <div className={`flex-1 h-2 rounded-full ${tsumegoStatus === 'success' ? 'bg-green-500' : tsumegoStatus === 'fail' ? 'bg-red-500' : 'bg-stone-200'}`}></div>
                        </div>

                        {tsumegoStatus === 'playing' ? (
                            <>
                                <button 
                                    onClick={handleTsumegoHint}
                                    className="w-full py-2.5 sm:py-3 bg-amber-100 text-amber-800 font-bold rounded-lg hover:bg-amber-200 flex items-center justify-center gap-2 border border-amber-200 text-sm"
                                >
                                    <Lightbulb className="w-4 h-4 fill-amber-500 text-amber-600" /> AI 提示
                                </button>
                                <button 
                                    onClick={() => restartGame()}
                                    className="w-full py-2.5 sm:py-3 bg-stone-100 text-stone-700 font-bold rounded-lg hover:bg-stone-200 flex items-center justify-center gap-2 text-sm"
                                >
                                    <RefreshCw className="w-4 h-4" /> 重置题目
                                </button>
                            </>
                        ) : (
                            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                                <div className={`text-center py-2 font-bold ${tsumegoStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                    {tsumegoStatus === 'success' ? '挑战成功！' : '挑战失败'}
                                </div>
                                {tsumegoStatus === 'success' && (
                                    <button 
                                        onClick={handleNextTsumego}
                                        className="w-full py-3 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 flex items-center justify-center gap-2 shadow-md animate-pulse"
                                    >
                                        <ChevronRight className="w-4 h-4" /> 下一题
                                    </button>
                                )}
                                <button 
                                    onClick={() => restartGame()}
                                    className="w-full py-3 bg-stone-100 text-stone-700 font-bold rounded-lg hover:bg-stone-200 flex items-center justify-center gap-2"
                                >
                                    <Repeat className="w-4 h-4" /> 再次尝试
                                </button>
                                <button 
                                    onClick={() => setPhase('tsumego-list')}
                                    className="w-full py-3 bg-white border border-stone-200 text-stone-700 font-bold rounded-lg hover:bg-stone-50 flex items-center justify-center gap-2"
                                >
                                    <ArrowLeft className="w-4 h-4" /> 返回列表
                                </button>
                            </div>
                        )}
                         <button 
                            onClick={() => setPhase('home')}
                            className="w-full mt-4 py-2 text-stone-400 text-xs sm:text-sm hover:text-stone-600"
                        >
                            退出练习
                        </button>
                    </div>
                ) : (
                    // --- NORMAL GAME CONTROLS ---
                    <>
                        <div className="flex items-center justify-between bg-stone-50 p-2 sm:p-3 rounded-lg border border-stone-100 mb-3 sm:mb-4">
                            <div className="flex items-center gap-2">
                                {isAiThinking ? (
                                    <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
                                ) : (
                                    (phase === 'finished' || phase === 'scoring') ? (
                                        <Flag className="w-4 h-4 text-stone-500 fill-current" />
                                    ) : (
                                        <Disc className={`w-4 h-4 ${turn === 'black' ? 'text-black fill-current' : 'text-stone-400'}`} />
                                    )
                                )}
                                <span className="text-xs sm:text-sm font-bold text-stone-700">
                                    {isAiThinking ? 'AI 思考中...' : ((phase === 'finished' || phase === 'scoring') ? '对局结束' : (turn === 'black' ? '黑方落子' : '白方落子'))}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-stone-500 bg-white px-2 py-1 rounded border border-stone-200">
                                <Hash className="w-3 h-3" />
                                <span className="font-mono">{history.length}</span>
                            </div>
                        </div>

                        {territoryMap && est && (
                            <div className="mb-4 bg-amber-50 rounded-lg p-3 border border-amber-100 animate-in fade-in slide-in-from-top-2">
                                <div className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1">
                                    <Eye className="w-3 h-3" /> 形势判断 (预估)
                                </div>
                                <div className="space-y-1 text-xs sm:text-sm">
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

                        {(phase === 'finished' || phase === 'scoring') ? (
                            <div className="space-y-2 sm:space-y-3 animate-in fade-in slide-in-from-bottom-2">
                                <button 
                                    onClick={restartGame}
                                    className="w-full py-2.5 sm:py-3 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 flex items-center justify-center gap-2 shadow-sm transition-colors text-sm sm:text-base"
                                >
                                    <Repeat className="w-4 h-4" /> 再来一局
                                </button>
                                
                                <button 
                                    onClick={() => setPhase('home')}
                                    className="w-full py-2.5 sm:py-3 bg-stone-100 text-stone-700 font-bold rounded-lg hover:bg-stone-200 flex items-center justify-center gap-2 transition-colors text-sm sm:text-base"
                                >
                                    <Home className="w-4 h-4" /> 返回首页
                                </button>

                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100 mt-2">
                                    <button 
                                        onClick={handleManualSave}
                                        className="py-2 text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 flex items-center justify-center gap-1 transition-colors text-xs sm:text-sm" 
                                    >
                                        <Save className="w-3 h-3 sm:w-4 sm:h-4" /> 保存
                                    </button>
                                    <button 
                                        onClick={enterReviewMode}
                                        className="py-2 text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 flex items-center justify-center gap-1 transition-colors text-xs sm:text-sm"
                                    >
                                        <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4"/> 复盘
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={downloadSGF} 
                                        className="py-2 text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 flex items-center justify-center gap-1 transition-colors text-xs sm:text-sm" 
                                    >
                                        <Download className="w-3 h-3 sm:w-4 sm:h-4" /> SGF
                                    </button>
                                    <button 
                                        onClick={takeScreenshot} 
                                        className="py-2 text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 flex items-center justify-center gap-1 transition-colors text-xs sm:text-sm" 
                                    >
                                        <Camera className="w-3 h-3 sm:w-4 sm:h-4" /> 截图
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2 sm:space-y-3">
                                {isReviewMode ? (
                                    <button 
                                        onClick={resumeGame}
                                        className="w-full py-2.5 sm:py-3 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 flex items-center justify-center gap-2 transition-colors shadow-sm"
                                    >
                                        <Play className="w-4 h-4" /> 结束复盘
                                    </button>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                            <button 
                                                onClick={handlePass}
                                                disabled={turn !== config?.playerColor || isAiThinking}
                                                className="py-2 sm:py-2.5 bg-stone-100 text-stone-700 font-medium rounded-lg text-xs sm:text-sm hover:bg-stone-200 disabled:opacity-50 transition-colors"
                                            >
                                                停一手
                                            </button>
                                            <button 
                                                onClick={handleUndo}
                                                disabled={isAiThinking || history.length <= (config?.handicap || 0)}
                                                className="py-2 sm:py-2.5 bg-stone-100 text-stone-700 font-medium rounded-lg text-xs sm:text-sm hover:bg-stone-200 disabled:opacity-50 flex items-center justify-center gap-1 transition-colors"
                                            >
                                                <Undo2 className="w-4 h-4"/> 悔棋
                                            </button>
                                        </div>
                                        
                                        <button 
                                            onClick={toggleEstimation}
                                            className={`w-full py-2 sm:py-2.5 border rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-all ${territoryMap ? 'bg-amber-100 border-amber-300 text-amber-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                                        >
                                            <Eye className="w-4 h-4" /> 
                                            {territoryMap ? '关闭形势判断' : '形势判断'}
                                        </button>
                                        
                                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-100 mt-2">
                                            <button 
                                                onClick={handleManualSave}
                                                className="p-1.5 sm:p-2 text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 flex flex-col items-center justify-center gap-1 transition-colors" 
                                                title="保存"
                                            >
                                                <Save className="w-4 h-4" /> 
                                                <span className="text-[10px]">保存</span>
                                            </button>
                                            <button 
                                                onClick={downloadSGF} 
                                                className="p-1.5 sm:p-2 text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 flex flex-col items-center justify-center gap-1 transition-colors" 
                                                title="SGF"
                                            >
                                                <Download className="w-4 h-4" /> 
                                                <span className="text-[10px]">SGF</span>
                                            </button>
                                            <button 
                                                onClick={takeScreenshot} 
                                                className="p-1.5 sm:p-2 text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 flex flex-col items-center justify-center gap-1 transition-colors" 
                                                title="截图"
                                            >
                                                <Camera className="w-4 h-4" /> 
                                                <span className="text-[10px]">截图</span>
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 pt-2">
                                            <button 
                                                onClick={enterReviewMode}
                                                className="py-1.5 sm:py-2 border border-stone-200 text-stone-500 rounded-lg text-[10px] sm:text-xs hover:bg-stone-50 flex items-center justify-center gap-1 transition-colors"
                                            >
                                                <RotateCcw className="w-3 h-3"/> 复盘模式
                                            </button>
                                            <button 
                                                onClick={handleResign}
                                                className="py-1.5 sm:py-2 border border-red-100 text-red-400 rounded-lg text-[10px] sm:text-xs hover:bg-red-50 hover:text-red-600 transition-colors"
                                            >
                                                认输
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
      </main>
      
      {/* Footer Version Info */}
      <footer className="py-2 sm:py-4 text-stone-400 text-[10px] sm:text-xs font-mono opacity-50">
        v1.0
      </footer>
    </div>
  );
};

export default App;