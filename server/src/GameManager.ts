import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

import { Server } from 'socket.io';
import { GameState, PlayerState, ClientToServerEvents, ServerToClientEvents, AvatarId, StrategyId, GamePhase, PreMatchSubPhase, Scenario, AssetType } from '@bvb/shared';
import { INITIAL_ASSETS } from './data/assets';
import { MARKET_EVENTS } from './data/events';
import { AVATARS, STRATEGIES, SCENARIOS } from './data/gameData';

const GAME_ROUNDS = 5;
const ROUND_DURATION_MS = 35000; // 35 seconds
const FRAMES_PER_SECOND = 1; // Update once per second
const TOTAL_FRAMES = 35;
const STARTING_CASH = 10000;

export class GameManager {
    private io: Server<ClientToServerEvents, ServerToClientEvents, any, any>;
    private gameState: GameState;
    private gameLoopInterval: NodeJS.Timeout | null = null;
    private roundTimer: NodeJS.Timeout | null = null;
    private preMatchTimer: NodeJS.Timeout | null = null;
    private genAI: GoogleGenerativeAI | null = null;
    private model: any = null;

    constructor(io: Server) {
        this.io = io;
        this.gameState = {
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
            sentiment: {
                'STOCK': 0,
                'CRYPTO': 0,
                'BOND': 0,
                'ETF': 0
            }
        };

        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        } else {
            console.warn("GEMINI_API_KEY not found in .env. Falling back to heuristic coach.");
        }
    }

    // ... (rest of class)

    private async calculateResults() {
        // Note: calculateResults is now async to await Gemini
        const results = await Promise.all(this.gameState.players.map(async player => {
            const initialValue = STARTING_CASH;
            let finalValue = player.totalValue;

            // Strategy: Diversifier Bonus
            if (player.strategyId === 'DIVERSIFIER') {
                const uniqueAssets = new Set(player.holdings.map(h => h.assetId)).size;
                if (uniqueAssets >= 4) {
                    finalValue += finalValue * 0.05; // 5% bonus
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
                console.error("Gemini API Error:", error);
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
        const prompt = `
        You are an educational financial coach in a game called "Bull vs Bear Royale".
        Analyze this player's game log and provide 3 sections of feedback: "whatYouDidWell", "mistakesAndOpportunities", and "improvementSuggestions".
        BE BRUTALLY HONEST and SPECIFIC. Reference specific rounds or assets if possible (e.g., "You panic sold Bitcoin in Round 3").
        
        Also provide 3 "learningCards" with:
        - "title": Short title
        - "text": Brief summary (max 25 words)
        - "deepDive": A paragraph explaining the financial concept in detail (max 80 words).
        - "searchQuery": A Google search query to learn more about this topic.
        
        Return ONLY valid JSON. No markdown formatting. Structure:
        {
          "playerSummary": {
            "whatYouDidWell": ["..."],
            "mistakesAndOpportunities": ["..."],
            "improvementSuggestions": ["..."]
          },
          "learningCards": [
            { "title": "...", "text": "...", "deepDive": "...", "searchQuery": "..." }
          ]
        }

        Game Context:
        - Rounds: ${this.gameState.maxRounds}
        - Events: ${JSON.stringify(MARKET_EVENTS.map(e => ({ id: e.id, title: e.title })))}
        
        Player Log:
        ${JSON.stringify(player.transactionLog)}
        
        Final Stats:
        - ROI: ${((player.totalValue - STARTING_CASH) / STARTING_CASH * 100).toFixed(1)}%
        - Risk Score: ${player.riskScore}
        `;

        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    }

    private generateHeuristicAnalysis(player: PlayerState): { playerSummary: any, learningCards: any[] } {
        const summary = {
            whatYouDidWell: [] as string[],
            mistakesAndOpportunities: [] as string[],
            improvementSuggestions: [] as string[]
        };
        const cards: any[] = [];

        // Heuristic 1: Diversification
        const uniqueAssets = new Set(player.holdings.map(h => h.assetId)).size;
        if (uniqueAssets >= 3) {
            summary.whatYouDidWell.push("You maintained a diversified portfolio, spreading risk across multiple assets.");
            cards.push({
                title: "Diversification Wins",
                text: "Spreading capital reduces the impact of any single asset crashing.",
                deepDive: "Diversification is a risk management strategy that mixes a wide variety of investments within a portfolio. A diversified portfolio contains a mix of distinct asset types and investment vehicles in an attempt at limiting exposure to any single asset or risk.",
                searchQuery: "benefits of portfolio diversification"
            });
        } else if (uniqueAssets <= 1 && player.holdings.length > 0) {
            summary.mistakesAndOpportunities.push("You concentrated all your capital in a single asset, exposing you to high risk.");
            summary.improvementSuggestions.push("Aim to hold at least 2-3 different assets to balance your portfolio.");
            cards.push({
                title: "Don't Put All Eggs in One Basket",
                text: "Concentrated portfolios can make you rich or broke. Diversification keeps you in the game.",
                deepDive: "Concentration risk is the potential for a loss in value of an investment portfolio or a financial institution when an individual or group of exposures move together. The opposite of diversification.",
                searchQuery: "investment concentration risk"
            });
        }

        // Heuristic 2: Reaction to Sentiment
        let badSentimentBuys = 0;
        let goodSentimentBuys = 0;
        player.transactionLog.forEach(tx => {
            if (tx.type === 'BUY') {
                if (tx.sentimentAtTime < -30) badSentimentBuys++;
                if (tx.sentimentAtTime > 30) goodSentimentBuys++;
            }
        });

        if (badSentimentBuys > 0) {
            summary.whatYouDidWell.push("You were brave enough to buy when sentiment was low (contrarian investing).");
        }
        if (goodSentimentBuys > 2) {
            summary.mistakesAndOpportunities.push("You often chased hype, buying when sentiment was already very high.");
            summary.improvementSuggestions.push("Be careful buying when everyone is euphoric; a correction is often near.");
            cards.push({
                title: "Beware the Hype",
                text: "When everyone is buying, the price is often near a peak. Look for value, not just momentum.",
                deepDive: "FOMO (Fear Of Missing Out) often drives investors to buy assets at their peak. Smart investors look for 'value'—assets that are undervalued by the market—rather than just chasing what is currently popular.",
                searchQuery: "FOMO trading psychology"
            });
        }

        // Fallback content
        if (summary.whatYouDidWell.length === 0) summary.whatYouDidWell.push("You actively participated in the market.");
        if (summary.mistakesAndOpportunities.length === 0) summary.mistakesAndOpportunities.push("You played it safe, perhaps missing some growth opportunities.");
        if (summary.improvementSuggestions.length === 0) summary.improvementSuggestions.push("Try experimenting with different strategies next time.");
        if (cards.length === 0) cards.push({
            title: "Keep Learning",
            text: "Every trade is a lesson. Review your wins and losses to improve.",
            deepDive: "Continuous learning is key to financial success. Markets evolve, and strategies that worked yesterday might not work today. Keep studying market trends and economic indicators.",
            searchQuery: "how to learn stock trading"
        });

        return { playerSummary: summary, learningCards: cards.slice(0, 3) };
    }

    public addPlayer(socketId: string, name: string) {
        console.log(`Adding player: ${name} (${socketId})`);

        // Check if player with same name already exists
        const existingPlayerIndex = this.gameState.players.findIndex(p => p.name === name);

        if (existingPlayerIndex !== -1) {
            console.log(`Player ${name} already exists. Updating socket ID.`);
            // Update existing player's socket ID
            this.gameState.players[existingPlayerIndex].id = socketId;
            // Ensure they are marked as connected/ready if needed? 
            // For now just updating ID is enough to reclaim the session.
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
            console.log("All players disconnected. Resetting game.");
            this.resetGame();
        }
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

    public startPreMatch() {
        console.log('Attempting to start Pre-Match. Current phase:', this.gameState.phase);
        if (this.gameState.phase !== 'PRE_MATCH') return;

        // Sequence: INTRO (3s) -> AVATAR (15s) -> STRATEGY (15s) -> SCENARIO (5s) -> TUTORIAL (5s) -> START
        // Reduced static times as requested

        this.runSubPhase('INTRO', 3, () => {
            this.runSubPhase('AVATAR_SELECTION', 15, () => {
                this.runSubPhase('STRATEGY_SELECTION', 15, () => {
                    // Pick a random scenario
                    const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
                    this.gameState.activeScenario = scenario;

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

        // Store the next callback so we can call it early if everyone is ready
        this.currentPhaseNext = next;

        let timeLeft = durationSeconds;
        if (this.preMatchTimer) clearInterval(this.preMatchTimer);

        this.preMatchTimer = setInterval(() => {
            timeLeft--;
            this.gameState.timeRemaining = timeLeft;
            this.broadcastState();

            if (timeLeft <= 0) {
                this.advancePhase();
            }
        }, 1000);
    }

    private currentPhaseNext: (() => void) | null = null;

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

        console.log(`Checking Ready: ${allReady} (Phase: ${this.gameState.subPhase}, Players: ${this.gameState.players.length})`);
        if (!allReady) {
            // Log who is not ready
            const notReady = this.gameState.players.filter(p =>
                (this.gameState.subPhase === 'AVATAR_SELECTION' && !p.avatarId) ||
                (this.gameState.subPhase === 'STRATEGY_SELECTION' && !p.strategyId)
            );
            console.log("Waiting for:", notReady.map(p => p.name).join(', '));
        }

        if (allReady) {
            console.log("All players ready! Advancing phase...");
            this.advancePhase();
        }
    }

    public startGame() {
        console.log('Starting Game!');
        this.gameState.phase = 'PLAYING';
        this.gameState.currentRound = 1;
        this.gameState.fearZoneActive = false;
        this.startRound();
        this.broadcastState();
    }

    private resetGame() {
        console.log("Resetting Game...");
        if (this.roundTimer) {
            clearInterval(this.roundTimer);
            this.roundTimer = null;
        }
        if (this.preMatchTimer) {
            clearInterval(this.preMatchTimer);
            this.preMatchTimer = null;
        }

        this.gameState.currentRound = 0;
        this.gameState.timeRemaining = 0;
        this.gameState.activeEvent = null;
        this.gameState.activeScenario = null;
        this.gameState.fearZoneActive = false;
        this.gameState.phase = 'PRE_MATCH';
        this.gameState.subPhase = 'INTRO';
        this.gameState.assets = JSON.parse(JSON.stringify(INITIAL_ASSETS));
        this.gameState.sentiment = {
            'STOCK': 0,
            'CRYPTO': 0,
            'BOND': 0,
            'ETF': 0
        };
        this.gameState.players.forEach(p => {
            p.cash = STARTING_CASH;
            p.holdings = [];
            p.riskScore = 0;
            p.totalValue = STARTING_CASH;
            p.avatarId = undefined;
            p.strategyId = undefined;
            p.powerUps = [
                { id: 'future-glimpse', name: 'Risk Shield', description: '-20 Risk Score', usesLeft: 1 },
                { id: 'market-freeze', name: 'Bailout', description: '+$1000 Cash', usesLeft: 1 }
            ];
            p.transactionLog = [];
        });
    }

    private startRound() {
        if (this.gameState.currentRound > this.gameState.maxRounds) {
            this.endGame();
            return;
        }

        this.gameState.timeRemaining = ROUND_DURATION_MS / 1000;

        // Manage Active Event Duration
        if (this.gameState.activeEvent && this.gameState.activeEvent.duration > 1) {
            console.log(`Event ${this.gameState.activeEvent.title} continuing. Rounds left: ${this.gameState.activeEvent.duration}`);
            this.gameState.activeEvent.duration--;
        } else {
            this.gameState.activeEvent = null;
        }

        // Fear Zone in Final Round
        if (this.gameState.currentRound === this.gameState.maxRounds) {
            this.gameState.fearZoneActive = true;
        }

        // Trigger event logic (only if no active event)
        if (!this.gameState.activeEvent) {
            // User request: "I choose 35 seconds... 5 seconds for the news".
            // High probability to ensure the "News Phase" has content.
            if (Math.random() < 0.8 && !this.gameState.activeScenario) {
                this.generateMarketTwist();
            }
        }

        // Initial sentiment decay at start of round
        (Object.keys(this.gameState.sentiment) as AssetType[]).forEach(type => {
            this.gameState.sentiment[type] *= 0.90;
        });

        let currentFrame = 0;
        this.gameState.timeRemaining = ROUND_DURATION_MS / 1000;

        // Loop for 35 seconds (frames)
        this.roundTimer = setInterval(() => {
            currentFrame++;
            this.gameState.timeRemaining = Math.max(0, (TOTAL_FRAMES - currentFrame));

            // Dedicated News Phase (First 5 Seconds: Time 35 -> 30)
            if (this.gameState.timeRemaining < 30) {
                this.updatePrices();
            } else {
                // Market Frozen for News Reading
                // console.log("Market Frozen for News Phase");
            }

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

    private updatePrices() {
        this.gameState.assets.forEach(asset => {
            let change = 0;

            // 1. News Impact (if active event)
            if (this.gameState.activeEvent && this.gameState.activeEvent.impact) {
                const impact = this.gameState.activeEvent.impact[asset.type] || 0;
                if (impact !== 0) {
                    // Apply impact spread over the round frames
                    change += impact / TOTAL_FRAMES;
                }
            }

            // 2. Volatility (Randomness)
            // Apply volatility_multiplier if present
            let volMultiplier = 1.0;
            if (this.gameState.activeEvent && this.gameState.activeEvent.volatility_multiplier) {
                volMultiplier = this.gameState.activeEvent.volatility_multiplier;
            }

            const randomMovement = (Math.random() - 0.5) * 0.015 * asset.baseVolatility * volMultiplier;
            change += randomMovement;

            // 3. Sentiment Drift (Longer term bias)
            const sentiment = this.gameState.sentiment[asset.type];
            const sentimentDrift = (sentiment / 100) * (0.05 / TOTAL_FRAMES);
            change += sentimentDrift;

            // Apply Update
            asset.currentPrice = asset.currentPrice * (1 + change);
            asset.history.push(asset.currentPrice);
            if (asset.history.length > 50) asset.history.shift();
        });

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
                    // Reduced multiplier from 1000 to 500 to lower risk score spikes
                    totalRisk += value * asset.baseVolatility * 500;
                }
            });

            if (totalPortfolioValue > 0) {
                // Cap risk score at 100, but make it harder to reach
                let riskScore = Math.min(100, Math.round(totalRisk / totalPortfolioValue * 100));

                // Strategy: Safety First (-10% risk penalty)
                if (player.strategyId === 'SAFETY_FIRST') {
                    riskScore = Math.max(0, riskScore - 10);
                }

                player.riskScore = riskScore;
            } else {
                player.riskScore = 0;
            }
        });
    }

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



    private broadcastState() {
        console.log('Broadcasting State. Phase:', this.gameState.phase, 'SubPhase:', this.gameState.subPhase);
        this.io.emit('gameState', this.gameState);
    }

    public handleBuy(socketId: string, assetId: string, amount: number) {
        const player = this.gameState.players.find(p => p.id === socketId);
        const asset = this.gameState.assets.find(a => a.id === assetId);

        if (!player || !asset || this.gameState.phase !== 'PLAYING') return;

        const cost = amount * asset.currentPrice;
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
                    avgBuyPrice: asset.currentPrice
                });
            }

            // Record Transaction
            player.transactionLog.push({
                round: this.gameState.currentRound,
                type: 'BUY',
                assetId,
                assetType: asset.type,
                amount,
                price: asset.currentPrice,
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
            const revenue = amount * asset.currentPrice;
            player.cash += revenue;
            holding.quantity -= amount;
            if (holding.quantity <= 0) {
                player.holdings = player.holdings.filter(h => h.assetId !== assetId);
            }
            this.broadcastState();

            // Record Transaction
            player.transactionLog.push({
                round: this.gameState.currentRound,
                type: 'SELL',
                assetId,
                assetType: asset.type,
                amount,
                price: asset.currentPrice,
                totalValue: revenue,
                eventActive: this.gameState.activeEvent?.id,
                sentimentAtTime: this.gameState.sentiment[asset.type]
            });
        }
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

    public handlePlayAgain() {
        console.log("Received Play Again Request");
        this.resetGame();
        this.startPreMatch();
    }

    // Helper to map sectors to game assets
    private mapSectorsToAssets(sectors: string[]): string[] {
        const affected: string[] = [];
        // Simple heuristic mapping
        sectors.forEach(s => {
            const lower = s.toLowerCase();
            if (lower.includes('tech') || lower.includes('autom')) affected.push('STOCK');
            if (lower.includes('finance')) affected.push('STOCK', 'ETF');
            if (lower.includes('energy') || lower.includes('manufact')) affected.push('STOCK');
            if (lower.includes('pharma')) affected.push('STOCK');
            if (lower.includes('retail') || lower.includes('travel')) affected.push('STOCK');
            if (lower.includes('agri')) affected.push('STOCK');
        });
        // Default if empty or unclear
        if (affected.length === 0) affected.push('STOCK');
        return Array.from(new Set(affected));
    }

    private async generateMarketTwist() {
        console.log("Generating Market Twist (The Oracle)...");

        // 1. Generate Headline & Analysis
        const prompt = `
        You are a financial sentiment + market effect engine. 
        Your job is to generate a realistic financial news headline and then analyze it to produce a JSON object used in a stock market simulation game.
        
        Generate a random, realistic news headline first. Then follow these instructions:

        Input: The news headline you just generated.

        Goals:
        1. Determine overall sentiment as one label: 
        ["Strong Positive", "Positive", "Neutral", "Negative", "Strong Negative"]

        2. Identify the correct market sectors directly affected. 
        Choose from:
        ["Automobile", "Technology", "Finance", "Pharma", "Energy", "Retail", "Travel", "Agriculture", "Manufacturing"]

        3. Based on sentiment, produce a realistic predicted stock price impact range: 
        Strong Positive → +8 to +20
        Positive → +3 to +12
        Neutral → -1 to +1
        Negative → -3 to -12
        Strong Negative → -8 to -20
        (Return as integer percentages, e.g. 8 for 8%)

        4. Generate volatility_multiplier:
        Strong Positive or Negative → 1.5
        Positive or Negative → 1.2
        Neutral → 1.0

        5. Generate momentum_rounds:
        Positive / Negative sentiment = 2 to 3 rounds
        Strong sentiment = 3 to 4 rounds
        Neutral = 1 round

        Output must be valid JSON in this format:
        {
        "id": <random number>,
        "news": "<headline>",
        "emotion": "<sentiment>",
        "sector": ["<sector1>", "<sector2>"],
        "impact_range_percent": {
            "min": <number>,
            "max": <number>
        },
        "momentum_rounds": <number>,
        "volatility_multiplier": <number>
        }

        Rules:
        - Do not add explanation.
        - Do not add extra text.
        - Do not break JSON format.
        - Numbers must be integers (except multipliers which can be float).
        `;

        try {
            let data: any;

            if (this.model) {
                const result = await this.model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();
                const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
                data = JSON.parse(jsonStr);
            } else {
                console.warn("Gemini model not available. Using fallback twist.");
                // Fallback Mock Data
                data = {
                    id: Math.floor(Math.random() * 1000),
                    news: "Unexpected Market Mock Event",
                    emotion: "Neutral",
                    sector: ["Finance"],
                    impact_range_percent: { min: -1, max: 1 },
                    momentum_rounds: 1,
                    volatility_multiplier: 1.0
                };
            }

            console.log("Oracle Analysis:", data);

            // Map to Game Event Structure
            const affectedAssetsTypes = this.mapSectorsToAssets(data.sector || []);

            // Calculate a specific impact target for this event instance (random within range)
            const min = data.impact_range_percent.min;
            const max = data.impact_range_percent.max;
            // Random integer between min and max
            const impactPercent = Math.floor(Math.random() * (max - min + 1)) + min;
            const impactDecimal = impactPercent / 100;

            const impactRecord: Partial<Record<AssetType, number>> = {};
            affectedAssetsTypes.forEach(t => {
                // @ts-ignore
                impactRecord[t] = impactDecimal;
            });

            // Map emotion to simple sentiment for client compatibility
            let simpleSentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
            if (data.emotion.includes('Positive')) simpleSentiment = 'positive';
            if (data.emotion.includes('Negative')) simpleSentiment = 'negative';

            this.gameState.activeEvent = {
                id: `evt-${Date.now()}`,
                title: data.news,
                description: `Sectors: ${data.sector.join(', ')}. Sentiment: ${data.emotion}.`,
                affectedAssets: affectedAssetsTypes, // Broad types for now
                sentiment: simpleSentiment,
                intensity: data.emotion.includes('Strong') ? 'high' : 'medium', // heuristic
                tags: data.sector,
                impact: impactRecord,
                duration: data.momentum_rounds,

                // New Fields
                emotion: data.emotion,
                sectors: data.sector,
                impact_range_percent: data.impact_range_percent,
                momentum_rounds: data.momentum_rounds,
                volatility_multiplier: data.volatility_multiplier,

                hint: "The Oracle has spoken.",
                emoji: "🔮"
            };

            // Apply immediate sentiment score update
            // Strong = +/- 30, Normal = +/- 15
            let sentimentChange = 0;
            if (data.emotion === 'Strong Positive') sentimentChange = 30;
            else if (data.emotion === 'Positive') sentimentChange = 15;
            else if (data.emotion === 'Negative') sentimentChange = -15;
            else if (data.emotion === 'Strong Negative') sentimentChange = -30;

            affectedAssetsTypes.forEach(t => {
                // @ts-ignore
                this.gameState.sentiment[t] += sentimentChange;
                // @ts-ignore
                this.gameState.sentiment[t] = Math.max(-100, Math.min(100, this.gameState.sentiment[t]));
            });

            this.broadcastState();

        } catch (error) {
            console.error("Failed to generate market twist:", error);
            console.warn("Using fallback twist due to API error.");

            const FALLBACK_TWISTS = [
                {
                    title: "Unexpected Market Volatility",
                    affectedAssets: ["STOCK", "CRYPTO"],
                    sentiment: "negative",
                    intensity: "medium",
                    tags: ["fear", "volatility"],
                    impact: { "STOCK": -0.05, "CRYPTO": -0.05 },
                    emotion: "Negative",
                    sectors: ["Technology", "Finance"],
                    impact_range_percent: { min: -3, max: -8 },
                    momentum_rounds: 2,
                    volatility_multiplier: 1.2
                },
                {
                    title: "Institutional Buying Spree",
                    affectedAssets: ["ETF", "BOND"],
                    sentiment: "positive",
                    intensity: "medium",
                    tags: ["institutional", "volume"],
                    impact: { "ETF": 0.03, "BOND": 0.02 },
                    emotion: "Positive",
                    sectors: ["Finance"],
                    impact_range_percent: { min: 2, max: 6 },
                    momentum_rounds: 2,
                    volatility_multiplier: 1.2
                }
            ];
            // @ts-ignore
            const data = FALLBACK_TWISTS[Math.floor(Math.random() * FALLBACK_TWISTS.length)];

            this.gameState.activeEvent = {
                id: `evt-fallback-${Date.now()}`,
                title: data.title,
                description: `Sectors: ${data.sectors.join(', ')}. Sentiment: ${data.emotion}.`,
                affectedAssets: data.affectedAssets,
                sentiment: data.sentiment as 'positive' | 'negative' | 'neutral',
                intensity: data.intensity as 'low' | 'medium' | 'high',
                tags: data.tags,
                impact: data.impact as any,
                duration: data.momentum_rounds,

                emotion: data.emotion,
                sectors: data.sectors,
                impact_range_percent: data.impact_range_percent,
                momentum_rounds: data.momentum_rounds,
                volatility_multiplier: data.volatility_multiplier,

                hint: "The Oracle has spoken.",
                emoji: "🔮"
            };

            this.broadcastState();
        }
    }
}
