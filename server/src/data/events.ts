import { MarketEvent, Asset } from '@bvb/shared';

export interface ServerMarketEvent extends MarketEvent {
    effect: (assets: Asset[]) => void;
}

export const MARKET_EVENTS: ServerMarketEvent[] = [
    {
        id: 'tech-earnings',
        title: 'Tech Earnings Smash Expectations',
        description: 'Tech stocks soar as earnings crush expectations!',
        affectedAssets: ['tech-growth'],
        sentimentImpact: 28,
        duration: 2,
        hint: 'Momentum traders love this.',
        emoji: '🟢📈',
        effect: (assets) => {
            const tech = assets.find(a => a.id === 'tech-growth');
            if (tech) tech.currentPrice *= 1.12; // +12% drift handled by sentiment mainly, but initial jump
        }
    },
    {
        id: 'crypto-adoption',
        title: 'Major Crypto Adoption by Global Bank',
        description: 'Hype builds fast here.',
        affectedAssets: ['btc-coin', 'meme-coin'],
        sentimentImpact: 32,
        duration: 1,
        hint: 'Hype builds fast here.',
        emoji: '🤯🚀',
        effect: (assets) => {
            const btc = assets.find(a => a.id === 'btc-coin');
            if (btc) btc.currentPrice *= 1.10;
        }
    },
    {
        id: 'green-energy',
        title: 'Government Invests in Green Energy',
        description: 'ETFs steady but strong here.',
        affectedAssets: ['sp500-etf'], // Assuming ETF is S&P500 for now, or we need a specific Green ETF. Using S&P500 as proxy or general ETF.
        sentimentImpact: 25,
        duration: 2,
        hint: 'Green energy tends to outperform here.',
        emoji: '🟢📈',
        effect: (assets) => {
            const etf = assets.find(a => a.id === 'sp500-etf');
            if (etf) etf.currentPrice *= 1.05;
        }
    },
    {
        id: 'inflation-fall',
        title: 'Inflation Falls to 2% Target',
        description: 'Safe + growth both win.',
        affectedAssets: ['gov-bond', 'tech-growth'],
        sentimentImpact: 18, // Average of 18 and 14
        duration: 1,
        hint: 'Safe + growth both win.',
        emoji: '🟢📈',
        effect: (assets) => {
            const bond = assets.find(a => a.id === 'gov-bond');
            const tech = assets.find(a => a.id === 'tech-growth');
            if (bond) bond.currentPrice *= 1.04;
            if (tech) tech.currentPrice *= 1.05;
        }
    },
    {
        id: 'rate-cut',
        title: 'Interest Rates Cut by Central Bank',
        description: 'Cheaper money → bullish.',
        affectedAssets: ['tech-growth', 'gov-bond'],
        sentimentImpact: 18,
        duration: 1,
        hint: 'Cheaper money → bullish.',
        emoji: '🟢📈',
        effect: (assets) => {
            const tech = assets.find(a => a.id === 'tech-growth');
            const bond = assets.find(a => a.id === 'gov-bond');
            if (tech) tech.currentPrice *= 1.05;
            if (bond) bond.currentPrice *= 0.97;
        }
    },
    {
        id: 'crypto-etf',
        title: 'Crypto ETF Approved',
        description: 'Rocket emojis go BRRR.',
        affectedAssets: ['btc-coin'],
        sentimentImpact: 35,
        duration: 1,
        hint: 'Rocket emojis go BRRR.',
        emoji: '🤯🚀',
        effect: (assets) => {
            const btc = assets.find(a => a.id === 'btc-coin');
            if (btc) btc.currentPrice *= 1.15;
        }
    },
    {
        id: 'battery-tech',
        title: 'Breakthrough Battery Technology',
        description: 'Long-term trend forming.',
        affectedAssets: ['sp500-etf'],
        sentimentImpact: 30,
        duration: 2,
        hint: 'Long-term trend forming.',
        emoji: '🟢📈',
        effect: (assets) => {
            const etf = assets.find(a => a.id === 'sp500-etf');
            if (etf) etf.currentPrice *= 1.08;
        }
    },
    {
        id: 'blue-chip-beat',
        title: 'Blue-Chip Companies Beat Forecasts',
        description: 'Safe rally.',
        affectedAssets: ['tech-growth'],
        sentimentImpact: 20,
        duration: 1,
        hint: 'Safe rally.',
        emoji: '🟢📈',
        effect: (assets) => {
            const tech = assets.find(a => a.id === 'tech-growth');
            if (tech) tech.currentPrice *= 1.04;
        }
    },
    {
        id: 'retail-fomo',
        title: 'Retail Crypto Adoption Surge',
        description: 'This is when FOMO hits.',
        affectedAssets: ['btc-coin', 'meme-coin'],
        sentimentImpact: 25,
        duration: 1,
        hint: 'This is when FOMO hits.',
        emoji: '🤯🚀',
        effect: (assets) => {
            const btc = assets.find(a => a.id === 'btc-coin');
            if (btc) btc.currentPrice *= 1.06;
        }
    },
    {
        id: 'safe-haven',
        title: 'Safe-Haven Rush',
        description: 'Fear outside = safety inside.',
        affectedAssets: ['gov-bond'],
        sentimentImpact: 22,
        duration: 2,
        hint: 'Fear outside = safety inside.',
        emoji: '🧊😌',
        effect: (assets) => {
            const bond = assets.find(a => a.id === 'gov-bond');
            if (bond) bond.currentPrice *= 1.03;
        }
    },
    // Negative Events
    {
        id: 'crypto-hack',
        title: 'Crypto Exchange Hacked',
        description: 'Not all dips are worth buying.',
        affectedAssets: ['btc-coin', 'meme-coin'],
        sentimentImpact: -40,
        duration: 2,
        hint: 'Not all dips are worth buying.',
        emoji: '🔴📉',
        effect: (assets) => {
            const btc = assets.find(a => a.id === 'btc-coin');
            if (btc) btc.currentPrice *= 0.85;
        }
    },
    {
        id: 'rate-hike-panic',
        title: 'Surprise Rate Hike',
        description: 'Market panic!',
        affectedAssets: ['tech-growth', 'sp500-etf'],
        sentimentImpact: -30,
        duration: 2,
        hint: 'Don\'t fight the Fed.',
        emoji: '⚠😨',
        effect: (assets) => {
            const tech = assets.find(a => a.id === 'tech-growth');
            if (tech) tech.currentPrice *= 0.90;
        }
    }
];
