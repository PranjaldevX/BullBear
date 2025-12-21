# 🤖 AI System — The Oracle

The game features an in-match AI called **The Oracle**, powered by Google Gemini.

---

## Purpose of The Oracle
- Generates **realistic economic news** every round
- Manipulates **sentiment and volatility**
- Challenges player decisions
- Makes every match unpredictable and educational

---

## Round-by-Round Flow
1. Server sends game state snapshot to Gemini
2. Gemini returns a **news card**:
   ```json
   {
     "title": "...",
     "affectedAssets": ["STOCKS"],
     "sentimentImpact": { "STOCKS": -20 },
     "durationRounds": 1
   }
