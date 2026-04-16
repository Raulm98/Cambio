const socket = io();
let myRoom = "";
let myName = "";
let myCards = [];
let isMyTurn = false;
let canViewInitial = true;

function joinGame() {
    myName = document.getElementById('username').value;
    myRoom = document.getElementById('room').value;
    if (myName && myRoom) {
        socket.emit('joinRoom', { username: myName, room: myRoom });
        document.getElementById('lobby').classList.add('d-none');
        document.getElementById('game-table').classList.remove('d-none');
    }
}

socket.on('updatePlayers', (players) => {
    const container = document.getElementById('opponents-container');
    container.innerHTML = players.map(p => 
        `<div class="text-white text-center">
            <div class="badge bg-primary">${p.username}</div>
            <div class="d-flex gap-1">${" <div class='card-sprite back' style='width:40px; height:60px'></div>".repeat(p.cards.length)}</div>
        </div>`
    ).join('');
    
    // Si eres el primero, podrías tener un botón de "Iniciar Juego"
    if (players.length >= 2 && !document.getElementById('start-btn')) {
        const btn = document.createElement('button');
        btn.id = 'start-btn';
        btn.className = "btn btn-light mt-3";
        btn.innerText = "Iniciar Partida";
        btn.onclick = () => socket.emit('startGame', myRoom);
        document.querySelector('.status-bar').appendChild(btn);
    }
});

socket.on('initGame', (data) => {
    const me = data.players.find(p => p.id === socket.id);
    myCards = me.cards;
    renderMyCards(true); // true significa que podemos revelar una
    updateDiscard(data.discard);
    if(document.getElementById('start-btn')) document.getElementById('start-btn').remove();
});

function renderMyCards(initialPhase = false) {
    const container = document.getElementById('my-cards');
    container.innerHTML = '';
    myCards.forEach((card, index) => {
        const cardEl = document.createElement('div');
        cardEl.className = 'card-sprite back';
        cardEl.onclick = () => handleCardClick(index, initialPhase);
        container.appendChild(cardEl);
    });
}

function handleCardClick(index, initialPhase) {
    if (initialPhase && canViewInitial) {
        // Revelar solo una carta al inicio por 3 segundos
        const card = myCards[index];
        const el = document.querySelectorAll('#my-cards .card-sprite')[index];
        el.innerText = `${card.value} ${card.suit}`;
        el.classList.remove('back');
        canViewInitial = false;
        setTimeout(() => {
            el.innerText = '';
            el.classList.add('back');
        }, 3000);
    } else {
        // Intento de descarte rápido (fuera de turno)
        socket.emit('fastDiscard', { room: myRoom, cardIndex: index });
    }
}

function updateDiscard(card) {
    const discardEl = document.getElementById('discard-pile');
    discardEl.innerText = `${card.value} ${card.suit}`;
    discardEl.style.color = (card.suit === 'Oros' || card.suit === 'Copas') ? 'red' : 'black';
}

function callCambio() {
    socket.emit('callCambio', myRoom);
}

socket.on('cambioCalled', (name) => {
    alert(`¡${name} ha dicho CAMBIO! Última ronda.`);
});

socket.on('syncGameState', (data) => {
    const me = data.players.find(p => p.id === socket.id);
    if(me) {
        myCards = me.cards;
        renderMyCards();
    }
    updateDiscard(data.discard);
});