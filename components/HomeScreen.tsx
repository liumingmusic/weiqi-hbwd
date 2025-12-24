import React from 'react';
import { Play, History, Trophy, Heart } from 'lucide-react';

interface HomeScreenProps {
  onNewGame: () => void;
  onHistory: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onNewGame, onHistory }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full p-6 animate-in fade-in duration-700">
      
      {/* Title Section */}
      <div className="text-center mb-12">
        <div className="w-24 h-24 bg-stone-900 text-stone-100 rounded-2xl mx-auto flex items-center justify-center text-6xl font-serif shadow-2xl mb-6 border-4 border-stone-800 relative group">
          禅
          <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
            v1.0
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-stone-800 tracking-tight mb-2">黑白问道</h1>
        <p className="text-stone-500 text-lg">极简主义围棋体验</p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button 
          onClick={onNewGame}
          className="group relative w-full py-4 bg-stone-900 text-white text-lg font-bold rounded-xl shadow-lg hover:bg-stone-800 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-3"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>开始新局</span>
          <div className="absolute inset-0 rounded-xl ring-2 ring-white/10 group-hover:ring-white/20"></div>
        </button>

        <button 
          onClick={onHistory}
          className="w-full py-4 bg-white text-stone-700 text-lg font-bold rounded-xl shadow-md border border-stone-200 hover:bg-stone-50 hover:border-stone-300 transition-all duration-200 flex items-center justify-center gap-3"
        >
          <History className="w-5 h-5" />
          <span>历史棋谱</span>
        </button>
      </div>

      {/* Footer Decoration */}
      <div className="mt-16 text-stone-400 text-sm flex flex-col items-center gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-stone-400"></div>
              <span>本地模型</span>
          </div>
          <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              <span>Gemini 云端</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <div className="bg-stone-200/50 text-stone-500 px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 border border-stone-200">
              <span>明明</span>
              <Heart className="w-3 h-3 fill-rose-300 text-rose-300" />
              <span>佳佳</span>
            </div>
            <div className="text-[10px] font-mono text-stone-400 px-2 py-1 rounded bg-stone-100 border border-stone-200 opacity-60">
                v1.0
            </div>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;