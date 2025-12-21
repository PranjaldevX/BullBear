import React from 'react';
import { MarketEvent } from '@bvb/shared';

interface EventCardProps {
    event: MarketEvent | null;
}

export const EventCard: React.FC<EventCardProps> = ({ event }) => {
    if (!event) {
        return (
            <div className="bg-theme-surface rounded p-4 border border-gray-800 h-32 flex items-center justify-center opacity-50">
                <div className="text-sm text-theme-text-muted italic">
                    Market is calm...
                </div>
            </div>
        );
    }

    return (
        <div className="bg-theme-surface rounded overflow-hidden border-2 border-neon-red shadow-[0_0_20px_rgba(255,0,85,0.3)] animate-pulse-slow">
            {/* Breaking News Header */}
            <div className="bg-neon-red text-white px-3 py-1 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className="animate-pulse">🔴</span>
                    <span className="font-bold uppercase tracking-widest text-sm">BREAKING NEWS</span>
                </div>
                <span className="text-xs font-mono">{new Date().toLocaleTimeString()}</span>
            </div>

            <div className="p-4 relative">
                <div className="absolute top-4 right-4 text-5xl opacity-20 animate-bounce-slow">
                    {event.emoji || '📢'}
                </div>

                <h3 className="text-xl font-bold text-white mb-2 leading-tight relative z-10">
                    {event.title}
                </h3>

                <p className="text-sm text-gray-300 mb-4 relative z-10 border-l-2 border-neon-red pl-3">
                    {event.description}
                </p>

                {/* New Sentiment Engine Fields */}
                {event.emotion && (
                    <div className="flex gap-2 mb-3">
                        <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${event.emotion.includes('Positive') ? 'bg-green-900/50 text-green-300 border border-green-700' : event.emotion.includes('Negative') ? 'bg-red-900/50 text-red-300 border border-red-700' : 'bg-gray-800 text-gray-300 border border-gray-600'}`}>
                            Sentiment: {event.emotion}
                        </div>
                        {event.momentum_rounds && (
                            <div className="px-2 py-1 rounded text-xs font-bold uppercase bg-blue-900/50 text-blue-300 border border-blue-700">
                                Duration: {event.momentum_rounds} Rounds
                            </div>
                        )}
                    </div>
                )}


                {event.hint && (
                    <div className="bg-gray-900/50 p-2 rounded border border-gray-700 text-xs text-neon-blue italic flex gap-2 items-center mb-3">
                        <span>💡</span>
                        <span>{event.hint}</span>
                    </div>
                )}

                <div className="flex flex-wrap gap-2">
                    {event.affectedAssets.map(id => (
                        <span key={id} className="text-[10px] bg-red-900/50 border border-red-700 px-2 py-1 rounded text-red-200 uppercase font-mono">
                            {id} IMPACT
                        </span>
                    ))}
                    {/* Display mapped sectors if different from affectedAssets which are types now */}
                    {event.sectors && event.sectors.map(sector => (
                        <span key={sector} className="text-[10px] bg-purple-900/50 border border-purple-700 px-2 py-1 rounded text-purple-200 uppercase font-mono">
                            {sector}
                        </span>
                    ))}
                </div>
            </div>

            {/* Ticker Tape Effect */}
            <div className="bg-black py-1 overflow-hidden whitespace-nowrap">
                <div className="inline-block animate-marquee text-xs font-mono text-neon-red">
                    MARKET ALERT • VOLATILITY DETECTED • PRICES ADJUSTING • STAY ALERT • MARKET ALERT • VOLATILITY DETECTED • PRICES ADJUSTING • STAY ALERT
                </div>
            </div>
        </div>
    );
};
