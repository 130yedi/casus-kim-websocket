const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Heroku için dinamik port desteği
const PORT = process.env.PORT || 8080;

// WebSocket sunucusu oluştur
const wss = new WebSocket.Server({ 
  port: PORT,
  // Heroku için gerekli ayarlar
  perMessageDeflate: false,
  maxPayload: 16 * 1024 * 1024, // 16MB
});

console.log(`WebSocket sunucusu ${PORT} portunda başlatılıyor...`);

// Heartbeat sistemi - ölü bağlantıları temizle
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      console.log('Ölü bağlantı tespit edildi, kapatılıyor...');
      // Oyuncuyu bul ve temizle
      for (const [playerId, connection] of playerConnections.entries()) {
        if (connection === ws) {
          handlePlayerDisconnect(playerId);
          break;
        }
      }
      return ws.terminate();
    }
    
    ws.isAlive = false;
    try {
      ws.ping();
    } catch (error) {
      console.error('Ping gönderme hatası:', error);
    }
  });
}, 30000); // 30 saniyede bir kontrol et

// Sunucu kapanırken temizlik yap
process.on('SIGTERM', () => {
  clearInterval(heartbeatInterval);
  wss.close();
});

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
  console.log(`Oyuncu bağlantısı kesildi: ${playerId}`);
  
  const connection = playerConnections.get(playerId);
  if (connection) {
    playerConnections.delete(playerId);
  }
  
  // Oyuncunun hangi odada olduğunu bul
  for (const [roomCode, room] of gameRooms.entries()) {
    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1) {
      const playerName = room.players[playerIndex].name;
      room.players.splice(playerIndex, 1);
      
      console.log(`Oyuncu odadan çıkarıldı: ${playerName} (${playerId}) -> Oda: ${roomCode}`);
      
      // Oda boş ise sil
      if (room.players.length === 0) {
        console.log(`Oda silindi: ${roomCode} (boş oda)`);
        gameRooms.delete(roomCode);
      } else {
        // Host ayrıldıysa yeni host seç
        if (room.hostId === playerId && room.players.length > 0) {
          room.hostId = room.players[0].id;
          console.log(`Yeni host seçildi: ${room.players[0].name} (${room.hostId})`);
        }
        
        // Diğer oyunculara bildir
        const updateMessage = {
          type: 'playerLeft',
          playerId: playerId,
          playerName: playerName,
          room: {
            code: roomCode,
            players: room.players,
            hostId: room.hostId,
            state: room.state,
            category: room.category
          }
        };
        
        console.log(`Oyuncu ayrılma bildirimi gönderiliyor:`, updateMessage);
        broadcastToRoom(roomCode, updateMessage);
      }
      break;
    }
  }
}

// WebSocket bağlantı yönetimi
wss.on('connection', (ws) => {
  console.log('Yeni bağlantı kuruldu');
  
  // Bağlantı için timeout ayarla
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
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
        case 'ping':
          // Heartbeat ping'ine pong ile yanıt ver
          ws.isAlive = true;
          try {
            ws.send(JSON.stringify({ type: 'pong' }));
          } catch (error) {
            console.error('Pong gönderme hatası:', error);
          }
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
    
    // Aynı isimde oyuncu var mı kontrol et
    const existingPlayer = room.players.find(p => p.name.toLowerCase() === message.playerName.toLowerCase());
    if (existingPlayer) {
      console.log(`Aynı isimde oyuncu zaten var: ${message.playerName}`);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Bu isimde bir oyuncu zaten odada'
      }));
      return;
    }
    
    // Maksimum oyuncu sayısı kontrolü
    if (room.players.length >= (room.maxPlayers || 8)) {
      console.log(`Oda dolu: ${room.players.length}/${room.maxPlayers || 8}`);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Oda dolu'
      }));
      return;
    }
    
    const playerId = uuidv4();
    const player = {
      id: playerId,
      name: message.playerName,
      isConnected: true,
      joinedAt: new Date()
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
      message: 'Odaya katılırken hata oluştu: ' + error.message
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
  try {
    const room = gameRooms.get(message.roomCode);
    
    if (!room) {
      console.log(`Oda bulunamadı: ${message.roomCode}`);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Oda bulunamadı'
      }));
      return;
    }
    
    if (room.hostId !== message.playerId) {
      console.log(`Yetkisiz kelime gösterme denemesi: ${message.playerId} (Host: ${room.hostId})`);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Bu işlemi sadece host yapabilir'
      }));
      return;
    }
    
    if (room.state !== GameState.STARTING) {
      console.log(`Yanlış durum: ${room.state}, kelime gösterilemez`);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Kelime sadece oyun başlangıcında gösterilebilir'
      }));
      return;
    }
    
    room.state = GameState.WORD_SHOWN;
    
    console.log(`Kelime gösteriliyor: "${room.word}", Kategori: ${room.category}, Casuslar: [${room.spies.join(', ')}]`);
    
    // Her oyuncuya rolüne göre mesaj gönder
    let successCount = 0;
    let failCount = 0;
    
    room.players.forEach(player => {
      const connection = playerConnections.get(player.id);
      const isSpy = room.spies.includes(player.id);
      
      if (connection && connection.readyState === WebSocket.OPEN) {
        try {
          const playerMessage = {
            type: 'wordShown',
            word: isSpy ? null : room.word,
            category: room.category,
            isSpy: isSpy,
            spyCount: room.showSpyCountToPlayers ? room.spyCount : null,
            otherSpies: (isSpy && room.allowSpyDiscussion) ? 
              room.spies.filter(spyId => spyId !== player.id)
                       .map(spyId => room.players.find(p => p.id === spyId)?.name).filter(Boolean) : [],
            spyHintsEnabled: room.spyHintsEnabled,
            room: {
              code: room.code,
              players: room.players,
              hostId: room.hostId,
              state: room.state,
              category: room.category
            }
          };
          
          connection.send(JSON.stringify(playerMessage));
          successCount++;
          console.log(`✅ ${player.name} (${isSpy ? 'CASUS' : 'NORMAL'}): Mesaj gönderildi`);
        } catch (error) {
          failCount++;
          console.error(`❌ ${player.name}: Mesaj gönderme hatası:`, error);
        }
      } else {
        failCount++;
        console.log(`❌ ${player.name}: Bağlantı yok veya kapalı`);
        // Bağlantısı olmayan oyuncuyu işaretle
        player.isConnected = false;
      }
    });
    
    console.log(`Kelime gösterme tamamlandı: ${successCount} başarılı, ${failCount} başarısız`);
    
    // Eğer hiç kimseye gönderilemezse hata döndür
    if (successCount === 0) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Hiçbir oyuncuya mesaj gönderilemedi'
      }));
    }
    
  } catch (error) {
    console.error('Kelime gösterme hatası:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Kelime gösterilirken hata oluştu: ' + error.message
    }));
  }
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
  room.votes.clear();
  
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
  
  room.votes.set(message.playerId, message.votedPlayerId);
  
  // Tüm oyuncular oy verdiyse sonuçları hesapla
  if (room.votes.size === room.players.length) {
    const voteCounts = new Map();
    const voteDetails = new Map();
    
    // Oy sayımı
    for (const [voterId, votedId] of room.votes.entries()) {
      voteCounts.set(votedId, (voteCounts.get(votedId) || 0) + 1);
      if (!voteDetails.has(votedId)) {
        voteDetails.set(votedId, []);
      }
      const voter = room.players.find(p => p.id === voterId);
      voteDetails.get(votedId).push(voter.name);
    }
    
    // En çok oy alan oyuncu
    let maxVotes = 0;
    let suspectedPlayerId = null;
    for (const [playerId, votes] of voteCounts.entries()) {
      if (votes > maxVotes) {
        maxVotes = votes;
        suspectedPlayerId = playerId;
      }
    }
    
    // Sonuçları belirle
    const spyWins = !room.spies.includes(suspectedPlayerId);
    room.state = GameState.FINISHED;
    
    // Sonuçları gönder
    broadcastToRoom(message.roomCode, {
      type: 'gameFinished',
      results: {
        spyWins: spyWins,
        word: room.word,
        spies: room.spies.map(spyId => room.players.find(p => p.id === spyId)),
        suspectedPlayer: room.players.find(p => p.id === suspectedPlayerId),
        voteCounts: Object.fromEntries(
          Array.from(voteCounts.entries()).map(([playerId, count]) => [
            room.players.find(p => p.id === playerId).name,
            count
          ])
        ),
        voteDetails: Object.fromEntries(
          Array.from(voteDetails.entries()).map(([playerId, voters]) => [
            room.players.find(p => p.id === playerId).name,
            voters
          ])
        )
      },
      room: {
        code: room.code,
        players: room.players,
        hostId: room.hostId,
        state: room.state,
        category: room.category
      }
    });
  } else {
    // Oy sayısını güncelle
    broadcastToRoom(message.roomCode, {
      type: 'voteUpdate',
      votedCount: room.votes.size,
      totalPlayers: room.players.length
    });
  }
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
  
  room.state = GameState.WAITING;
  room.category = null;
  room.word = null;
  room.spies = [];
  room.votes.clear();
  
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
  try {
    const room = gameRooms.get(message.roomCode);
    if (!room) return;
    
    const playerIndex = room.players.findIndex(p => p.id === message.playerId);
    if (playerIndex === -1) return;
    
    // Oyuncuyu listeden çıkar
    room.players.splice(playerIndex, 1);
    playerConnections.delete(message.playerId);
    
    // Oda boş ise sil
    if (room.players.length === 0) {
      gameRooms.delete(message.roomCode);
      return;
    }
    
    // Host ayrıldıysa yeni host seç
    if (room.hostId === message.playerId && room.players.length > 0) {
      room.hostId = room.players[0].id;
    }
    
    // Diğer oyunculara bildir
    broadcastToRoom(message.roomCode, {
      type: 'playerLeft',
      playerId: message.playerId,
      room: {
        code: room.code,
        players: room.players,
        hostId: room.hostId,
        state: room.state,
        category: room.category
      }
    });
    
    console.log(`Oyuncu odadan ayrıldı: ${message.playerId} -> Oda: ${message.roomCode}`);
  } catch (error) {
    console.error('Odadan ayrılma hatası:', error);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Sunucu kapatılıyor...');
  wss.close(() => {
    console.log('WebSocket sunucusu kapatıldı');
    process.exit(0);
  });
}); 