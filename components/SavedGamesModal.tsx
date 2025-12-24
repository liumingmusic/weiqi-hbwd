import React, { useEffect, useState } from 'react';
import { GameConfig, Move } from '../types';
import { Trash2, PlayCircle, Clock, Calendar } from 'lucide-react';

interface SavedGame {
  id: string;
  timestamp: number;
  config: GameConfig;
  history: Move[];
  thumbnail?: string; // Optional: could store board screenshot dataurl
}

interface SavedGamesModalProps {
  onLoad: (game: SavedGame) => void;
  onClose: () => void;
}

const SavedGamesModal: React.FC<SavedGamesModalProps> = ({ onLoad, onClose }) => {
  const [games, setGames] = useState<SavedGame[]>([]);

  useEffect(() => {
    const loadFromStorage = () => {
      try {
        const raw = localStorage.getItem('zenGoSavedGames');
        if (raw) {
          const parsed = JSON.parse(raw);
          // Sort by newest first
          setGames(parsed.sort((a: SavedGame, b: SavedGame) => b.timestamp - a.timestamp));
        }
      } catch (e) {
        console.error("Error loading games", e);
      }
    };
    loadFromStorage();
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newGames = games.filter(g => g.id !== id);
    setGames(newGames);
    localStorage.setItem('zenGoSavedGames', JSON.stringify(newGames));
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString('zh-CN', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 animate-in fade-in zoom-in duration-300 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
                <Calendar className="w-6 h-6" />
                本地棋谱 ({games.length})
            </h2>
            <button onClick={onClose} className="text-stone-500 hover:text-stone-800">关闭</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {games.length === 0 ? (
                <div className="text-center text-stone-400 py-10">
                    暂无保存的对局
                </div>
            ) : (
                games.map(game => (
                    <div 
                        key={game.id} 
                        onClick={() => onLoad(game)}
                        className="flex items-center justify-between p-4 border border-stone-200 rounded-lg hover:bg-stone-50 cursor-pointer transition-colors group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-stone-200 w-12 h-12 rounded-full flex items-center justify-center text-stone-600 font-bold text-sm">
                                {game.config.boardSize}路
                            </div>
                            <div>
                                <div className="font-bold text-stone-800">
                                    {game.config.playerColor === 'black' ? '执黑' : '执白'} vs AI ({game.config.difficulty})
                                </div>
                                <div className="text-xs text-stone-500 flex items-center gap-2">
                                    <Clock className="w-3 h-3" />
                                    {formatDate(game.timestamp)} • {game.history.length} 手
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                             <button 
                                className="p-2 bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-colors"
                                title="复盘/继续"
                             >
                                <PlayCircle className="w-5 h-5" />
                             </button>
                             <button 
                                onClick={(e) => handleDelete(game.id, e)}
                                className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                title="删除"
                             >
                                <Trash2 className="w-5 h-5" />
                             </button>
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  );
};

export default SavedGamesModal;
