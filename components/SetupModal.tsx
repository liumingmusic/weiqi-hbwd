import React, { useState, useEffect } from 'react';
import { Difficulty, GameConfig, StoneColor, BoardTheme, AiMode } from '../types';
import { Brain, Play, Grip, Palette, Shuffle, Grid3X3, Zap, CloudLightning, X } from 'lucide-react';

interface SetupModalProps {
  onStart: (config: GameConfig) => void;
  onCancel: () => void;
}

const SetupModal: React.FC<SetupModalProps> = ({ onStart, onCancel }) => {
  const [difficulty, setDifficulty] = useState<Difficulty>('elementary');
  const [playerColor, setPlayerColor] = useState<StoneColor | 'random'>('black');
  const [handicap, setHandicap] = useState<number>(0);
  const [boardSize, setBoardSize] = useState<number>(19);
  const [boardTheme, setBoardTheme] = useState<BoardTheme>('wood');
  const [aiMode, setAiMode] = useState<AiMode>('local');

  useEffect(() => {
    const savedConfig = localStorage.getItem('zenGoConfig');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        if (parsed.difficulty) setDifficulty(parsed.difficulty);
        if (parsed.playerColor) setPlayerColor(parsed.playerColor);
        if (parsed.handicap !== undefined) setHandicap(parsed.handicap);
        if (parsed.boardSize) setBoardSize(parsed.boardSize);
        if (parsed.boardTheme) setBoardTheme(parsed.boardTheme);
        if (parsed.aiMode) setAiMode(parsed.aiMode);
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }
  }, []);

  const handleStart = () => {
    let finalColor: StoneColor;
    if (playerColor === 'random') {
        finalColor = Math.random() < 0.5 ? 'black' : 'white';
    } else {
        finalColor = playerColor;
    }

    const config: GameConfig = {
      difficulty,
      playerColor: finalColor,
      handicap,
      komi: handicap > 0 ? 0.5 : (finalColor === 'white' ? 6.5 : 7.5),
      boardSize,
      boardTheme,
      aiMode
    };

    localStorage.setItem('zenGoConfig', JSON.stringify({
        difficulty,
        playerColor,
        handicap,
        boardSize,
        boardTheme,
        aiMode
    }));

    onStart(config);
  };

  const themes: {id: BoardTheme, name: string, color: string}[] = [
      { id: 'wood', name: '木纹', color: '#e3c08d' },
      { id: 'warm', name: '黄玉', color: '#f5e6bb' },
      { id: 'green', name: '翠绿', color: '#3a5f45' },
      { id: 'dark', name: '墨灰', color: '#2d2d2d' },
      { id: 'paper', name: '云白', color: '#f0f0f0' },
  ];

  const difficulties: {id: Difficulty, label: string}[] = [
      { id: 'novice', label: '小白' },
      { id: 'entry', label: '入门' },
      { id: 'beginner', label: '新手' },
      { id: 'elementary', label: '初级' },
      { id: 'intermediate', label: '中级' },
      { id: 'advanced', label: '高级' },
      { id: 'master', label: '大师' },
      { id: 'grandmaster', label: '特级' },
  ];

  // Helper to get preview style
  const getPreviewStyle = () => {
      const theme = themes.find(t => t.id === boardTheme);
      const color = theme ? theme.color : '#e3c08d';
      const isWood = boardTheme === 'wood';
      const isDark = boardTheme === 'dark';
      
      return {
          backgroundColor: color,
          className: isWood ? 'wood-texture' : '',
          lineColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)'
      };
  };
  
  const preview = getPreviewStyle();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200 relative max-h-[90vh] overflow-y-auto">
        <button 
            onClick={onCancel}
            className="absolute top-4 right-4 text-stone-400 hover:text-stone-800 p-1 rounded-full hover:bg-stone-100 transition-colors z-10"
        >
            <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-stone-800 mb-6 flex items-center gap-2">
          <Grip className="w-5 h-5 text-amber-600" />
          对局设置
        </h2>

        {/* Board Preview Area */}
        <div 
            className={`w-full h-32 mb-6 rounded-xl relative shadow-inner overflow-hidden flex items-center justify-center transition-colors duration-500 ${preview.className}`}
            style={{ backgroundColor: preview.backgroundColor }}
        >
            {/* Fake Grid */}
            <div 
                className="absolute inset-4 grid grid-cols-4 grid-rows-4" 
                style={{ 
                    borderColor: preview.lineColor,
                    borderWidth: '1px'
                }}
            >
                {Array.from({length: 16}).map((_, i) => (
                     <div key={i} className="border-r border-b" style={{ borderColor: preview.lineColor }}></div>
                ))}
            </div>
            
            {/* Sample Stones */}
            <div className="absolute top-1/2 left-1/3 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-gray-800 to-black shadow-lg ring-1 ring-white/10 animate-stone-drop"></div>
            <div className="absolute top-1/2 right-1/3 -translate-y-1/2 translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-white to-gray-200 shadow-lg ring-1 ring-black/10 animate-stone-drop" style={{animationDelay: '0.1s'}}></div>
            
            <div className="absolute bottom-2 right-3 text-[10px] font-mono opacity-50 uppercase tracking-widest">
                {boardSize}路 • {themes.find(t=>t.id===boardTheme)?.name}
            </div>
        </div>

        {/* AI Mode & Difficulty */}
        <div className="mb-5 p-3 bg-stone-50 rounded-xl border border-stone-100">
             <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 block">AI 引擎</label>
             <div className="flex gap-2 mb-4">
                 <button
                    onClick={() => setAiMode('local')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border flex items-center justify-center gap-1.5 transition-all ${
                        aiMode === 'local' 
                        ? 'bg-white border-amber-500 text-amber-700 shadow-sm ring-1 ring-amber-500' 
                        : 'bg-stone-100 border-transparent text-stone-500 hover:bg-white hover:border-stone-300'
                    }`}
                 >
                    <Zap className="w-4 h-4" /> 本地 (极速)
                 </button>
                 <button
                    onClick={() => setAiMode('online')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border flex items-center justify-center gap-1.5 transition-all ${
                        aiMode === 'online' 
                        ? 'bg-white border-blue-500 text-blue-700 shadow-sm ring-1 ring-blue-500' 
                        : 'bg-stone-100 border-transparent text-stone-500 hover:bg-white hover:border-stone-300'
                    }`}
                 >
                    <CloudLightning className="w-4 h-4" /> 云端 (强力)
                 </button>
             </div>

             <div className="grid grid-cols-4 gap-1 bg-stone-200 p-1 rounded-lg">
                {difficulties.map((d) => (
                    <button
                        key={d.id}
                        onClick={() => setDifficulty(d.id as Difficulty)}
                        className={`py-1.5 text-xs font-medium rounded-md transition-all ${
                        difficulty === d.id ? 'bg-white text-stone-900 shadow-sm font-bold' : 'text-stone-500 hover:text-stone-700'
                        }`}
                    >
                        {d.label}
                    </button>
                ))}
            </div>
        </div>

        {/* Board Settings */}
        <div className="space-y-4 mb-6">
            <div>
                <label className="block text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
                    <Grid3X3 className="w-4 h-4 text-stone-400" /> 棋盘大小
                </label>
                <div className="flex gap-2">
                    {[9, 13, 19].map(s => (
                        <button
                            key={s}
                            onClick={() => setBoardSize(s)}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg border transition-all ${
                                boardSize === s 
                                ? 'bg-stone-800 text-white border-stone-800' 
                                : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'
                            }`}
                        >
                            {s}路
                        </button>
                    ))}
                </div>
            </div>

            <div>
                 <label className="block text-sm font-medium text-stone-700 mb-2">执棋颜色</label>
                 <div className="flex bg-stone-100 p-1 rounded-lg">
                     <button
                        onClick={() => setPlayerColor('black')}
                        className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${playerColor === 'black' ? 'bg-white shadow-sm text-black' : 'text-stone-500'}`}
                     >
                        执黑
                     </button>
                     <button
                        onClick={() => setPlayerColor('white')}
                        className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${playerColor === 'white' ? 'bg-white shadow-sm text-black' : 'text-stone-500'}`}
                     >
                        执白
                     </button>
                     <button
                        onClick={() => setPlayerColor('random')}
                        className={`flex-1 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1 ${playerColor === 'random' ? 'bg-white shadow-sm text-amber-700' : 'text-stone-500'}`}
                     >
                        <Shuffle className="w-3 h-3" /> 随机
                     </button>
                 </div>
            </div>

            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                    <Palette className="w-4 h-4 text-stone-400" /> 风格
                </label>
                <div className="flex gap-2">
                    {themes.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setBoardTheme(t.id)}
                            title={t.name}
                            className={`w-8 h-8 rounded-full border-2 shadow-sm transition-transform hover:scale-110 ${boardTheme === t.id ? 'border-amber-600 ring-2 ring-amber-100' : 'border-stone-200'}`}
                            style={{ backgroundColor: t.color }}
                        />
                    ))}
                </div>
            </div>

             <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-stone-700">让子 ({handicap})</label>
                <input 
                    type="range" 
                    min="0" 
                    max="9" 
                    value={handicap} 
                    onChange={(e) => setHandicap(parseInt(e.target.value))}
                    className="w-32 h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-800"
                />
            </div>
        </div>

        <button
          onClick={handleStart}
          className="w-full py-3.5 bg-amber-600 text-white text-lg font-bold rounded-xl hover:bg-amber-700 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98]"
        >
          <Play className="w-5 h-5 fill-current" />
          开始对局
        </button>
      </div>
    </div>
  );
};

export default SetupModal;