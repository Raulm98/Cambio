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
            rooms[room] = { players: [], deck: [], discard: [], turn: 0, gameStarted: false, lastRound: false };
        }
        if (rooms[room].players.length < 6) {
            rooms[room].players.push({ id: socket.id, username, cards: [], hasSaidCambio: false });
        }
        io.to(room).emit('updatePlayers', rooms[room].players);
    });

    socket.on('startGame', (room) => {
        let game = rooms[room];
        game.gameStarted = true;
        game.deck = createDeck();
        game.players.forEach(p => p.cards = game.deck.splice(0, 6));
        game.discard = [game.deck.pop()];
        io.to(room).emit('initGame', { players: game.players, discard: game.discard[game.discard.length - 1], turn: game.turn });
    });

    socket.on('drawCard', (room) => {
        let game = rooms[room];
        if (game.players[game.turn].id !== socket.id) return;
        
        if (game.deck.length === 0) {
            let topDiscard = game.discard.pop();
            game.deck = game.discard.sort(() => Math.random() - 0.5);
            game.discard = [topDiscard];
        }

        const card = game.deck.pop();
        socket.emit('cardDrawn', card);
    });

    socket.on('playTurn', ({ room, action, cardIndex, drawnCard }) => {
        let game = rooms[room];
        let player = game.players[game.turn];

        if (action === 'replace') {
            const oldCard = player.cards[cardIndex];
            player.cards[cardIndex] = drawnCard;
            game.discard.push(oldCard);
        } else {
            game.discard.push(drawnCard);
        }

        // Pasar turno
        game.turn = (game.turn + 1) % game.players.length;
        io.to(room).emit('syncGameState', { players: game.players, discard: game.discard[game.discard.length - 1], turn: game.turn });
    });

    socket.on('fastDiscard', ({ room, cardIndex }) => {
        let game = rooms[room];
        let player = game.players.find(p => p.id === socket.id);
        let card = player.cards[cardIndex];
        let top = game.discard[game.discard.length - 1];

        if (card.value === top.value) {
            game.discard.push(player.cards.splice(cardIndex, 1)[0]);
        } else {
            player.cards[cardIndex] = game.deck.pop(); // Penalización
        }
        io.to(room).emit('syncGameState', { players: game.players, discard: game.discard[game.discard.length - 1], turn: game.turn });
    });

    socket.on('swapCards', ({ room, myIndex, targetId, targetIndex }) => {
        let game = rooms[room];
        let me = game.players.find(p => p.id === socket.id);
        let target = game.players.find(p => p.id === targetId);
        
        let temp = me.cards[myIndex];
        me.cards[myIndex] = target.cards[targetIndex];
        target.cards[targetIndex] = temp;

        io.to(room).emit('syncGameState', { players: game.players, discard: game.discard[game.discard.length - 1], turn: game.turn });
    });

    socket.on('callCambio', (room) => {
        let game = rooms[room];
        if (!game.lastRound) {
            game.lastRound = true;
            io.to(room).emit('cambioCalled', socket.id);
        }
    });
});

server.listen(process.env.PORT || 3000);