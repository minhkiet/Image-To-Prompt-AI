import React from 'react';

interface SuggestionsDisplayProps {
  suggestions: string[];
}

export const SuggestionsDisplay: React.FC<SuggestionsDisplayProps> = ({ suggestions }) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="w-full bg-gradient-to-br from-white/95 via-white/90 to-purple-50/80 backdrop-blur-md rounded-3xl shadow-xl border border-white/60 overflow-hidden animate-fade-in-up delay-100 ring-1 ring-purple-100/50">
      <div className="px-6 py-5 bg-gradient-to-r from-purple-50/50 to-blue-50/50 border-b border-purple-100/50 flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-yellow-100 to-amber-100 text-yellow-700 rounded-xl shadow-sm ring-1 ring-yellow-200/50">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
          </svg>
        </div>
        <h3 className="font-bold text-gray-800 text-lg">Gợi ý tối ưu hóa</h3>
      </div>
      <div className="p-4 sm:p-6">
        <ul className="space-y-2">
          {suggestions.map((s, i) => (
            <li 
              key={i} 
              className="flex gap-4 items-start p-3 rounded-2xl transition-all duration-300 hover:bg-white hover:shadow-md hover:shadow-purple-100/50 border border-transparent hover:border-purple-100 hover:translate-x-1 group animate-fade-in-up opacity-0"
              style={{ animationDelay: `${(i + 1) * 100}ms` }}
            >
              <span className="flex-shrink-0 w-7 h-7 rounded-xl bg-purple-100/50 text-purple-600 flex items-center justify-center text-sm font-bold mt-0.5 group-hover:bg-gradient-to-br group-hover:from-purple-500 group-hover:to-blue-500 group-hover:text-white group-hover:shadow-md transition-all duration-300 shadow-sm">
                {i + 1}
              </span>
              <span className="leading-relaxed text-sm md:text-base font-medium text-gray-600 group-hover:text-gray-900 transition-colors pt-0.5">
                {s}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};