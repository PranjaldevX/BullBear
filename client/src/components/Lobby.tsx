import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { ParticleBackground } from './ParticleBackground';

export const Lobby: React.FC = () => {
    const [name, setName] = useState('');
    const connect = useGameStore(state => state.connect);
    const isConnected = useGameStore(state => state.isConnected);

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            connect(name);
        }
    };

    if (isConnected) {
        return (
            <div className="min-h-screen bg-theme-bg flex items-center justify-center text-white relative overflow-hidden">
                <ParticleBackground />
                <div className="text-center z-10 animate-slideUpFade">
                    <h2 className="text-3xl font-bold mb-4 text-neon-blue animate-pulseGlow">Waiting for game to start...</h2>
                    <div className="text-gray-400 font-mono">Connecting to server...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-theme-bg flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Elements */}
            <ParticleBackground />
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
                <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-neon-blue rounded-full blur-[150px] animate-float"></div>
                <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-neon-green rounded-full blur-[150px] animate-float" style={{ animationDelay: '2s' }}></div>
            </div>

            <div className="bg-theme-surface/80 backdrop-blur-md p-8 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-md w-full border border-gray-700 z-10 animate-slideUpFade">
                <h1 className="text-4xl font-bold text-center mb-8 tracking-tight">
                    <span className="text-neon-green">Bull</span> vs <span className="text-neon-red">Bear</span>
                    <br />
                    <span className="text-white">Royale</span>
                </h1>

                <form onSubmit={handleJoin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-neon-blue mb-2 uppercase tracking-wider">Trader Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-gray-900/50 border border-gray-600 rounded-lg p-4 text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue focus:shadow-[0_0_20px_rgba(0,243,255,0.2)] transition-all duration-300"
                            placeholder="e.g. WolfOfWallStreet"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-neon-blue text-black font-bold text-lg py-4 rounded-lg hover:bg-white hover:scale-[1.02] transition-all duration-300 shadow-[0_0_20px_rgba(0,243,255,0.4)]"
                    >
                        ENTER MARKET
                    </button>
                </form>
            </div>
        </div>
    );
};
