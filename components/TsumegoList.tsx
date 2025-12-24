import React, { useState, useMemo } from 'react';
import { TsumegoProblem, Difficulty } from '../types';
import { tsumegoProblems } from '../utils/tsumegoData';
import { ArrowLeft, Brain, Layers, GraduationCap, Medal, Crown, CheckCircle2, BookOpen } from 'lucide-react';

interface TsumegoListProps {
  onSelectProblem: (problem: TsumegoProblem) => void;
  onBack: () => void;
  solvedProblemIds: string[];
}

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string, className: string, bg: string }> = {
    novice: { label: '小白', className: 'bg-stone-400', bg: 'bg-stone-50' },
    entry: { label: '入门', className: 'bg-stone-500', bg: 'bg-stone-100' },
    beginner: { label: '新手', className: 'bg-green-500', bg: 'bg-green-50' },
    elementary: { label: '初级', className: 'bg-teal-600', bg: 'bg-teal-50' },
    intermediate: { label: '中级', className: 'bg-amber-500', bg: 'bg-amber-50' },
    advanced: { label: '高级', className: 'bg-orange-600', bg: 'bg-orange-50' },
    master: { label: '大师', className: 'bg-red-600', bg: 'bg-red-50' },
    grandmaster: { label: '特级', className: 'bg-purple-700', bg: 'bg-purple-50' }
};

type TabKey = 'all' | 'novice' | 'beginner' | 'intermediate';

const TsumegoList: React.FC<TsumegoListProps> = ({ onSelectProblem, onBack, solvedProblemIds }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('all');

  const tabs: { id: TabKey; label: string; icon: React.ReactNode }[] = [
      { id: 'all', label: '全部', icon: <Layers className="w-4 h-4" /> },
      { id: 'novice', label: '基础吃子', icon: <GraduationCap className="w-4 h-4" /> },
      { id: 'beginner', label: '死活常型', icon: <BookOpen className="w-4 h-4" /> },
      { id: 'intermediate', label: '进阶手筋', icon: <Medal className="w-4 h-4" /> },
  ];

  const filteredProblems = useMemo(() => {
      return tsumegoProblems.filter(p => {
          if (activeTab === 'all') return true;
          if (activeTab === 'novice') return ['novice', 'entry'].includes(p.difficulty);
          if (activeTab === 'beginner') return ['beginner', 'elementary'].includes(p.difficulty);
          if (activeTab === 'intermediate') return ['intermediate', 'advanced', 'master'].includes(p.difficulty);
          return true;
      });
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col items-center p-4">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-4 pt-4 sticky top-0 bg-stone-100 z-10 pb-2">
            <button 
                onClick={onBack}
                className="p-2 bg-white rounded-full shadow-sm border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
            >
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
                <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
                    <Brain className="w-6 h-6 text-amber-600" />
                    死活题大全
                </h1>
                <p className="text-sm text-stone-500">
                    精选 {tsumegoProblems.length} 道 • 已解决 {solvedProblemIds.length} 道
                </p>
            </div>
        </div>

        {/* Tabs */}
        <div className="w-full overflow-hidden mb-6">
            <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar space-x-2 sm:space-x-4">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-none py-2.5 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-all border ${
                            activeTab === tab.id 
                            ? 'bg-stone-800 text-white border-stone-800 shadow-md transform scale-105' 
                            : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>

        {/* Problem Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-10">
            {filteredProblems.map((problem) => {
                const conf = DIFFICULTY_CONFIG[problem.difficulty];
                const isSolved = solvedProblemIds.includes(problem.id);
                
                return (
                    <div 
                        key={problem.id}
                        onClick={() => onSelectProblem(problem)}
                        className={`p-4 rounded-xl shadow-sm border cursor-pointer transition-all group relative overflow-hidden ${conf.bg} ${isSolved ? 'border-green-200' : 'border-stone-200'} hover:shadow-md hover:scale-[1.01] hover:border-amber-300`}
                    >
                        <div className="flex justify-between items-start mb-2">
                             <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${conf.className}`}>
                                {conf.label}
                            </span>
                             <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isSolved ? 'bg-green-100 text-green-600' : 'bg-white/60 text-stone-400 group-hover:text-amber-600'}`}>
                                {isSolved ? <CheckCircle2 className="w-5 h-5 fill-current" /> : <Brain className="w-4 h-4" />}
                            </div>
                        </div>
                        
                        <h3 className={`text-lg font-bold mb-1 line-clamp-1 group-hover:text-amber-800 transition-colors ${isSolved ? 'text-stone-600' : 'text-stone-800'}`}>
                            {problem.title}
                        </h3>
                        <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                            {problem.description}
                        </p>
                    </div>
                );
            })}
        </div>
        
        {filteredProblems.length === 0 && (
            <div className="text-center py-20 text-stone-400 flex flex-col items-center">
                <Brain className="w-12 h-12 mb-2 opacity-20" />
                <p>该分类下暂无题目</p>
            </div>
        )}
      </div>
      
      {/* CSS for hiding scrollbar but keeping functionality */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default TsumegoList;