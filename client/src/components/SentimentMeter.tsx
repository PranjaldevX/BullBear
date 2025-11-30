import React from 'react';
import { AssetType } from '@bvb/shared';

interface SentimentMeterProps {
    sentiment: Record<AssetType, number>;
}

export const SentimentMeter: React.FC<SentimentMeterProps> = ({ sentiment }) => {
    const getSentimentColor = (value: number) => {
        if (value >= 60) return 'bg-purple-500'; // Euphoric
        if (value >= 10) return 'bg-green-500'; // Optimistic
        if (value >= -10) return 'bg-yellow-500'; // Neutral
        if (value >= -50) return 'bg-orange-500'; // Cautious
        return 'bg-red-600'; // Fear
    };

    const getSentimentLabel = (value: number) => {
        if (value >= 60) return 'EUPHORIC';
        if (value >= 10) return 'BULLISH';
        if (value >= -10) return 'NEUTRAL';
        if (value >= -50) return 'BEARISH';
        return 'PANIC';
    };

    return (
        <div className="bg-gray-900 rounded p-4 border border-gray-800">
            <h2 className="text-lg font-bold mb-4 text-gray-300">Market Sentiment</h2>
            <div className="space-y-4">
                {(Object.entries(sentiment) as [AssetType, number][]).map(([type, value]) => (
                    <div key={type} className="group relative">
                        <div className="flex justify-between text-xs mb-1">
                            <span className="font-bold text-gray-400">{type}</span>
                            <span className={`font-mono font-bold ${value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {getSentimentLabel(value)} ({value.toFixed(0)})
                            </span>
                        </div>

                        {/* Bar Background */}
                        <div className="h-3 bg-gray-800 rounded-full overflow-hidden relative">
                            {/* Center Marker */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-600 z-10"></div>

                            {/* Sentiment Bar */}
                            <div
                                className={`h-full transition-all duration-500 ${getSentimentColor(value)}`}
                                style={{
                                    position: 'absolute',
                                    left: value >= 0 ? '50%' : `calc(50% - ${Math.abs(value) / 2}%)`,
                                    width: `${Math.abs(value) / 2}%`
                                }}
                            ></div>
                        </div>

                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-black text-white text-xs p-2 rounded hidden group-hover:block z-20 border border-gray-600 text-center">
                            {value >= 60 && "⚠️ Euphoria: High risk of reversal!"}
                            {value >= 10 && value < 60 && "Optimism driving prices up."}
                            {value >= -10 && value < 10 && "Market is undecided."}
                            {value >= -50 && value < -10 && "Caution: Downward pressure."}
                            {value <= -50 && "⚠️ Panic: Prices crashing!"}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
