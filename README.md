# 🐂 Bull vs Bear Royale 🐻

**Bull vs Bear Royale** is a high-octane, multiplayer financial trading simulation game where players compete to become the ultimate tycoon. Set in a volatile, fast-paced market environment, players must analyze trends, manage risk, and outsmart their opponents—and the market itself.

![Game Banner](https://via.placeholder.com/1200x400.png?text=Bull+vs+Bear+Royale)

## 🚀 Key Features

*   **Real-Time Multiplayer**: Compete against friends or strangers in live trading sessions powered by **Socket.IO**.
*   **Dynamic Market Engine**: Trade across 4 asset classes—**Stocks, Crypto, Bonds, and ETFs**—each with unique volatility profiles and behaviors.
*   **"The Oracle" AI 🔮**: Powered by **Google Gemini**, the game features a dynamic AI narrator that generates realistic, unpredictable market news events ("Market Twists") that shake up prices based on real-world economic logic.
*   **Strategic Gameplay**:
    *   **Avatars**: Choose a persona that fits your style.
    *   **Strategies**: Select a starting perk (e.g., *High Roller* for risk-takers, *Safety First* for conservative players).
    *   **Power-Ups**: Use "Market Freeze" or "Future Glimpse" to gain a tactical edge.
*   **Immersive UI**: A sleek, dark-mode interface with real-time charts (Recharts), particle effects, and responsive animations.
*   **Personalized Feedback**: At the end of every match, the AI Coach analyzes your specific trades and provides **brutally honest feedback** and **Learning Cards** with deep-dive educational content.

## 🛠️ Tech Stack

### Frontend (`/client`)
*   **Framework**: React (Vite)
*   **Language**: TypeScript
*   **Styling**: Tailwind CSS (Custom "Neon" Theme)
*   **State Management**: Zustand
*   **Visualization**: Recharts
*   **Animations**: CSS Keyframes & Tailwind Utilities

### Backend (`/server`)
*   **Runtime**: Node.js
*   **Framework**: Express
*   **Real-Time**: Socket.IO
*   **AI Integration**: Google Generative AI SDK (Gemini Pro)
*   **Language**: TypeScript

### Shared (`/shared`)
*   Shared TypeScript interfaces and types for type-safe communication between client and server.

## 📦 Installation & Setup

### Prerequisites
*   Node.js (v16+)
*   npm or yarn
*   A Google Gemini API Key (for AI features)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd BvB
```

### 2. Install Dependencies
Install dependencies for the root, server, and client:

```bash
# Root
npm install

# Server
cd server
npm install

# Client
cd ../client
npm install
```

### 3. Environment Configuration
Create a `.env` file in the `server` directory:

```bash
# server/.env
GEMINI_API_KEY=your_google_gemini_api_key_here
PORT=3000
```

### 4. Run the Application
You need to run both the server and the client concurrently.

**Option A: Separate Terminals**
Terminal 1 (Server):
```bash
cd server
npm run dev
```

Terminal 2 (Client):
```bash
cd client
npm run dev
```

**Option B: Root Script (if configured)**
```bash
# From root
npm run dev
```

The client will typically run at `http://localhost:5173` and the server at `http://localhost:3000`.

## 🎮 How to Play

1.  **Enter the Market**: Open the game in your browser.
2.  **Lobby**: Join the lobby. Wait for other players or start solo.
3.  **Pre-Match**:
    *   **Select Avatar**: Choose your look.
    *   **Select Strategy**: Pick a bonus (e.g., *Diversifier* gives a bonus for holding multiple asset types).
4.  **The Game (5 Rounds)**:
    *   **Buy/Sell**: Trade assets to maximize your Total Value.
    *   **Watch the News**: "The Oracle" will drop news events. React quickly!
    *   **Manage Risk**: Keep an eye on your Risk Meter. High risk can lead to big rewards or total ruin.
5.  **Game Over**: See the leaderboard, get your AI-generated performance report, and learn from your mistakes with the "Learn More" cards.

## 📂 Project Structure

```
BvB/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # UI Components (Dashboard, EventCard, etc.)
│   │   ├── store/          # Zustand State Store
│   │   └── ...
├── server/                 # Node.js Backend
│   ├── src/
│   │   ├── GameManager.ts  # Core Game Logic & State Machine
│   │   ├── index.ts        # Server Entry Point & Socket Setup
│   │   └── data/           # Static Game Data (Assets, Events)
├── shared/                 # Shared Types (GameState, PlayerState)
└── README.md               # You are here
```

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## 📄 License

MIT License.
