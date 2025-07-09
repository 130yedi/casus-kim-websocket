const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Sunucu portu
const PORT = process.env.PORT || 8080;

// SSL sertifikası yolları (sunucuda güncellenecek)
const SSL_OPTIONS = {
  cert: fs.readFileSync('/etc/letsencrypt/live/casuskim.com.tr/fullchain.pem'),
  key: fs.readFileSync('/etc/letsencrypt/live/casuskim.com.tr/privkey.pem')
};

// HTTPS sunucusu oluştur
const server = https.createServer(SSL_OPTIONS);

// WebSocket sunucusunu HTTPS sunucusuna bağla
const wss = new WebSocket.Server({ server });

// Oyun odaları ve oyuncular
const gameRooms = new Map();
const playerConnections = new Map(); // playerId -> WebSocket connection

// Oyun durumları
const GameState = {
  WAITING: 'waiting',
  STARTING: 'starting',
  WORD_SHOWN: 'wordShown',
  DISCUSSION: 'discussion',
  VOTING: 'voting',
  FINISHED: 'finished'
};

// Kategoriler ve kelimeler
const categories = {
  'Hayvanlar': ['Aslan', 'Kaplan', 'Fil', 'Zürafa', 'Kartal', 'Balık', 'Kedi', 'Köpek', 'At', 'İnek'],
  'Yiyecekler': ['Pizza', 'Hamburger', 'Döner', 'Lahmacun', 'Kebap', 'Pasta', 'Dondurma', 'Çikolata', 'Elma', 'Muz'],
  'Meslekler': ['Doktor', 'Öğretmen', 'Mühendis', 'Avukat', 'Hemşire', 'Polis', 'İtfaiyeci', 'Pilot', 'Şoför', 'Aşçı'],
  'Eşyalar': ['Masa', 'Sandalye', 'Telefon', 'Bilgisayar', 'Kitap', 'Kalem', 'Çanta', 'Saat', 'Ayna', 'Lamba']
};

// Rastgele oda kodu üret
function generateRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Rastgele kelime seç
function getRandomWord(category) {
  const words = categories[category] || categories['Hayvanlar'];
  return words[Math.floor(Math.random() * words.length)];
}

// Casusları rastgele seç
function selectSpies(players, spyCount = 1) {
  if (spyCount >= players.length) {
    spyCount = Math.floor(players.length / 2); // Maksimum yarısı casus olabilir
  }
  const shuffled = [...players].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, spyCount).map(p => p.id);
}

// Tüm oyunculara mesaj gönder
function broadcastToRoom(roomCode, message, excludePlayerId = null) {
  const room = gameRooms.get(roomCode);
  if (!room) return;

  room.players.forEach(player => {
    if (player.id !== excludePlayerId) {
      const connection = playerConnections.get(player.id);
      if (connection && connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify(message));
      }
    }
  });
}

// Oyuncu bağlantısı kesildiğinde temizle
function handlePlayerDisconnect(playerId) {
  playerConnections.delete(playerId);
  
  // Oyuncunun hangi odada olduğunu bul
  for (const [roomCode, room] of gameRooms.entries()) {
    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1) {
      room.players.splice(playerIndex, 1);
      
      // Oda boş ise sil
      if (room.players.length === 0) {
        gameRooms.delete(roomCode);
      } else {
        // Host ayrıldıysa yeni host seç
        if (room.hostId === playerId && room.players.length > 0) {
          room.hostId = room.players[0].id;
        }
        
        // Diğer oyunculara bildir
        broadcastToRoom(roomCode, {
          type: 'playerLeft',
          playerId: playerId,
          room: {
            code: roomCode,
            players: room.players,
            hostId: room.hostId,
            state: room.state,
            category: room.category
          }
        });
      }
      break;
    }
  }
}

// WebSocket bağlantı yönetimi
wss.on('connection', (ws) => {
  console.log('Yeni bağlantı kuruldu');
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('Gelen mesaj:', message);
      
      switch (message.type) {
        case 'createRoom':
          handleCreateRoom(ws, message);
          break;
        case 'joinRoom':
          handleJoinRoom(ws, message);
          break;
        case 'startGame':
          handleStartGame(ws, message);
          break;
        case 'showWord':
          handleShowWord(ws, message);
          break;
        case 'startDiscussion':
          handleStartDiscussion(ws, message);
          break;
        case 'startVoting':
          handleStartVoting(ws, message);
          break;
        case 'vote':
          handleVote(ws, message);
          break;
        case 'restartGame':
          handleRestartGame(ws, message);
          break;
        case 'leaveRoom':
          handleLeaveRoom(ws, message);
          break;
        default:
          console.log('Bilinmeyen mesaj tipi:', message.type);
      }
    } catch (error) {
      console.error('Mesaj işleme hatası:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Mesaj işlenirken hata oluştu'
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('Bağlantı kesildi');
    // Bağlantı kesildiğinde oyuncuyu bul ve temizle
    for (const [playerId, connection] of playerConnections.entries()) {
      if (connection === ws) {
        handlePlayerDisconnect(playerId);
        break;
      }
    }
  });
});

// Oda oluştur
function handleCreateRoom(ws, message) {
  try {
    const roomCode = generateRoomCode();
    const playerId = uuidv4();
    
    const player = {
      id: playerId,
      name: message.playerName,
      isConnected: true
    };
    
    const room = {
      code: roomCode,
      hostId: playerId,
      players: [player],
      state: GameState.WAITING,
      category: null,
      word: null,
      spies: [],
      spyCount: 1,
      showSpyCountToPlayers: false,
      allowSpyDiscussion: true,
      spyHintsEnabled: true,
      maxPlayers: 8,
      autoStart: false,
      votes: new Map(),
      createdAt: new Date()
    };
    
    gameRooms.set(roomCode, room);
    playerConnections.set(playerId, ws);
    
    console.log(`Oda oluşturuldu: ${roomCode}, Oyuncu: ${message.playerName}`);
    
    const response = {
      type: 'roomCreated',
      playerId: playerId,
      room: {
        code: roomCode,
        players: room.players,
        hostId: room.hostId,
        state: room.state,
        category: room.category
      }
    };
    
    console.log('Yanıt gönderiliyor:', response);
    ws.send(JSON.stringify(response));
  } catch (error) {
    console.error('Oda oluşturma hatası:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Oda oluşturulamadı: ' + error.message
    }));
  }
}

// Odaya katıl
function handleJoinRoom(ws, message) {
  try {
    console.log(`Odaya katılma isteği: ${message.roomCode}, Oyuncu: ${message.playerName}`);
    
    const room = gameRooms.get(message.roomCode);
    
    if (!room) {
      console.log(`Oda bulunamadı: ${message.roomCode}`);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Oda bulunamadı'
      }));
      return;
    }
    
    if (room.state !== GameState.WAITING) {
      console.log(`Oyun başlamış, katılım reddedildi: ${message.roomCode}`);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Oyun başlamış, katılamazsınız'
      }));
      return;
    }
    
    const playerId = uuidv4();
    const player = {
      id: playerId,
      name: message.playerName,
      isConnected: true
    };
    
    room.players.push(player);
    playerConnections.set(playerId, ws);
    
    console.log(`Oyuncu katıldı: ${message.playerName} (${playerId}) -> Oda: ${message.roomCode}`);
    
    // Katılan oyuncuya bilgi gönder
    const joinResponse = {
      type: 'roomJoined',
      playerId: playerId,
      room: {
        code: room.code,
        players: room.players,
        hostId: room.hostId,
        state: room.state,
        category: room.category
      }
    };
    
    console.log('Katılım yanıtı gönderiliyor:', joinResponse);
    ws.send(JSON.stringify(joinResponse));
    
    // Diğer oyunculara bildir
    broadcastToRoom(message.roomCode, {
      type: 'playerJoined',
      player: player,
      room: {
        code: room.code,
        players: room.players,
        hostId: room.hostId,
        state: room.state,
        category: room.category
      }
    }, playerId);
    
    console.log(`Toplam oyuncu sayısı: ${room.players.length}`);
  } catch (error) {
    console.error('Odaya katılma hatası:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Odaya katılınamadı: ' + error.message
    }));
  }
}

// Oyunu başlat
function handleStartGame(ws, message) {
  const room = gameRooms.get(message.roomCode);
  
  if (!room || room.hostId !== message.playerId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Oyunu sadece host başlatabilir'
    }));
    return;
  }
  
  if (room.players.length < 3) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'En az 3 oyuncu gerekli'
    }));
    return;
  }
  
  room.state = GameState.STARTING;
  room.category = message.category;
  room.word = getRandomWord(message.category);
  
  // Ayarları güncelle (eğer gönderildiyse)
  if (message.settings) {
    room.spyCount = message.settings.spyCount || room.spyCount;
    room.showSpyCountToPlayers = message.settings.showSpyCountToPlayers || room.showSpyCountToPlayers;
    room.allowSpyDiscussion = message.settings.allowSpyDiscussion !== undefined ? message.settings.allowSpyDiscussion : room.allowSpyDiscussion;
    room.spyHintsEnabled = message.settings.spyHintsEnabled !== undefined ? message.settings.spyHintsEnabled : room.spyHintsEnabled;
  }
  
  room.spies = selectSpies(room.players, room.spyCount);
  room.votes = new Map();
  
  broadcastToRoom(message.roomCode, {
    type: 'gameStarted',
    room: {
      code: room.code,
      players: room.players,
      hostId: room.hostId,
      state: room.state,
      category: room.category
    }
  });
}

// Kelimeyi göster
function handleShowWord(ws, message) {
  const room = gameRooms.get(message.roomCode);
  
  if (!room || room.hostId !== message.playerId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Bu işlemi sadece host yapabilir'
    }));
    return;
  }
  
  room.state = GameState.WORD_SHOWN;
  
  // Her oyuncuya rolüne göre mesaj gönder
  console.log(`Kelime gösteriliyor: ${room.word}, Casuslar: ${room.spies.join(', ')}`);
  room.players.forEach(player => {
    const connection = playerConnections.get(player.id);
    const isSpy = room.spies.includes(player.id);
    console.log(`Oyuncu ${player.name} (${player.id}): ${isSpy ? 'CASUS' : 'NORMAL'}, Bağlantı: ${connection ? 'VAR' : 'YOK'}`);
    
    if (connection && connection.readyState === WebSocket.OPEN) {
      const message = {
        type: 'wordShown',
        word: isSpy ? null : room.word,
        category: room.category,
        isSpy: isSpy,
        spyCount: room.showSpyCountToPlayers ? room.spyCount : null,
        otherSpies: (isSpy && room.allowSpyDiscussion) ? 
          room.spies.filter(spyId => spyId !== player.id)
                   .map(spyId => room.players.find(p => p.id === spyId).name) : null,
        spyHintsEnabled: room.spyHintsEnabled,
        room: {
          code: room.code,
          players: room.players,
          hostId: room.hostId,
          state: room.state,
          category: room.category
        }
      };
      console.log(`${player.name}'e mesaj gönderiliyor:`, message);
      connection.send(JSON.stringify(message));
    } else {
      console.log(`${player.name} için bağlantı yok veya kapalı`);
    }
  });
}

// Tartışmayı başlat
function handleStartDiscussion(ws, message) {
  const room = gameRooms.get(message.roomCode);
  
  if (!room || room.hostId !== message.playerId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Bu işlemi sadece host yapabilir'
    }));
    return;
  }
  
  room.state = GameState.DISCUSSION;
  
  broadcastToRoom(message.roomCode, {
    type: 'discussionStarted',
    room: {
      code: room.code,
      players: room.players,
      hostId: room.hostId,
      state: room.state,
      category: room.category
    }
  });
}

// Oylamayı başlat
function handleStartVoting(ws, message) {
  const room = gameRooms.get(message.roomCode);
  
  if (!room || room.hostId !== message.playerId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Bu işlemi sadece host yapabilir'
    }));
    return;
  }
  
  room.state = GameState.VOTING;
  room.votes = new Map();
  
  broadcastToRoom(message.roomCode, {
    type: 'votingStarted',
    room: {
      code: room.code,
      players: room.players,
      hostId: room.hostId,
      state: room.state,
      category: room.category
    }
  });
}

// Oy ver
function handleVote(ws, message) {
  const room = gameRooms.get(message.roomCode);
  
  if (!room || room.state !== GameState.VOTING) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Şu anda oylama yapılamaz'
    }));
    return;
  }
  
  // Oyunu kaydet
  room.votes.set(message.playerId, message.votedPlayerId);
  
  // Oy sayısını güncelle
  const voteCount = room.votes.size;
  const totalPlayers = room.players.length;
  
  broadcastToRoom(message.roomCode, {
    type: 'voteUpdate',
    voteCount: voteCount,
    totalPlayers: totalPlayers,
    room: {
      code: room.code,
      players: room.players,
      hostId: room.hostId,
      state: room.state,
      category: room.category
    }
  });
  
  // Tüm oyuncular oy verdiyse sonuçları hesapla
  if (voteCount === totalPlayers) {
    calculateGameResults(room);
  }
}

// Oyun sonuçlarını hesapla
function calculateGameResults(room) {
  room.state = GameState.FINISHED;
  
  // Oy sayımı
  const voteCounts = new Map();
  for (const votedPlayerId of room.votes.values()) {
    voteCounts.set(votedPlayerId, (voteCounts.get(votedPlayerId) || 0) + 1);
  }
  
  // En çok oy alan oyuncu
  let maxVotes = 0;
  let eliminatedPlayerId = null;
  
  for (const [playerId, votes] of voteCounts.entries()) {
    if (votes > maxVotes) {
      maxVotes = votes;
      eliminatedPlayerId = playerId;
    }
  }
  
  // Sonuçları belirle
  const eliminatedPlayer = room.players.find(p => p.id === eliminatedPlayerId);
  const isEliminatedSpy = room.spies.includes(eliminatedPlayerId);
  
  let spiesWon = false;
  let gameOverReason = '';
  
  if (isEliminatedSpy) {
    // Casus yakalandı
    if (room.spies.length === 1) {
      // Tek casus varsa oyun bitti, siviller kazandı
      spiesWon = false;
      gameOverReason = 'Casus yakalandı! Siviller kazandı!';
    } else {
      // Birden fazla casus varsa oyun devam eder
      room.spies = room.spies.filter(spyId => spyId !== eliminatedPlayerId);
      room.players = room.players.filter(p => p.id !== eliminatedPlayerId);
      
      if (room.spies.length === 0) {
        spiesWon = false;
        gameOverReason = 'Tüm casuslar yakalandı! Siviller kazandı!';
      } else {
        // Oyun devam ediyor
        room.state = GameState.WAITING;
        room.votes = new Map();
        
        broadcastToRoom(room.code, {
          type: 'playerEliminated',
          eliminatedPlayer: eliminatedPlayer,
          isSpy: true,
          gameOver: false,
          spiesRemaining: room.spies.length,
          room: {
            code: room.code,
            players: room.players,
            hostId: room.hostId,
            state: room.state,
            category: room.category
          }
        });
        return;
      }
    }
  } else {
    // Sivil yakalandı
    room.players = room.players.filter(p => p.id !== eliminatedPlayerId);
    
    // Casus sayısı sivil sayısına eşit veya fazla ise casuslar kazandı
    const civilianCount = room.players.length - room.spies.length;
    if (room.spies.length >= civilianCount) {
      spiesWon = true;
      gameOverReason = 'Casuslar çoğunluğa ulaştı! Casuslar kazandı!';
    } else {
      // Oyun devam ediyor
      room.state = GameState.WAITING;
      room.votes = new Map();
      
      broadcastToRoom(room.code, {
        type: 'playerEliminated',
        eliminatedPlayer: eliminatedPlayer,
        isSpy: false,
        gameOver: false,
        spiesRemaining: room.spies.length,
        room: {
          code: room.code,
          players: room.players,
          hostId: room.hostId,
          state: room.state,
          category: room.category
        }
      });
      return;
    }
  }
  
  // Oyun bitti
  const results = {
    spiesWon: spiesWon,
    reason: gameOverReason,
    word: room.word,
    spies: room.spies.map(spyId => {
      const spy = room.players.find(p => p.id === spyId);
      return spy ? spy.name : 'Bilinmeyen';
    }),
    eliminatedPlayer: eliminatedPlayer ? eliminatedPlayer.name : null,
    voteCounts: Array.from(voteCounts.entries()).map(([playerId, votes]) => {
      const player = room.players.find(p => p.id === playerId);
      return {
        playerName: player ? player.name : 'Bilinmeyen',
        votes: votes
      };
    })
  };
  
  broadcastToRoom(room.code, {
    type: 'gameFinished',
    results: results,
    room: {
      code: room.code,
      players: room.players,
      hostId: room.hostId,
      state: room.state,
      category: room.category
    }
  });
}

// Oyunu yeniden başlat
function handleRestartGame(ws, message) {
  const room = gameRooms.get(message.roomCode);
  
  if (!room || room.hostId !== message.playerId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Oyunu sadece host yeniden başlatabilir'
    }));
    return;
  }
  
  // Oyun durumunu sıfırla
  room.state = GameState.WAITING;
  room.category = null;
  room.word = null;
  room.spies = [];
  room.votes = new Map();
  
  broadcastToRoom(message.roomCode, {
    type: 'gameRestarted',
    room: {
      code: room.code,
      players: room.players,
      hostId: room.hostId,
      state: room.state,
      category: room.category
    }
  });
}

// Odadan ayrıl
function handleLeaveRoom(ws, message) {
  const room = gameRooms.get(message.roomCode);
  
  if (!room) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Oda bulunamadı'
    }));
    return;
  }
  
  handlePlayerDisconnect(message.playerId);
}

// Sunucuyu başlat
server.listen(PORT, () => {
  console.log(`SSL WebSocket sunucusu ${PORT} portunda çalışıyor...`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Sunucu kapatılıyor...');
  server.close(() => {
    console.log('WebSocket sunucusu kapatıldı');
    process.exit(0);
  });
}); 