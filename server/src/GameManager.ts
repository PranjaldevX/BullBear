import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

import { Server } from 'socket.io';
import { GameState, PlayerState, ClientToServerEvents, ServerToClientEvents, AvatarId, StrategyId, GamePhase, PreMatchSubPhase, Scenario, AssetType } from '@bvb/shared';
import { INITIAL_ASSETS } from './data/assets';
import { AVATARS, STRATEGIES, SCENARIOS } from './data/gameData';
import { NEWS_CARDS, NewsCard, newsCardToMarketEvent, getRandomNewsCard, SECTOR_TO_ASSETS } from './data/newsCards';

const GAME_ROUNDS = 5;
const ROUND_DURATION_MS = 35000;
const TOTAL_FRAMES = 35;
const STARTING_CASH = 10000;
const NEWS_PHASE_SECONDS = 5;
const SHOCK_WINDOW_SECONDS = 7; // First 7 seconds of trading = shock window

// ==================== EXTREME GAME MODE VOLATILITY ====================
// NOT REAL LIFE - This is a game! Make it dramatic and fun!
const BASE_VOLATILITY: Record<string, number> = {
    'STOCK': 0.15,    // 15% base - DRAMATIC swings
    'CRYPTO': 0.30,   // 30% base - WILD crypto action
    'BOND': 0.06,     // 6% base - Even bonds move noticeably
    'ETF': 0.10       // 10% base - ETFs swing too
};

// ==================== EXTREME SENTIMENT MULTIPLIERS ====================
const SENTIMENT_MULTIPLIER: Record<string, number> = {
    'very_positive': 3.5,   // MASSIVE rallies
    'positive': 2.2,
    'neutral': 0.3,         // Even neutral has some movement
    'negative': -2.2,
    'very_negative': -3.5   // MASSIVE crashes
};

// ==================== SECTOR SENSITIVITY ====================
const SECTOR_SENSITIVITY: Record<string, number> = {
    'technology': 2.0,
    'finance': 1.8,
    'energy': 1.9,
    'crypto': 3.0,    // Crypto goes CRAZY
    'bonds': 1.2,
    'gold': -1.2      // Inverse correlation
};

// ==================== SAFETY RAILS ====================
const MAX_ROUND_MOVE_PERCENT = 0.40;   // Max ±40% per round - BIG swings allowed
const STABILIZATION_SECONDS = 3;        // Only 3 seconds stabilization
const SHOCK_MULTIPLIER = 2.0;           // 2x amplification in shock window!

export class GameManager {
    private io: Server<ClientToServerEvents, ServerToClientEvents, any, any>;
    private gameState: GameState;
    private roundTimer: NodeJS.Timeout | null = null;
    private preMatchTimer: NodeJS.Timeout | null = null;
    private genAI: GoogleGenerativeAI | null = null;
    private model: any = null;
    private currentPhaseNext: (() => void) | null = null;
    
    // Track current news card
    private currentNewsCard: NewsCard | null = null;
    // Track base prices at round start
    private roundStartPrices: Map<string, number> = new Map();
    // Track last round's sentiment for chaos prevention
    private lastRoundSentiment: string = 'neutral';
    private consecutiveSameSentiment: number = 0;

    constructor(io: Server) {
        this.io = io;
        this.gameState = this.createInitialState();

        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        }
    }

    private createInitialState(): GameState {
        return {
            id: 'game-1',
            players: [],
            assets: JSON.parse(JSON.stringify(INITIAL_ASSETS)),
            currentRound: 0,
            maxRounds: GAME_ROUNDS,
            activeEvent: null,
            phase: 'PRE_MATCH',
            subPhase: 'INTRO',
            timeRemaining: 0,
            activeAssetType: 'ALL',
            activeScenario: null,
            fearZoneActive: false,
            sentiment: { 'STOCK': 0, 'CRYPTO': 0, 'BOND': 0, 'ETF': 0 }
        };
    }

    // ==================== PLAYER MANAGEMENT ====================

    public addPlayer(socketId: string, name: string) {
        console.log(`Adding player: ${name} (${socketId})`);
        const existingPlayerIndex = this.gameState.players.findIndex(p => p.name === name);

        if (existingPlayerIndex !== -1) {
            this.gameState.players[existingPlayerIndex].id = socketId;
        } else {
            const newPlayer: PlayerState = {
                id: socketId,
                name,
                cash: STARTING_CASH,
                holdings: [],
                riskScore: 0,
                powerUps: [
                    { id: 'future-glimpse', name: 'Risk Shield', description: '-20 Risk Score', usesLeft: 1 },
                    { id: 'market-freeze', name: 'Bailout', description: '+$1000 Cash', usesLeft: 1 }
                ],
                totalValue: STARTING_CASH,
                ready: false,
                transactionLog: []
            };
            this.gameState.players.push(newPlayer);
        }
        this.broadcastState();
    }

    public removePlayer(socketId: string) {
        this.gameState.players = this.gameState.players.filter(p => p.id !== socketId);
        this.broadcastState();
        if (this.gameState.players.length === 0) {
            this.resetGame();
        }
    }

    // ==================== PRE-MATCH FLOW ====================

    public startPreMatch() {
        if (this.gameState.phase !== 'PRE_MATCH') return;
        console.log('Starting Pre-Match...');

        this.runSubPhase('INTRO', 3, () => {
            this.runSubPhase('AVATAR_SELECTION', 15, () => {
                this.runSubPhase('STRATEGY_SELECTION', 15, () => {
                    this.gameState.activeScenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
                    this.runSubPhase('SCENARIO_TEASER', 5, () => {
                        this.runSubPhase('TUTORIAL', 5, () => {
                            this.startGame();
                        });
                    });
                });
            });
        });
    }

    private runSubPhase(subPhase: PreMatchSubPhase, durationSeconds: number, next: () => void) {
        console.log(`Running SubPhase: ${subPhase}`);
        this.gameState.subPhase = subPhase;
        this.gameState.timeRemaining = durationSeconds;
        this.broadcastState();
        this.currentPhaseNext = next;

        let timeLeft = durationSeconds;
        if (this.preMatchTimer) clearInterval(this.preMatchTimer);

        this.preMatchTimer = setInterval(() => {
            timeLeft--;
            this.gameState.timeRemaining = timeLeft;
            this.broadcastState();
            if (timeLeft <= 0) this.advancePhase();
        }, 1000);
    }

    private advancePhase() {
        if (this.preMatchTimer) clearInterval(this.preMatchTimer);
        this.preMatchTimer = null;
        if (this.currentPhaseNext) {
            const next = this.currentPhaseNext;
            this.currentPhaseNext = null;
            next();
        }
    }

    private checkAllReady() {
        if (this.gameState.players.length === 0) return;
        let allReady = false;
        if (this.gameState.subPhase === 'AVATAR_SELECTION') {
            allReady = this.gameState.players.every(p => p.avatarId);
        } else if (this.gameState.subPhase === 'STRATEGY_SELECTION') {
            allReady = this.gameState.players.every(p => p.strategyId);
        }
        if (allReady) this.advancePhase();
    }

    public handleSelectAvatar(socketId: string, avatarId: AvatarId) {
        const player = this.gameState.players.find(p => p.id === socketId);
        if (player && this.gameState.subPhase === 'AVATAR_SELECTION') {
            player.avatarId = avatarId;
            this.checkAllReady();
            this.broadcastState();
        }
    }

    public handleSelectStrategy(socketId: string, strategyId: StrategyId) {
        const player = this.gameState.players.find(p => p.id === socketId);
        if (player && this.gameState.subPhase === 'STRATEGY_SELECTION') {
            player.strategyId = strategyId;
            this.checkAllReady();
            this.broadcastState();
        }
    }

    // ==================== GAME FLOW ====================

    public startGame() {
        console.log('Starting Game!');
        this.gameState.phase = 'PLAYING';
        this.gameState.currentRound = 1;
        this.gameState.fearZoneActive = false;
        this.startRound();
    }

    private startRound() {
        if (this.gameState.currentRound > this.gameState.maxRounds) {
            this.endGame();
            return;
        }

        console.log(`\n========== ROUND ${this.gameState.currentRound} ==========`);

        // Fear Zone in Final Round
        if (this.gameState.currentRound === this.gameState.maxRounds) {
            this.gameState.fearZoneActive = true;
        }

        // Store base prices for this round (for safety rails)
        this.roundStartPrices.clear();
        this.gameState.assets.forEach(asset => {
            this.roundStartPrices.set(asset.id, asset.currentPrice);
        });

        // Generate news card for this round
        this.currentNewsCard = getRandomNewsCard();
        this.gameState.activeEvent = newsCardToMarketEvent(this.currentNewsCard);
        
        // Track consecutive same sentiment for chaos prevention
        const currentSentimentType = this.currentNewsCard.sentiment.includes('positive') ? 'positive' : 
                                     this.currentNewsCard.sentiment.includes('negative') ? 'negative' : 'neutral';
        if (currentSentimentType === this.lastRoundSentiment) {
            this.consecutiveSameSentiment++;
        } else {
            this.consecutiveSameSentiment = 0;
        }
        this.lastRoundSentiment = currentSentimentType;
        
        console.log(`📰 NEWS: ${this.currentNewsCard.title}`);
        console.log(`   Sentiment: ${this.currentNewsCard.sentiment} (consecutive: ${this.consecutiveSameSentiment})`);
        console.log(`   Sectors: ${this.currentNewsCard.affectedSectors.join(', ')}`);

        // Apply immediate sentiment change
        this.applySentimentFromNews(this.currentNewsCard);
        
        // Apply sector rotation (unaffected sectors get small positive drift)
        this.applySectorRotation(this.currentNewsCard);

        // Reset timer
        this.gameState.timeRemaining = TOTAL_FRAMES;
        this.broadcastState();

        let currentFrame = 0;

        this.roundTimer = setInterval(() => {
            currentFrame++;
            this.gameState.timeRemaining = Math.max(0, TOTAL_FRAMES - currentFrame);

            const tradingSecondsElapsed = Math.max(0, currentFrame - NEWS_PHASE_SECONDS);
            
            if (currentFrame > NEWS_PHASE_SECONDS) {
                // Trading phase - update prices
                this.updatePricesGameMode(tradingSecondsElapsed);
            }

            this.calculatePlayerValues();
            this.calculateRisk();
            this.broadcastState();

            if (currentFrame >= TOTAL_FRAMES) {
                if (this.roundTimer) clearInterval(this.roundTimer);

                if (this.gameState.currentRound < this.gameState.maxRounds) {
                    this.gameState.currentRound++;
                    this.startRound();
                } else {
                    this.endGame();
                }
            }
        }, 1000);
    }


    // ==================== GAME MODE PRICE MOVEMENT ====================

    private updatePricesGameMode(tradingSecondsElapsed: number) {
        const tradingWindowTotal = TOTAL_FRAMES - NEWS_PHASE_SECONDS; // 30 seconds
        const isShockWindow = tradingSecondsElapsed <= SHOCK_WINDOW_SECONDS;
        const isStabilizationPhase = tradingSecondsElapsed >= (tradingWindowTotal - STABILIZATION_SECONDS);

        this.gameState.assets.forEach(asset => {
            const basePrice = this.roundStartPrices.get(asset.id) || asset.currentPrice;
            let change = 0;

            // 1. NEWS IMPACT (main driver)
            if (this.currentNewsCard) {
                const newsImpact = this.calculateNewsImpact(asset, tradingSecondsElapsed, tradingWindowTotal);
                change += newsImpact;
            }

            // 2. SHOCK WINDOW AMPLIFICATION (first 7 seconds)
            if (isShockWindow) {
                change *= SHOCK_MULTIPLIER;
            }

            // 3. CONTROLLED RANDOMNESS
            const randomFactor = this.getRandomFactor();
            const baseVol = BASE_VOLATILITY[asset.type] || 0.05;
            const randomMovement = (Math.random() - 0.5) * randomFactor * baseVol;
            change += randomMovement;

            // 4. SENTIMENT DRIFT
            const sentiment = this.gameState.sentiment[asset.type];
            const sentimentDrift = (sentiment / 100) * 0.002; // Subtle continuous drift
            change += sentimentDrift;

            // 5. STABILIZATION PHASE (last 5 seconds)
            if (isStabilizationPhase) {
                // Reduce volatility, trend toward mean
                change *= 0.3;
                // Pull slightly toward round start price (mean reversion)
                const currentDeviation = (asset.currentPrice - basePrice) / basePrice;
                change -= currentDeviation * 0.05;
            }

            // 6. APPLY CHANGE
            let newPrice = asset.currentPrice * (1 + change);

            // 7. SAFETY RAILS - Max ±25% from round start
            const maxPrice = basePrice * (1 + MAX_ROUND_MOVE_PERCENT);
            const minPrice = basePrice * (1 - MAX_ROUND_MOVE_PERCENT);
            newPrice = Math.max(minPrice, Math.min(maxPrice, newPrice));

            // Ensure price never goes negative
            newPrice = Math.max(0.000001, newPrice);

            asset.currentPrice = newPrice;
            asset.history.push(newPrice);
            if (asset.history.length > 50) asset.history.shift();
        });
    }

    private calculateNewsImpact(asset: any, tradingSecondsElapsed: number, tradingWindowTotal: number): number {
        if (!this.currentNewsCard) return 0;

        const news = this.currentNewsCard;
        const sentimentMultiplier = SENTIMENT_MULTIPLIER[news.sentiment] || 0;
        
        // Check if this asset's sector is affected
        let sectorMultiplier = 0;
        const assetSector = this.getAssetSector(asset);
        
        if (news.affectedSectors.includes(assetSector)) {
            sectorMultiplier = SECTOR_SENSITIVITY[assetSector] || 1.0;
        } else {
            // Unaffected assets have minimal impact
            sectorMultiplier = 0.1;
        }

        // Time decay: 60% in first 10s, 30% in next 10s, 10% in last 10s
        let timeDecayMultiplier = 1.0;
        if (tradingSecondsElapsed <= 10) {
            timeDecayMultiplier = 0.6 / 10; // Per second in early phase
        } else if (tradingSecondsElapsed <= 20) {
            timeDecayMultiplier = 0.3 / 10; // Per second in mid phase
        } else {
            timeDecayMultiplier = 0.1 / 10; // Per second in late phase
        }

        // Base impact calculation - MAKE IT DRAMATIC
        const baseImpact = sentimentMultiplier * sectorMultiplier * timeDecayMultiplier * 0.025;
        
        return baseImpact;
    }

    private getAssetSector(asset: any): string {
        // Map asset IDs to sectors
        const techAssets = ['tcs', 'infy', 'it-bees'];
        const financeAssets = ['hdfc', 'icici', 'sbi', 'bank-bees', 'us-treasury', 'corp-bond-aaa', 'muni-bond', 'junk-bond', 'tips-bond'];
        const energyAssets = ['reliance', 'infra-bees', 'green-bond'];
        const cryptoAssets = ['sol', 'ltc', 'icp', 'etc', 'qnt', 'egld', 'doge', 'xvs', 'ethfi'];
        const goldAssets = ['gold-bees', 'sov-gold-bond'];

        if (techAssets.includes(asset.id)) return 'technology';
        if (financeAssets.includes(asset.id)) return 'finance';
        if (energyAssets.includes(asset.id)) return 'energy';
        if (cryptoAssets.includes(asset.id)) return 'crypto';
        if (goldAssets.includes(asset.id)) return 'gold';
        if (asset.type === 'BOND') return 'bonds';
        if (asset.type === 'CRYPTO') return 'crypto';
        
        return 'finance'; // Default
    }

    private getRandomFactor(): number {
        // If 2+ rounds of same sentiment, reduce randomness to prevent chaos stacking
        if (this.consecutiveSameSentiment >= 2) {
            return 0.06; // ±6%
        }
        return 0.12; // ±12%
    }

    private applySentimentFromNews(news: NewsCard) {
        const sentimentValue = SENTIMENT_MULTIPLIER[news.sentiment] || 0;
        
        news.affectedSectors.forEach(sector => {
            const assetTypes = this.getAssetTypesForSector(sector);
            assetTypes.forEach(type => {
                const sensitivity = SECTOR_SENSITIVITY[sector] || 1.0;
                const change = sentimentValue * sensitivity * 15; // Amplified for game mode
                this.gameState.sentiment[type as AssetType] = Math.max(-100, Math.min(100, 
                    this.gameState.sentiment[type as AssetType] + change
                ));
            });
        });

        console.log(`   Sentiment after news:`, this.gameState.sentiment);
    }

    private applySectorRotation(news: NewsCard) {
        // If a sector is hit negatively, unaffected sectors get small positive drift
        if (news.sentiment.includes('negative')) {
            const allSectors = ['technology', 'finance', 'energy', 'crypto', 'bonds', 'gold'];
            const unaffectedSectors = allSectors.filter(s => !news.affectedSectors.includes(s));
            
            unaffectedSectors.forEach(sector => {
                const assetTypes = this.getAssetTypesForSector(sector);
                assetTypes.forEach(type => {
                    // Small positive drift (+1-2%)
                    const drift = (Math.random() * 0.01 + 0.01) * 100; // 1-2% as sentiment points
                    this.gameState.sentiment[type as AssetType] = Math.min(100, 
                        this.gameState.sentiment[type as AssetType] + drift
                    );
                });
            });
            
            console.log(`   💫 Sector rotation: ${unaffectedSectors.join(', ')} getting positive drift`);
        }
    }

    private getAssetTypesForSector(sector: string): string[] {
        const mapping: Record<string, string[]> = {
            'technology': ['STOCK'],
            'finance': ['STOCK', 'ETF', 'BOND'],
            'energy': ['STOCK', 'ETF'],
            'crypto': ['CRYPTO'],
            'bonds': ['BOND'],
            'gold': ['ETF']
        };
        return mapping[sector] || ['STOCK'];
    }

    private calculatePlayerValues() {
        this.gameState.players.forEach(player => {
            let holdingsValue = 0;
            player.holdings.forEach(h => {
                const asset = this.gameState.assets.find(a => a.id === h.assetId);
                if (asset) {
                    holdingsValue += h.quantity * asset.currentPrice;
                }
            });
            player.totalValue = player.cash + holdingsValue;
        });
    }

    private calculateRisk() {
        this.gameState.players.forEach(player => {
            let totalRisk = 0;
            let totalPortfolioValue = 0;

            player.holdings.forEach(h => {
                const asset = this.gameState.assets.find(a => a.id === h.assetId);
                if (asset) {
                    const value = h.quantity * asset.currentPrice;
                    totalPortfolioValue += value;
                    const vol = BASE_VOLATILITY[asset.type] || 0.05;
                    totalRisk += value * vol * 300;
                }
            });

            if (totalPortfolioValue > 0) {
                let riskScore = Math.min(100, Math.round(totalRisk / totalPortfolioValue * 100));
                if (player.strategyId === 'SAFETY_FIRST') {
                    riskScore = Math.max(0, riskScore - 10);
                }
                player.riskScore = riskScore;
            } else {
                player.riskScore = 0;
            }
        });
    }


    // ==================== TRADING ====================

    public handleBuy(socketId: string, assetId: string, amount: number) {
        const player = this.gameState.players.find(p => p.id === socketId);
        const asset = this.gameState.assets.find(a => a.id === assetId);

        if (!player || !asset || this.gameState.phase !== 'PLAYING') return;

        // Liquidity scaling: large orders cause self-slippage
        const slippage = this.calculateSlippage(amount, asset.currentPrice);
        const effectivePrice = asset.currentPrice * (1 + slippage);
        const cost = amount * effectivePrice;

        if (player.cash >= cost) {
            player.cash -= cost;
            const holding = player.holdings.find(h => h.assetId === assetId);
            if (holding) {
                const totalCost = (holding.quantity * holding.avgBuyPrice) + cost;
                holding.quantity += amount;
                holding.avgBuyPrice = totalCost / holding.quantity;
            } else {
                player.holdings.push({
                    assetId,
                    quantity: amount,
                    avgBuyPrice: effectivePrice
                });
            }

            player.transactionLog.push({
                round: this.gameState.currentRound,
                type: 'BUY',
                assetId,
                assetType: asset.type,
                amount,
                price: effectivePrice,
                totalValue: cost,
                eventActive: this.gameState.activeEvent?.id,
                sentimentAtTime: this.gameState.sentiment[asset.type]
            });

            this.broadcastState();
        }
    }

    public handleSell(socketId: string, assetId: string, amount: number) {
        const player = this.gameState.players.find(p => p.id === socketId);
        const asset = this.gameState.assets.find(a => a.id === assetId);

        if (!player || !asset || this.gameState.phase !== 'PLAYING') return;

        const holding = player.holdings.find(h => h.assetId === assetId);
        if (holding && holding.quantity >= amount) {
            // Liquidity scaling: large orders cause self-slippage
            const slippage = this.calculateSlippage(amount, asset.currentPrice);
            const effectivePrice = asset.currentPrice * (1 - slippage);
            const revenue = amount * effectivePrice;

            player.cash += revenue;
            holding.quantity -= amount;
            if (holding.quantity <= 0) {
                player.holdings = player.holdings.filter(h => h.assetId !== assetId);
            }

            player.transactionLog.push({
                round: this.gameState.currentRound,
                type: 'SELL',
                assetId,
                assetType: asset.type,
                amount,
                price: effectivePrice,
                totalValue: revenue,
                eventActive: this.gameState.activeEvent?.id,
                sentimentAtTime: this.gameState.sentiment[asset.type]
            });

            this.broadcastState();
        }
    }

    private calculateSlippage(amount: number, price: number): number {
        // Larger orders = more slippage (prevents big players from dominating)
        const orderValue = amount * price;
        if (orderValue > 5000) return 0.02;  // 2% slippage for orders > $5000
        if (orderValue > 2000) return 0.01;  // 1% slippage for orders > $2000
        if (orderValue > 1000) return 0.005; // 0.5% slippage for orders > $1000
        return 0; // No slippage for small orders
    }

    public handleUsePowerUp(socketId: string, powerUpId: string) {
        const player = this.gameState.players.find(p => p.id === socketId);
        if (!player) return;

        const powerUp = player.powerUps.find(p => p.id === powerUpId);
        if (!powerUp || powerUp.usesLeft <= 0) return;

        powerUp.usesLeft--;

        if (powerUpId === 'future-glimpse') {
            player.riskScore = Math.max(0, player.riskScore - 20);
        } else if (powerUpId === 'market-freeze') {
            player.cash += 1000;
        }

        this.broadcastState();
    }

    // ==================== GAME END ====================

    private async endGame() {
        if (this.roundTimer) {
            clearInterval(this.roundTimer);
            this.roundTimer = null;
        }
        this.gameState.phase = 'FINISHED';

        const results = await this.calculateResults();
        this.io.emit('gameOver', results);
        this.broadcastState();
    }

    private async calculateResults() {
        const results = await Promise.all(this.gameState.players.map(async player => {
            const initialValue = STARTING_CASH;
            let finalValue = player.totalValue;

            if (player.strategyId === 'DIVERSIFIER') {
                const uniqueAssets = new Set(player.holdings.map(h => h.assetId)).size;
                if (uniqueAssets >= 4) {
                    finalValue += finalValue * 0.05;
                }
            }

            const roi = ((finalValue - initialValue) / initialValue) * 100;
            const riskAdjustedScore = roi - (player.riskScore * 0.5);

            let analysis;
            try {
                if (this.model) {
                    analysis = await this.generateGeminiAnalysis(player);
                } else {
                    analysis = this.generateHeuristicAnalysis(player);
                }
            } catch (error) {
                analysis = this.generateHeuristicAnalysis(player);
            }

            return {
                playerId: player.id,
                playerName: player.name,
                finalValue,
                riskScore: player.riskScore,
                roi,
                riskAdjustedScore,
                rank: 0,
                insights: analysis.playerSummary.whatYouDidWell.concat(analysis.playerSummary.mistakesAndOpportunities),
                playerSummary: analysis.playerSummary,
                learningCards: analysis.learningCards
            };
        }));

        return results.sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore)
            .map((result, index) => ({ ...result, rank: index + 1 }));
    }

    private async generateGeminiAnalysis(player: PlayerState): Promise<{ playerSummary: any, learningCards: any[] }> {
        const prompt = `You are a financial coach. Analyze this player's trades and provide feedback.
        Return ONLY valid JSON with this structure:
        {"playerSummary":{"whatYouDidWell":["..."],"mistakesAndOpportunities":["..."],"improvementSuggestions":["..."]},"learningCards":[{"title":"...","text":"...","deepDive":"...","searchQuery":"..."}]}
        
        Player trades: ${JSON.stringify(player.transactionLog)}
        Final ROI: ${((player.totalValue - STARTING_CASH) / STARTING_CASH * 100).toFixed(1)}%
        Risk Score: ${player.riskScore}`;

        const result = await this.model.generateContent(prompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    }

    private generateHeuristicAnalysis(player: PlayerState): { playerSummary: any, learningCards: any[] } {
        const summary = {
            whatYouDidWell: ["You participated in the market!"],
            mistakesAndOpportunities: ["Consider diversifying more."],
            improvementSuggestions: ["Watch the news for trading signals."]
        };
        const cards = [{
            title: "News Drives Markets",
            text: "React quickly to news but don't panic sell.",
            deepDive: "Markets overreact to news in the short term. Smart traders buy fear and sell greed.",
            searchQuery: "how news affects stock prices"
        }];
        return { playerSummary: summary, learningCards: cards };
    }

    // ==================== RESET & UTILITIES ====================

    private resetGame() {
        console.log("Resetting Game...");
        if (this.roundTimer) clearInterval(this.roundTimer);
        if (this.preMatchTimer) clearInterval(this.preMatchTimer);
        this.roundTimer = null;
        this.preMatchTimer = null;

        // Store existing players before reset
        const existingPlayers = this.gameState.players;

        // Reset game state
        this.gameState = this.createInitialState();
        this.gameState.assets = JSON.parse(JSON.stringify(INITIAL_ASSETS));
        this.lastRoundSentiment = 'neutral';
        this.consecutiveSameSentiment = 0;

        // Restore players with reset stats
        this.gameState.players = existingPlayers.map(p => ({
            id: p.id,
            name: p.name,
            cash: STARTING_CASH,
            holdings: [],
            riskScore: 0,
            powerUps: [
                { id: 'future-glimpse', name: 'Risk Shield', description: '-20 Risk Score', usesLeft: 1 },
                { id: 'market-freeze', name: 'Bailout', description: '+$1000 Cash', usesLeft: 1 }
            ],
            totalValue: STARTING_CASH,
            avatarId: undefined,
            strategyId: undefined,
            ready: false,
            transactionLog: []
        }));
    }

    public handlePlayAgain() {
        console.log("Play Again requested");
        this.resetGame();
        this.broadcastState(); // Broadcast reset state immediately
        this.startPreMatch();
    }

    private broadcastState() {
        this.io.emit('gameState', this.gameState);
    }
}
