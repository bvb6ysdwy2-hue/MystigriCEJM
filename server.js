const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// ============================
// DONNÉES CARTES CEJM
// ============================
const FAMILIES = [
  {
    id: 'travail',
    name: 'Droit du Travail',
    color: '#FFB3C6',
    colorDark: '#FF6B9D',
    emoji: '👷',
    cards: [
      { title: "CDI ou rien !", def: "Contrat à Durée Indéterminée : forme normale et générale de la relation de travail. Pas de terme fixé à l'avance." },
      { title: "Le lien de subordination… ouille", def: "Lien de subordination juridique : critère du contrat de travail — le salarié exécute sous l'autorité, la direction et le contrôle de l'employeur." },
    ]
  },
  {
    id: 'contrats',
    name: 'Droit des Contrats',
    color: '#C9B8FF',
    colorDark: '#8B6FFF',
    emoji: '📝',
    cards: [
      { title: "T'as signé, t'es cuit !", def: "Force obligatoire du contrat : le contrat lie les parties comme la loi entre elles — art. 1103 du Code civil." },
      { title: "Je savais pas, chef !", def: "Vice du consentement : erreur, dol ou violence rendant le consentement non valable → nullité relative du contrat." },
    ]
  },
  {
    id: 'licenciement',
    name: 'Licenciement',
    color: '#FFD4A8',
    colorDark: '#FF8C42',
    emoji: '📦',
    cards: [
      { title: "T'es viré, t'as pas honte !", def: "Licenciement pour faute grave : rupture immédiate sans préavis ni indemnité — faute rendant impossible le maintien dans l'entreprise." },
      { title: "Lettre recom' de la mort", def: "Notification du licenciement : lettre recommandée avec AR, obligatoirement motivée, envoyée après entretien préalable." },
    ]
  },
  {
    id: 'syndicat',
    name: 'Droit Syndical',
    color: '#B8F0E0',
    colorDark: '#3ECDA0',
    emoji: '✊',
    cards: [
      { title: "CSE : Comité Super Épuisant", def: "Comité Social et Économique : instance représentative du personnel, obligatoire dès 11 salariés, fusionne les anciennes instances." },
      { title: "Grève : j'y vais !", def: "Droit de grève : cessation collective, concertée et totale du travail pour appuyer des revendications professionnelles." },
    ]
  },
  {
    id: 'societes',
    name: 'Droit des Sociétés',
    color: '#FFF3B0',
    colorDark: '#F0C020',
    emoji: '🏢',
    cards: [
      { title: "SARL : S'Amuse Rarement Librement", def: "SARL : Société À Responsabilité Limitée — capital minimum 1€, responsabilité limitée aux apports, dirigée par un gérant." },
      { title: "SAS : Super Agile S'il te plaît", def: "SAS : Société par Actions Simplifiée — grande liberté statutaire, dirigée par un président, 1 associé minimum." },
    ]
  },
  {
    id: 'responsabilite',
    name: 'Responsabilité Civile',
    color: '#FFE4B8',
    colorDark: '#FF9F43',
    emoji: '⚖️',
    cards: [
      { title: "C'est pas ma faute !", def: "Force majeure : événement imprévisible, irrésistible et extérieur exonérant le débiteur de toute responsabilité contractuelle." },
      { title: "Tu peux pleurer maintenant", def: "Préjudice réparable : dommage certain, direct et personnel — condition indispensable pour engager la responsabilité civile." },
    ]
  },
  {
    id: 'numerique',
    name: 'Numérique & RGPD',
    color: '#B8E8FF',
    colorDark: '#3EAACD',
    emoji: '💻',
    cards: [
      { title: "RGPD : le cauchemar des DRH", def: "RGPD : Règlement Général sur la Protection des Données — encadre la collecte et le traitement des données personnelles en UE." },
      { title: "Télétravail : la cage en pyjama", def: "Télétravail : mode d'organisation permettant au salarié d'exécuter sa prestation hors des locaux de l'employeur via les NTIC." },
    ]
  },
];

const POISON_CARD = {
  id: 'poison',
  title: "CONVOQUÉ·E AUX PRUD'HOMMES 😈",
  def: "Conseil de Prud'hommes : juridiction paritaire compétente pour régler les litiges individuels nés entre employeurs et salariés.",
  family: 'MISTIGRI ☠️',
  familyId: 'poison',
  color: '#FF8080',
  colorDark: '#CC0000',
  emoji: '😈',
  isPoison: true,
};

// ============================
// UTILS
// ============================
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck() {
  let deck = [];
  FAMILIES.forEach(f => {
    f.cards.forEach((c, ci) => {
      deck.push({
        ...c,
        id: `${f.id}_${ci}_${Math.random()}`,
        family: f.name,
        familyId: f.id,
        color: f.color,
        colorDark: f.colorDark,
        emoji: f.emoji,
        isPoison: false,
      });
    });
  });
  deck.push({ ...POISON_CARD, id: 'poison_' + Math.random() });
  return shuffle(deck);
}

function removePairs(hand) {
  const removed = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < hand.length; i++) {
      if (hand[i].isPoison) continue;
      for (let j = i + 1; j < hand.length; j++) {
        if (hand[j].isPoison) continue;
        if (hand[i].familyId === hand[j].familyId) {
          removed.push(hand[i].family);
          hand.splice(j, 1);
          hand.splice(i, 1);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  return { hand, removed };
}

// ============================
// GESTION DES ROOMS
// ============================
const rooms = {};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function getGameState(room, forPlayer) {
  const opp = forPlayer === 0 ? 1 : 0;
  return {
    myHand: room.hands[forPlayer],
    oppHandCount: room.hands[opp].length,
    myPairs: room.pairs[forPlayer],
    oppPairs: room.pairs[opp],
    currentPlayer: room.currentPlayer,
    players: room.players,
    phase: room.phase,
    lastAction: room.lastAction,
  };
}

// ============================
// SOCKET.IO
// ============================
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  // Créer une room
  socket.on('create_room', ({ playerName }) => {
    const code = generateRoomCode();
    rooms[code] = {
      code,
      sockets: [socket.id, null],
      players: [playerName, null],
      hands: [[], []],
      pairs: [[], []],
      currentPlayer: 0,
      phase: 'waiting',
      lastAction: null,
    };
    socket.join(code);
    socket.data.room = code;
    socket.data.playerIdx = 0;
    socket.emit('room_created', { code, playerIdx: 0 });
    console.log(`Room created: ${code} by ${playerName}`);
  });

  // Rejoindre une room
  socket.on('join_room', ({ code, playerName }) => {
    const room = rooms[code];
    if (!room) { socket.emit('error', 'Room introuvable !'); return; }
    if (room.sockets[1] !== null) { socket.emit('error', 'Room déjà complète !'); return; }

    room.sockets[1] = socket.id;
    room.players[1] = playerName;
    socket.join(code);
    socket.data.room = code;
    socket.data.playerIdx = 1;

    socket.emit('room_joined', { code, playerIdx: 1, players: room.players });
    io.to(room.sockets[0]).emit('opponent_joined', { players: room.players });

    // Démarrer le jeu
    startGame(code);
  });

  // Piocher dans la main adverse
  socket.on('pick_card', ({ cardId }) => {
    const code = socket.data.room;
    const room = rooms[code];
    if (!room) return;

    const playerIdx = socket.data.playerIdx;
    if (room.currentPlayer !== playerIdx) {
      socket.emit('error', "C'est pas ton tour !");
      return;
    }

    const oppIdx = 1 - playerIdx;
    const cardIdx = room.hands[oppIdx].findIndex(c => c.id === cardId);
    if (cardIdx === -1) return;

    const card = room.hands[oppIdx][cardIdx];
    room.hands[oppIdx].splice(cardIdx, 1);
    room.hands[playerIdx].push(card);

    // Vérif paires
    const { hand: newHand, removed } = removePairs(room.hands[playerIdx]);
    room.hands[playerIdx] = newHand;
    if (removed.length > 0) {
      room.pairs[playerIdx].push(...removed);
    }

    room.lastAction = {
      type: 'pick',
      player: playerIdx,
      cardTitle: card.title,
      pairsFound: removed,
    };

    // Vérif fin
    const gameOver = checkGameOver(room);
    if (gameOver) {
      room.phase = 'end';
      room.lastAction.gameOver = gameOver;
      sendGameState(room);
      return;
    }

    // Changer de tour
    room.currentPlayer = oppIdx;
    sendGameState(room);
  });

  // Piocher par index (depuis le front)
  socket.on('pick_card_by_index', ({ index }) => {
    const code = socket.data.room;
    const room = rooms[code];
    if (!room) return;
    const playerIdx = socket.data.playerIdx;
    if (room.currentPlayer !== playerIdx) return;
    const oppIdx = 1 - playerIdx;
    if (index < 0 || index >= room.hands[oppIdx].length) return;

    const card = room.hands[oppIdx][index];
    room.hands[oppIdx].splice(index, 1);
    room.hands[playerIdx].push(card);

    const { hand: newHand, removed } = removePairs(room.hands[playerIdx]);
    room.hands[playerIdx] = newHand;
    if (removed.length > 0) room.pairs[playerIdx].push(...removed);

    room.lastAction = {
      type: 'pick',
      player: playerIdx,
      cardTitle: card.title,
      pairsFound: removed,
    };

    const gameOver = checkGameOver(room);
    if (gameOver) {
      room.phase = 'end';
      room.lastAction.gameOver = gameOver;
      sendGameState(room);
      return;
    }
    room.currentPlayer = oppIdx;
    sendGameState(room);
  });

  socket.on('disconnect', () => {
    const code = socket.data.room;
    if (code && rooms[code]) {
      io.to(code).emit('opponent_left');
      delete rooms[code];
    }
  });
});

function startGame(code) {
  const room = rooms[code];
  const deck = buildDeck();
  const half = Math.floor(deck.length / 2);
  room.hands[0] = deck.slice(0, half);
  room.hands[1] = deck.slice(half);

  // Retirer paires initiales
  const r0 = removePairs(room.hands[0]);
  room.hands[0] = r0.hand;
  room.pairs[0] = r0.removed;

  const r1 = removePairs(room.hands[1]);
  room.hands[1] = r1.hand;
  room.pairs[1] = r1.removed;

  room.currentPlayer = 0;
  room.phase = 'playing';

  sendGameState(room);
}

function checkGameOver(room) {
  const p0Poison = room.hands[0].some(c => c.isPoison);
  const p1Poison = room.hands[1].some(c => c.isPoison);
  const p0Empty = room.hands[0].length === 0;
  const p1Empty = room.hands[1].length === 0;

  if (p0Empty && p1Empty) return { loser: -1 };
  if (p0Empty && p1Poison) return { loser: 1 };
  if (p1Empty && p0Poison) return { loser: 0 };
  if (p0Empty) return { loser: 1 };
  if (p1Empty) return { loser: 0 };
  if (p0Poison && p1Empty) return { loser: 0 };
  if (p1Poison && p0Empty) return { loser: 1 };

  return null;
}

function sendGameState(room) {
  room.sockets.forEach((sid, idx) => {
    if (sid) {
      io.to(sid).emit('game_state', getGameState(room, idx));
    }
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🎮 Mistigri CEJM serveur lancé sur le port ${PORT}`));
