import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { GameState, ClientToServerEvents, ServerToClientEvents, GameResult, AvatarId, StrategyId } from '@bvb/shared';

interface GameStore {
    socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
    gameState: GameState | null;
    gameResults: GameResult[] | null;
    isConnected: boolean;
    playerName: string;

    connect: (name: string) => void;
    joinGame: () => void;
    selectAvatar: (avatarId: AvatarId) => void;
    selectStrategy: (strategyId: StrategyId) => void;
    buyAsset: (assetId: string, amount: number) => void;
    sellAsset: (assetId: string, amount: number) => void;
    usePowerUp: (powerUpId: string) => void;
    playAgain: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
    socket: null,
    gameState: null,
    gameResults: null,
    isConnected: false,
    playerName: '',

    connect: (name: string) => {
        const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io('http://localhost:3000');

        socket.on('connect', () => {
            set({ isConnected: true, socket });
            socket.emit('joinGame', name);
        });

        socket.on('disconnect', () => {
            set({ isConnected: false, socket: null });
        });

        socket.on('gameState', (state: GameState) => {
            set({ gameState: state });
        });

        socket.on('gameOver', (results: GameResult[]) => {
            set({ gameResults: results });
        });

        set({ playerName: name });
    },

    joinGame: () => {
        // Handled in connect for now
    },

    selectAvatar: (avatarId: AvatarId) => {
        const { socket } = get();
        if (socket) {
            socket.emit('selectAvatar', avatarId);
        }
    },

    selectStrategy: (strategyId: StrategyId) => {
        const { socket } = get();
        if (socket) {
            socket.emit('selectStrategy', strategyId);
        }
    },

    buyAsset: (assetId: string, amount: number) => {
        const { socket } = get();
        if (socket) {
            socket.emit('buyAsset', assetId, amount);
        }
    },

    sellAsset: (assetId: string, amount: number) => {
        const { socket } = get();
        if (socket) {
            socket.emit('sellAsset', assetId, amount);
        }
    },

    usePowerUp: (powerUpId: string) => {
        const { socket } = get();
        if (socket) {
            socket.emit('usePowerUp', powerUpId);
        }
    },

    playAgain: () => {
        const { socket } = get();
        if (socket) {
            socket.emit('playAgain');
            set({ gameResults: null }); // Clear local results immediately
        }
    }
}));
