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
            this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
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
        this.gameState.activeEvent = null;

        // Fear Zone in Final Round
        if (this.gameState.currentRound === this.gameState.maxRounds) {
            this.gameState.fearZoneActive = true;
        }

        // Trigger event logic (simplified for now, maybe enhance later)
        // Trigger event logic (30% chance)
        if (Math.random() < 0.3 && !this.gameState.activeScenario) {
            const event = MARKET_EVENTS[Math.floor(Math.random() * MARKET_EVENTS.length)];
            this.gameState.activeEvent = {
                id: event.id,
                title: event.title,
                description: event.description,
                affectedAssets: event.affectedAssets,
                sentimentImpact: event.sentimentImpact,
                duration: event.duration,
                hint: event.hint,
                emoji: event.emoji
            };

            // Apply Sentiment Impact
            event.affectedAssets.forEach(assetId => {
                const asset = this.gameState.assets.find(a => a.id === assetId);
                if (asset) {
                    // Update sentiment: fade old + add new
                    // We need to map assetId to AssetType for sentiment tracking
                    // Assuming asset.type is correct
                    const currentSentiment = this.gameState.sentiment[asset.type];
                    // Formula: sentiment[A] = sentiment[A] * 0.70 + (impact * 0.30)
                    // But impact is e.g. 28. Let's just add it but clamp it?
                    // User formula: sentiment[A] = sentiment[A] * 0.70 + (impact * 100 * 0.30) -> wait, impact in user doc was percent?
                    // User doc: "impact +X% or -X% drift... Sentiment Impact +28"
                    // Let's use the provided numbers directly as raw additions but decayed.
                    // New Sentiment = Old * 0.9 (decay) + Impact

                    // Actually, let's follow the "Updating sentiment" section:
                    // sentiment[A] = sentiment[A] * 0.70 + (impact * 100 * 0.30) ?? 
                    // The user example table says "Sentiment Impact: +28".
                    // Let's just ADD the impact to the current sentiment, but clamp at -100/100.

                    let newSentiment = currentSentiment + event.sentimentImpact;
                    newSentiment = Math.max(-100, Math.min(100, newSentiment));
                    this.gameState.sentiment[asset.type] = newSentiment;
                }
            });

            event.effect(this.gameState.assets);
        } else {
            // Decay sentiment if no event for this asset?
            // Actually decay happens every round regardless.
        }

        // Decay Sentiment
        (Object.keys(this.gameState.sentiment) as AssetType[]).forEach(type => {
            this.gameState.sentiment[type] *= 0.90; // 10% fade per round
        });

        // Timer for the round
        let timeLeft = ROUND_DURATION_MS / 1000;
        this.roundTimer = setInterval(() => {
            timeLeft--;
            this.gameState.timeRemaining = timeLeft;

            // Market Twist Trigger (Start of Round - 2s delay)
            if (timeLeft === (ROUND_DURATION_MS / 1000) - 2) {
                this.generateMarketTwist();
            }

            this.updatePrices();
            this.calculateRisk();
            this.broadcastState();

            if (timeLeft <= 0) {
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
            let volatility = asset.baseVolatility;

            // Scenario Effects
            if (this.gameState.activeScenario) {
                if (this.gameState.activeScenario.id === 'TECH_MOONSHOT' && asset.type === 'STOCK') {
                    volatility *= 1.5; // More movement
                    // Bias upwards?
                } else if (this.gameState.activeScenario.id === 'CRYPTO_WINTER' && asset.type === 'CRYPTO') {
                    volatility *= 2.0;
                }
            }

            let change = (Math.random() - 0.5) * 2 * volatility;

            // Apply Sentiment Drift
            const sentiment = this.gameState.sentiment[asset.type];
            // sentiment = +100 -> +5% drift
            // sentiment = -100 -> -5% drift
            const sentimentDrift = (sentiment / 100) * 0.05;
            change += sentimentDrift;

            // High sentiment = High volatility
            if (Math.abs(sentiment) > 50) {
                change += (Math.random() - 0.5) * 0.02; // Extra noise
            }

            // Apply Scenario Bias
            if (this.gameState.activeScenario) {
                if (this.gameState.activeScenario.id === 'TECH_MOONSHOT' && asset.type === 'STOCK') {
                    change += 0.005; // Upward bias
                } else if (this.gameState.activeScenario.id === 'CRYPTO_WINTER' && asset.type === 'CRYPTO') {
                    change -= 0.01; // Downward crash
                } else if (this.gameState.activeScenario.id === 'RATE_SHOCKWAVE' && asset.type === 'BOND') {
                    change += 0.003;
                } else if (this.gameState.activeScenario.id === 'GREEN_ENERGY_SURGE' && asset.type === 'ETF') {
                    change += 0.005;
                }
            }

            asset.currentPrice = asset.currentPrice * (1 + change);
            asset.history.push(asset.currentPrice);
            if (asset.history.length > 50) asset.history.shift();
        });

        this.gameState.players.forEach(player => {
            let holdingsValue = 0;
            player.holdings.forEach(h => {
                const asset = this.gameState.assets.find(a => a.id === h.assetId);
                if (asset) {
                    let price = asset.currentPrice;

                    // Strategy Effects
                    if (player.strategyId === 'HIGH_ROLLER' && (asset.type === 'STOCK' || asset.type === 'CRYPTO')) {
                        // "Upside on growth assets" - maybe just visual value boost? 
                        // Or actual value? Let's say they get a slight premium on valuation
                        // This is tricky because selling needs to match. 
                        // Let's keep it simple: No price modification here, handle in Sell or End Game?
                        // Or maybe High Roller just means they picked volatile assets.
                    }

                    holdingsValue += h.quantity * price;
                }
            });

            // Strategy: Diversifier (+5% return per unique asset - applied at end usually, but maybe show in total value?)
            // Let's keep totalValue as "Liquidation Value" for now.

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
        this.resetGame();
        this.startPreMatch();
    }

    private async generateMarketTwist() {
        console.log("Generating Market Twist (The Oracle)...");

        const applyTwist = (newsCard: any) => {
            this.gameState.activeEvent = {
                id: 'market-twist',
                title: newsCard.title,
                description: newsCard.explanation || `Breaking news impacting ${newsCard.affectedAssets.join(', ')}!`,
                affectedAssets: newsCard.affectedAssets,
                sentimentImpact: 0,
                duration: newsCard.durationRounds || 1,
                hint: "The Oracle has spoken.",
                emoji: "🔮"
            };
            console.log("Twist Applied:", this.gameState.activeEvent.title);

            // Apply immediate price impact
            this.gameState.assets.forEach(asset => {
                const impact = newsCard.sentimentImpact[asset.type] || 0;
                if (impact !== 0) {
                    const percentageChange = impact / 1000;
                    asset.currentPrice *= (1 + percentageChange);
                    asset.history.push(asset.currentPrice);
                }
            });

            this.broadcastState();
        };

        // 1. Gather Game State for The Oracle
        const oracleState = {
            round: this.gameState.currentRound,
            assets: this.gameState.assets.map(a => ({ type: a.type, price: a.currentPrice, volatility: a.baseVolatility })),
            sentiment: this.gameState.sentiment,
            players: this.gameState.players.map(p => ({
                id: p.id,
                totalValue: p.totalValue,
                riskScore: p.riskScore,
                holdings: p.holdings
            }))
        };

        if (!this.model) {
            console.warn("Gemini model not available. Using fallback twist.");
            const FALLBACK_TWISTS = [
                { title: "New respiratory virus detected in East Asia — panic buying of medicine expected.", affectedAssets: ["STOCK", "BOND"], sentimentImpact: { STOCK: 5, BOND: 5 }, explanation: "Fear drives volatility." },
                { title: "Unexpected election results shake global investors’ confidence.", affectedAssets: ["STOCK", "CRYPTO"], sentimentImpact: { STOCK: -5, CRYPTO: 5 }, explanation: "Risk-off sentiment." },
                { title: "Massive cyberattack shuts down major banks across Europe.", affectedAssets: ["STOCK", "BOND"], sentimentImpact: { STOCK: -5, BOND: 5 }, explanation: "Safety seeking." },
                { title: "China announces emergency economic stimulus package.", affectedAssets: ["STOCK", "ETF"], sentimentImpact: { STOCK: 5, ETF: 5 }, explanation: "Market excitement." },
                { title: "Major earthquake disrupts oil supply routes; energy prices surge.", affectedAssets: ["ETF"], sentimentImpact: { ETF: 8 }, explanation: "Commodity shock." },
                { title: "Historic breakthrough in Alzheimer’s treatment announced.", affectedAssets: ["STOCK", "ETF"], sentimentImpact: { STOCK: 5, ETF: 3 }, explanation: "Sector euphoria." },
                { title: "Global ransomware attack causes distrust in digital security.", affectedAssets: ["CRYPTO"], sentimentImpact: { CRYPTO: -10 }, explanation: "Fear in digital assets." },
                { title: "US and EU agree on new clean energy plan.", affectedAssets: ["ETF"], sentimentImpact: { ETF: 5 }, explanation: "Long-term momentum." },
                { title: "Crypto leader releases zero-fee lightning payments.", affectedAssets: ["CRYPTO"], sentimentImpact: { CRYPTO: 8 }, explanation: "Bullish adoption." },
                { title: "New financial regulation restricts margin trading.", affectedAssets: ["STOCK"], sentimentImpact: { STOCK: -5 }, explanation: "Bearish regulation." },
                { title: "Large pension funds begin exiting risky tech stocks.", affectedAssets: ["STOCK", "BOND"], sentimentImpact: { STOCK: -5, BOND: 3 }, explanation: "Institutional rotation." },
                { title: "Major crypto exchange introduces proof-of-reserve transparency.", affectedAssets: ["CRYPTO"], sentimentImpact: { CRYPTO: 5 }, explanation: "Confidence spike." },
                { title: "Corporate tax rates cut unexpectedly.", affectedAssets: ["STOCK"], sentimentImpact: { STOCK: 5 }, explanation: "Bullish policy." },
                { title: "Global recession fears intensify as unemployment spikes.", affectedAssets: ["STOCK", "BOND"], sentimentImpact: { STOCK: -8, BOND: 5 }, explanation: "Panic selling." },
                { title: "New carbon credits marketplace launches successfully.", affectedAssets: ["ETF"], sentimentImpact: { ETF: 4 }, explanation: "Sustained growth." },
                { title: "Bankruptcy of a leading AI startup shakes tech sector.", affectedAssets: ["STOCK"], sentimentImpact: { STOCK: -6 }, explanation: "Tech volatility." },
                { title: "High-profile influencer pumps meme coin — retail rush begins.", affectedAssets: ["CRYPTO"], sentimentImpact: { CRYPTO: 15 }, explanation: "Pump and dump risk." },
                { title: "War tensions ease after diplomatic agreement.", affectedAssets: ["STOCK", "CRYPTO", "ETF"], sentimentImpact: { STOCK: 5, CRYPTO: 5, ETF: 5, BOND: -2 }, explanation: "Relief rally." },
                { title: "Housing sector weakens — mortgage defaults increase.", affectedAssets: ["STOCK", "BOND"], sentimentImpact: { STOCK: -4, BOND: 3 }, explanation: "Sectoral stress." },
                { title: "Breakthrough in battery recycling technology.", affectedAssets: ["ETF"], sentimentImpact: { ETF: 5 }, explanation: "Green tech optimism." }
            ];
            const twist = FALLBACK_TWISTS[Math.floor(Math.random() * FALLBACK_TWISTS.length)];
            applyTwist(twist);
            return;
        }

        try {
            const prompt = `
            You behave like a dynamic market force called “The Oracle”.
            Your job during the match is to generate a realistic news event that influences the market in a way that:
            - challenges predictable or emotional trading patterns
            - rewards smart diversification, hedging and reaction to information
            
            You are not malicious and you do not “attack” the player, but you act like real market behaviour:
            sometimes reinforcing trends, sometimes reversing them, sometimes shaking weak hands.

            Current Game State:
            ${JSON.stringify(oracleState)}

            Per round, respond with a JSON:
            {
              "newsCard": {
                "title": "... realistic news headline ...",
                "affectedAssets": ["STOCK", "CRYPTO", "BOND", "ETF"],
                "sentimentImpact": {
                  "STOCK": +/-integer between -40 and +40,
                  "CRYPTO": ...,
                  "BOND": ...,
                  "ETF": ...
                },
                "durationRounds": 1 or 2,
                "explanation": "Why this news is realistic and how it impacts the market"
              }
            }

            You must NOT give the player hints during the match.
            You only observe and generate events that shape market behaviour.
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(jsonStr);

            if (data.newsCard) {
                applyTwist(data.newsCard);
            } else {
                console.warn("Invalid Oracle response format, using fallback.");
                const FALLBACK_TWISTS = [
                    { title: "Unexpected Market Rally!", affectedAssets: ["STOCK", "CRYPTO"], sentimentImpact: { STOCK: 5, CRYPTO: 5 }, explanation: "Random rally." }
                ];
                applyTwist(FALLBACK_TWISTS[0]);
            }

        } catch (error) {
            console.error("Failed to generate market twist:", error);
            console.warn("Using fallback twist due to API error.");

            const FALLBACK_TWISTS = [
                { title: "New respiratory virus detected in East Asia — panic buying of medicine expected.", affectedAssets: ["STOCK", "BOND"], sentimentImpact: { STOCK: 5, BOND: 5 }, explanation: "Fear drives volatility." },
                { title: "Unexpected election results shake global investors’ confidence.", affectedAssets: ["STOCK", "CRYPTO"], sentimentImpact: { STOCK: -5, CRYPTO: 5 }, explanation: "Risk-off sentiment." },
                { title: "Massive cyberattack shuts down major banks across Europe.", affectedAssets: ["STOCK", "BOND"], sentimentImpact: { STOCK: -5, BOND: 5 }, explanation: "Safety seeking." },
                { title: "China announces emergency economic stimulus package.", affectedAssets: ["STOCK", "ETF"], sentimentImpact: { STOCK: 5, ETF: 5 }, explanation: "Market excitement." },
                { title: "Major earthquake disrupts oil supply routes; energy prices surge.", affectedAssets: ["ETF"], sentimentImpact: { ETF: 8 }, explanation: "Commodity shock." },
                { title: "Historic breakthrough in Alzheimer’s treatment announced.", affectedAssets: ["STOCK", "ETF"], sentimentImpact: { STOCK: 5, ETF: 3 }, explanation: "Sector euphoria." },
                { title: "Global ransomware attack causes distrust in digital security.", affectedAssets: ["CRYPTO"], sentimentImpact: { CRYPTO: -10 }, explanation: "Fear in digital assets." },
                { title: "US and EU agree on new clean energy plan.", affectedAssets: ["ETF"], sentimentImpact: { ETF: 5 }, explanation: "Long-term momentum." },
                { title: "Crypto leader releases zero-fee lightning payments.", affectedAssets: ["CRYPTO"], sentimentImpact: { CRYPTO: 8 }, explanation: "Bullish adoption." },
                { title: "New financial regulation restricts margin trading.", affectedAssets: ["STOCK"], sentimentImpact: { STOCK: -5 }, explanation: "Bearish regulation." },
                { title: "Large pension funds begin exiting risky tech stocks.", affectedAssets: ["STOCK", "BOND"], sentimentImpact: { STOCK: -5, BOND: 3 }, explanation: "Institutional rotation." },
                { title: "Major crypto exchange introduces proof-of-reserve transparency.", affectedAssets: ["CRYPTO"], sentimentImpact: { CRYPTO: 5 }, explanation: "Confidence spike." },
                { title: "Corporate tax rates cut unexpectedly.", affectedAssets: ["STOCK"], sentimentImpact: { STOCK: 5 }, explanation: "Bullish policy." },
                { title: "Global recession fears intensify as unemployment spikes.", affectedAssets: ["STOCK", "BOND"], sentimentImpact: { STOCK: -8, BOND: 5 }, explanation: "Panic selling." },
                { title: "New carbon credits marketplace launches successfully.", affectedAssets: ["ETF"], sentimentImpact: { ETF: 4 }, explanation: "Sustained growth." },
                { title: "Bankruptcy of a leading AI startup shakes tech sector.", affectedAssets: ["STOCK"], sentimentImpact: { STOCK: -6 }, explanation: "Tech volatility." },
                { title: "High-profile influencer pumps meme coin — retail rush begins.", affectedAssets: ["CRYPTO"], sentimentImpact: { CRYPTO: 15 }, explanation: "Pump and dump risk." },
                { title: "War tensions ease after diplomatic agreement.", affectedAssets: ["STOCK", "CRYPTO", "ETF"], sentimentImpact: { STOCK: 5, CRYPTO: 5, ETF: 5, BOND: -2 }, explanation: "Relief rally." },
                { title: "Housing sector weakens — mortgage defaults increase.", affectedAssets: ["STOCK", "BOND"], sentimentImpact: { STOCK: -4, BOND: 3 }, explanation: "Sectoral stress." },
                { title: "Breakthrough in battery recycling technology.", affectedAssets: ["ETF"], sentimentImpact: { ETF: 5 }, explanation: "Green tech optimism." }
            ];
            const twist = FALLBACK_TWISTS[Math.floor(Math.random() * FALLBACK_TWISTS.length)];

            this.gameState.activeEvent = {
                id: 'market-twist',
                title: twist.title,
                description: twist.explanation,
                affectedAssets: twist.affectedAssets as AssetType[],
                sentimentImpact: 0,
                duration: 1,
                hint: "The Oracle has spoken.",
                emoji: "🔮"
            };

            // Apply immediate price impact for fallback
            this.gameState.assets.forEach(asset => {
                // @ts-ignore
                const impact = twist.sentimentImpact[asset.type] || 0;
                if (impact !== 0) {
                    const percentageChange = impact / 1000;
                    asset.currentPrice *= (1 + percentageChange);
                    asset.history.push(asset.currentPrice);
                }
            });

            this.broadcastState();
        }
    }
}
