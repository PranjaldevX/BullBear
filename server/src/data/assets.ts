import { Asset } from '@bvb/shared';

export const INITIAL_ASSETS: Asset[] = [
    // Stocks (Round 1) - Indian Stocks in USD
    {
        id: 'reliance',
        name: 'Reliance Ind.',
        type: 'STOCK',
        baseVolatility: 0.02,
        trendBias: 'UP',
        currentPrice: 29.50, // Approx $2450 INR
        history: [29.50]
    },
    {
        id: 'tcs',
        name: 'TCS',
        type: 'STOCK',
        baseVolatility: 0.015,
        trendBias: 'SIDEWAYS',
        currentPrice: 42.00, // Approx $3500 INR
        history: [42.00]
    },
    {
        id: 'hdfc',
        name: 'HDFC Bank',
        type: 'STOCK',
        baseVolatility: 0.018,
        trendBias: 'UP',
        currentPrice: 19.20, // Approx $1600 INR
        history: [19.20]
    },
    {
        id: 'infy',
        name: 'Infosys',
        type: 'STOCK',
        baseVolatility: 0.022,
        trendBias: 'DOWN',
        currentPrice: 16.80, // Approx $1400 INR
        history: [16.80]
    },
    {
        id: 'icici',
        name: 'ICICI Bank',
        type: 'STOCK',
        baseVolatility: 0.019,
        trendBias: 'UP',
        currentPrice: 11.50,
        history: [11.50]
    },
    {
        id: 'tatamotors',
        name: 'Tata Motors',
        type: 'STOCK',
        baseVolatility: 0.025,
        trendBias: 'UP',
        currentPrice: 8.40,
        history: [8.40]
    },

    // ... (Existing stocks)
    {
        id: 'sbi',
        name: 'SBI',
        type: 'STOCK',
        baseVolatility: 0.02,
        trendBias: 'UP',
        currentPrice: 7.50,
        history: [7.50]
    },

    // Crypto (Round 2) - Dynamic & Cheaper
    {
        id: 'doge',
        name: 'Dogecoin',
        type: 'CRYPTO',
        baseVolatility: 0.15, // High volatility
        trendBias: 'SIDEWAYS',
        currentPrice: 0.15,
        history: [0.15]
    },
    {
        id: 'shib',
        name: 'Shiba Inu',
        type: 'CRYPTO',
        baseVolatility: 0.20, // Very high volatility
        trendBias: 'UP',
        currentPrice: 0.00003, // Very cheap
        history: [0.00003]
    },
    {
        id: 'pepe',
        name: 'Pepe',
        type: 'CRYPTO',
        baseVolatility: 0.25,
        trendBias: 'DOWN',
        currentPrice: 0.000001,
        history: [0.000001]
    },
    {
        id: 'bonk',
        name: 'Bonk',
        type: 'CRYPTO',
        baseVolatility: 0.18,
        trendBias: 'UP',
        currentPrice: 0.000012,
        history: [0.000012]
    },
    {
        id: 'floki',
        name: 'Floki',
        type: 'CRYPTO',
        baseVolatility: 0.22,
        trendBias: 'UP',
        currentPrice: 0.00015,
        history: [0.00015]
    },
    {
        id: 'wif',
        name: 'WIF',
        type: 'CRYPTO',
        baseVolatility: 0.28,
        trendBias: 'UP',
        currentPrice: 2.50,
        history: [2.50]
    },
    {
        id: 'mog',
        name: 'Mog Coin',
        type: 'CRYPTO',
        baseVolatility: 0.30,
        trendBias: 'SIDEWAYS',
        currentPrice: 0.000001,
        history: [0.000001]
    },

    // ETFs (Round 3)
    {
        id: 'nifty-bees',
        name: 'Nifty 50 ETF',
        type: 'ETF',
        baseVolatility: 0.01,
        trendBias: 'UP',
        currentPrice: 2.60, // Approx $215 INR
        history: [2.60]
    },
    {
        id: 'gold-bees',
        name: 'Gold ETF',
        type: 'ETF',
        baseVolatility: 0.005,
        trendBias: 'SIDEWAYS',
        currentPrice: 0.62, // Approx $52 INR
        history: [0.62]
    },
    {
        id: 'bank-bees',
        name: 'Bank Nifty ETF',
        type: 'ETF',
        baseVolatility: 0.012,
        trendBias: 'UP',
        currentPrice: 5.40,
        history: [5.40]
    },
    {
        id: 'it-bees',
        name: 'IT ETF',
        type: 'ETF',
        baseVolatility: 0.015,
        trendBias: 'DOWN',
        currentPrice: 0.45,
        history: [0.45]
    },
    {
        id: 'pharma-bees',
        name: 'Pharma ETF',
        type: 'ETF',
        baseVolatility: 0.014,
        trendBias: 'UP',
        currentPrice: 1.80,
        history: [1.80]
    },
    {
        id: 'auto-bees',
        name: 'Auto ETF',
        type: 'ETF',
        baseVolatility: 0.018,
        trendBias: 'SIDEWAYS',
        currentPrice: 2.10,
        history: [2.10]
    },
    {
        id: 'infra-bees',
        name: 'Infra ETF',
        type: 'ETF',
        baseVolatility: 0.016,
        trendBias: 'UP',
        currentPrice: 3.20,
        history: [3.20]
    },

    // Bonds (Round 4)
    {
        id: 'us-treasury',
        name: 'US Treasury 10Y',
        type: 'BOND',
        baseVolatility: 0.002,
        trendBias: 'SIDEWAYS',
        currentPrice: 98.50,
        history: [98.50]
    },
    {
        id: 'corp-bond-aaa',
        name: 'Global Corp Bond',
        type: 'BOND',
        baseVolatility: 0.003,
        trendBias: 'UP',
        currentPrice: 105.00,
        history: [105.00]
    },
    {
        id: 'muni-bond',
        name: 'Municipal Bond',
        type: 'BOND',
        baseVolatility: 0.001,
        trendBias: 'SIDEWAYS',
        currentPrice: 101.20,
        history: [101.20]
    },
    {
        id: 'junk-bond',
        name: 'High Yield Bond',
        type: 'BOND',
        baseVolatility: 0.008,
        trendBias: 'DOWN',
        currentPrice: 88.50,
        history: [88.50]
    },
    {
        id: 'green-bond',
        name: 'Green Energy Bond',
        type: 'BOND',
        baseVolatility: 0.004,
        trendBias: 'UP',
        currentPrice: 102.50,
        history: [102.50]
    },
    {
        id: 'sov-gold-bond',
        name: 'Sovereign Gold Bond',
        type: 'BOND',
        baseVolatility: 0.003,
        trendBias: 'UP',
        currentPrice: 99.80,
        history: [99.80]
    },
    {
        id: 'tips-bond',
        name: 'Inflation Protected',
        type: 'BOND',
        baseVolatility: 0.002,
        trendBias: 'SIDEWAYS',
        currentPrice: 100.10,
        history: [100.10]
    }
];
