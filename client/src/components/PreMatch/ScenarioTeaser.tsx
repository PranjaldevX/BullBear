import React from 'react';
import { useGameStore } from '../../store/gameStore';

export const ScenarioTeaser: React.FC = () => {
    const { gameState } = useGameStore();
    const scenario = gameState?.activeScenario;

    if (!scenario) return null;

    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50 p-8 animate-fade-in">
            <div className="text-2xl text-gray-400 mb-4 uppercase tracking-widest">Market Forecast</div>
            <h1 className="text-6xl font-black text-white mb-6 text-center uppercase tracking-tighter">
                {scenario.title}
            </h1>
            <p className="text-3xl text-red-500 mb-8 text-center max-w-2xl font-bold">
                {scenario.description}
            </p>
            <div className="bg-gray-900 border border-red-500/30 p-6 rounded-lg max-w-xl">
                <p className="text-xl text-white text-center italic">
                    "{scenario.effectDescription}"
                </p>
            </div>
        </div>
    );
};
