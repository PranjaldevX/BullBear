import React from 'react';

export const Intro: React.FC = () => {
    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 animate-fade-in">
            <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 mb-4 animate-pulse">
                MARKET ARENA
            </h1>
            <p className="text-2xl text-white mb-8">Fortunes are made in four minutes.</p>
            <div className="text-xl text-yellow-400 font-mono animate-bounce">
                CHOOSE YOUR STRATEGY
            </div>
        </div>
    );
};
