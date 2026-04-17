const socket = io();
let myRoom = "", myName = "", myId = "";
let myCards = [];
let drawnCard = null;
let currentTurn = 0;
let isInitialPhase = true;
let powerActive = null;
let swapStep = 0; // 0: nada, 1: seleccionada mía, 2: seleccionada otra
let mySwapIndex = -1;

function joinGame() {
    myName = document.getElementById('username').value;
    myRoom = document.getElementById('room').value;
    if (myName && myRoom) {
        socket.emit('joinRoom', { username: myName, room: myRoom });
        document.getElementById('lobby').classList.add('d-none');
        document.getElementById('game-table').classList.remove('d-none');
        myId = socket.id;
    }
}

socket.on('updatePlayers', (players) => {
    const container = document.getElementById('opponents-container');
    container.innerHTML = players.filter(p => p.id !== socket.id).map(p => `
        <div class="opponent-box text-center text-white p-2">
            <div class="badge bg-primary">${p.username}</div>
            <div class="d-flex gap-1 mt-1">
                ${p.cards.map((c, i) => `<div class="card-sprite back mini" onclick="handleOpponentCardClick('${p.id}', ${i})"></div>`).join('')}
            </div>
        </div>
    `).join('');

    if (players.length >= 2 && !document.getElementById('start-btn') && players[0].id === socket.id) {
        const btn = document.createElement('button');
        btn.id = 'start-btn'; btn.className = "btn btn-light ms-3"; btn.innerText = "Iniciar Partida";
        btn.onclick = () => socket.emit('startGame', myRoom);
        document.querySelector('.status-bar').appendChild(btn);
    }
});

socket.on('initGame', (data) => {
    updateState(data);
    isInitialPhase = true;
    alert("Fase inicial: Haz clic en UNA carta para verla 3 segundos.");
});

socket.on('syncGameState', (data) => {
    updateState(data);
    closePowerModal();
});

function updateState(data) {
    const me = data.players.find(p => p.id === socket.id);
    if (me) myCards = me.cards;
    currentTurn = data.turn;
    
    document.getElementById('player-info').innerText = `Jugador: ${myName}`;
    document.getElementById('turn-indicator').innerText = (data.players[currentTurn].id === socket.id) ? "TU TURNO" : `Turno de: ${data.players[currentTurn].username}`;
    document.getElementById('turn-indicator').className = (data.players[currentTurn].id === socket.id) ? "badge bg-warning text-dark my-turn" : "badge bg-secondary";

    updateDiscard(data.discard);
    renderMyCards();
}

function renderMyCards() {
    const container = document.getElementById('my-cards');
    container.innerHTML = myCards.map((c, i) => `
        <div class="card-sprite back ${mySwapIndex === i ? 'selected-card' : ''}" onclick="handleMyCardClick(${i})"></div>
    `).join('');
}

function handleMyCardClick(index) {
    // 1. Fase Inicial
    if (isInitialPhase) {
        revealCardTemporarily(index, 3000);
        isInitialPhase = false;
        return;
    }

    // 2. Usando poder de intercambio (10 o 11)
    if (powerActive === 'swapBlind' || powerActive === 'swapLook') {
        mySwapIndex = index;
        renderMyCards();
        alert("Ahora selecciona la carta del oponente.");
        return;
    }

    // 3. Reemplazar carta en tu turno
    if (drawnCard && currentTurn === getMyIndexInServer()) {
        socket.emit('playTurn', { room: myRoom, action: 'replace', cardIndex: index, drawnCard: drawnCard });
        drawnCard = null;
        return;
    }

    // 4. Descarte rápido fuera de turno
    socket.emit('fastDiscard', { room: myRoom, cardIndex: index });
}

function handleOpponentCardClick(targetId, targetIndex) {
    if (powerActive === 'lookOther') {
        // Lógica para ver carta de otro (Poder 9)
        // El servidor debería enviarnos la info de esa carta específica
        alert("Poder 9: Solo implementado visualmente. Aquí verías la carta.");
        closePowerModal();
    }
    
    if ((powerActive === 'swapBlind' || powerActive === 'swapLook') && mySwapIndex !== -1) {
        socket.emit('swapCards', { room: myRoom, myIndex: mySwapIndex, targetId, targetIndex });
        mySwapIndex = -1;
        closePowerModal();
    }
}

function drawFromDeck() {
    if (currentTurn === getMyIndexInServer() && !drawnCard) {
        socket.emit('drawCard', myRoom);
    }
}

socket.on('cardDrawn', (card) => {
    drawnCard = card;
    const discardEl = document.getElementById('discard-pile');
    discardEl.innerHTML = `<div class="text-primary small">Llevas:</div>${card.value} ${card.suit}`;
    
    if (card.power) {
        activatePower(card);
    }
});

function activatePower(card) {
    powerActive = card.power;
    document.getElementById('power-modal').classList.remove('d-none');
    document.getElementById('power-title').innerText = `PODER ACTIVADO: ${card.power}`;
    
    // Iniciar timer 20s
    let sec = 20;
    const timer = setInterval(() => {
        sec--;
        document.getElementById('power-timer').innerText = sec;
        if (sec <= 0 || !powerActive) {
            clearInterval(timer);
            closePowerModal();
        }
    }, 1000);
}

function discardAction() {
    if (drawnCard) {
        socket.emit('playTurn', { room: myRoom, action: 'discard', drawnCard: drawnCard });
        drawnCard = null;
    }
}

function revealCardTemporarily(index, time) {
    const card = myCards[index];
    const el = document.querySelectorAll('#my-cards .card-sprite')[index];
    el.innerText = `${card.value} ${card.suit}`;
    el.classList.remove('back');
    setTimeout(() => {
        el.innerText = '';
        el.classList.add('back');
    }, time);
}

function getMyIndexInServer() {
    // Esta es una simplificación, lo ideal es que el servidor diga de quién es el turno por ID
    return currentTurn; 
}

function updateDiscard(card) {
    const discardEl = document.getElementById('discard-pile');
    discardEl.innerText = `${card.value} ${card.suit}`;
    discardEl.className = `card-sprite suit-${card.suit.toLowerCase()}`;
}

function callCambio() {
    socket.emit('callCambio', myRoom);
}

function closePowerModal() {
    powerActive = null;
    document.getElementById('power-modal').classList.add('d-none');
}