const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let rooms = {};

function createDeck() {
    const suits = ['Oros', 'Copas', 'Espadas', 'Bastos'];
    let deck = [];
    for (let s of suits) {
        for (let v = 1; v <= 12; v++) {
            let score = (v === 12) ? -1 : v;
            let power = null;
            if (v === 8) power = 'lookSelf';
            if (v === 9) power = 'lookOther';
            if (v === 10) power = 'swapBlind';
            if (v === 11) power = 'swapLook';
            deck.push({ suit: s, value: v, score, power });
        }
    }
    deck.push({ suit: 'Comodín', value: 0, score: -1, power: null });
    deck.push({ suit: 'Comodín', value: 0, score: -1, power: null });
    return deck.sort(() => Math.random() - 0.5);
}

io.on('connection', (socket) => {
    socket.on('joinRoom', ({ username, room }) => {
        socket.join(room);
        if (!rooms[room]) {
            rooms[room] = { 
                players: [], 
                deck: createDeck(), 
                discard: [], 
                turn: 0, 
                gameStarted: false,
                lastRound: false,
                winner: null
            };
        }
        
        if (rooms[room].players.length < 6) {
            rooms[room].players.push({
                id: socket.id,
                username,
                cards: [],
                hasSaidCambio: false,
                revealedInitial: false
            });
        }

        io.to(room).emit('updatePlayers', rooms[room].players);
    });

    socket.on('startGame', (room) => {
        let game = rooms[room];
        if (game) {
            game.gameStarted = true;
            game.deck = createDeck();
            // Repartir 6 cartas a cada uno
            game.players.forEach(p => {
                p.cards = game.deck.splice(0, 6);
            });
            game.discard.push(game.deck.pop());
            io.to(room).emit('initGame', {
                players: game.players,
                discard: game.discard[game.discard.length - 1]
            });
        }
    });

    // Lógica de descarte fuera de turno
    socket.on('fastDiscard', ({ room, cardIndex }) => {
        let game = rooms[room];
        let player = game.players.find(p => p.id === socket.id);
        let playerCard = player.cards[cardIndex];
        let topDiscard = game.discard[game.discard.length - 1];

        if (playerCard && playerCard.value === topDiscard.value) {
            game.discard.push(player.cards.splice(cardIndex, 1)[0]);
            io.to(room).emit('syncGameState', { players: game.players, discard: game.discard[game.discard.length - 1] });
        } else {
            // Penalización: toma una carta y reemplaza la que intentó tirar
            let penaltyCard = game.deck.pop();
            player.cards[cardIndex] = penaltyCard;
            socket.emit('notification', '¡Error! Carta equivocada. Has recibido una penalización.');
            io.to(room).emit('syncGameState', { players: game.players, discard: game.discard[game.discard.length - 1] });
        }
    });

    // Canto de CAMBIO
    socket.on('callCambio', (room) => {
        let game = rooms[room];
        let player = game.players.find(p => p.id === socket.id);
        if (!game.lastRound) {
            game.lastRound = true;
            player.hasSaidCambio = true;
            io.to(room).emit('cambioCalled', player.username);
        }
    });
});

server.listen(process.env.PORT || 3000);