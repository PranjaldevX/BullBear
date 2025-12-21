# ⚙️ Setup & Installation

## 🔧 Prerequisites
- Node.js (v16+ recommended)
- npm or yarn
- Google Gemini API Key (for AI-powered news + analytics)

---

## 1️⃣ Clone the Repository
```bash
git clone <repo-url>
cd BvB

2️⃣ Install Dependencies

# Install root dependencies
npm install

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install

3️⃣ Configure Environment Variables

Create a .env file inside /server:

GEMINI_API_KEY=your_google_gemini_api_key_here
PORT=3000

4️⃣ Start the Game

You must run server and client separately.

Terminal 1 (Server)
cd server
npm run dev

Terminal 2 (Client)
cd client
npm run dev


✔ URLs
Service	URL
Client (Game UI)	http://localhost:5173

Server (Backend + WebSockets)	http://localhost:3000