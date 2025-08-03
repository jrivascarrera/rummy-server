// --- Servidor para el Juego de Rummy Multijugador ---
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();

// Configuración de CORS para permitir la conexión desde tu sitio web
const corsOptions = {
  origin: [
      "https://javierrivas.com.mx", 
      "https://www.javierrivas.com.mx", // Añadido para incluir 'www'
      "http://localhost:5500" // Para desarrollo local
    ],
  methods: ["GET", "POST"]
};

app.use(cors(corsOptions));
const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });

const games = {};

// --- Lógica del Juego (Funciones de utilidad) ---
function createDeck() {
    const colors = ['red', 'blue', 'black', 'yellow'];
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    let deck = [];
    let id = 0;
    for (let i = 0; i < 2; i++) {
        for (const color of colors) {
            for (const value of values) {
                deck.push({ id: `tile-${id++}`, value, color });
            }
        }
    }
    deck.push({ id: `tile-${id++}`, value: 0, color: 'joker' });
    deck.push({ id: `tile-${id++}`, value: 0, color: 'joker' });
    return deck;
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
    let code = '';
    do {
        code = '';
        for (let i = 0; i < 5; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (games[code]);
    return code;
}

function leaveRoom(socket) {
    for (const roomCode in games) {
        const room = games[roomCode];
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            room.players.splice(playerIndex, 1);
            socket.leave(roomCode);
            console.log(`Jugador ${socket.id} ha salido de la sala ${roomCode}`);
            if (room.players.length === 0) {
                delete games[roomCode];
                console.log(`Sala ${roomCode} eliminada por estar vacía.`);
            } else {
                io.to(roomCode).emit('gameUpdate', room);
            }
            break;
        }
    }
}

io.on('connection', (socket) => {
    console.log(`Un usuario se ha conectado: ${socket.id}`);

    socket.on('createGame', (playerName) => {
        const roomCode = generateRoomCode();
        socket.join(roomCode);
        games[roomCode] = {
            gameId: roomCode,
            status: 'waiting',
            players: [{
                id: socket.id,
                name: playerName || 'Jugador 1',
                score: 0,
                hand: []
            }],
            drawPile: [],
            discardPile: [],
            mainBoard: [],
            currentPlayerIndex: 0,
        };
        console.log(`Juego creado con código: ${roomCode} por ${playerName}`);
        io.to(roomCode).emit('gameUpdate', games[roomCode]);
    });

    socket.on('joinGame', ({ roomCode, playerName }) => {
        const room = games[roomCode];
        if (room && room.players.length < 4) {
            socket.join(roomCode);
            room.players.push({
                id: socket.id,
                name: playerName || `Jugador ${room.players.length + 1}`,
                score: 0,
                hand: []
            });
            console.log(`${playerName} se unió al juego ${roomCode}`);
            io.to(roomCode).emit('gameUpdate', room);
        } else {
            socket.emit('error', 'La sala no existe o está llena.');
        }
    });
    
    socket.on('startGame', (roomCode) => {
        const room = games[roomCode];
        if (room && room.players[0].id === socket.id) {
            console.log(`Empezando juego en la sala ${roomCode}`);
            room.status = 'in-progress';
            const deck = shuffle(createDeck());
            room.players.forEach(player => {
                player.hand = deck.splice(0, 14);
            });
            room.discardPile.push(deck.pop());
            room.drawPile = deck;
            io.to(roomCode).emit('gameStarted', room);
        }
    });

    socket.on('leaveGame', () => {
        leaveRoom(socket);
    });

    socket.on('disconnect', () => {
        console.log(`Un usuario se ha desconectado: ${socket.id}`);
        leaveRoom(socket);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor de Rummy escuchando en el puerto ${PORT}`);
});
