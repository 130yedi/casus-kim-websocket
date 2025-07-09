# Casus Kim WebSocket Sunucusu

Bu, "Casus Kim?" Flutter uygulaması için gerçek zamanlı çok oyunculu oyun desteği sağlayan WebSocket sunucusudur.

## Kurulum

### Gereksinimler
- Node.js (v14 veya üzeri)
- npm veya yarn

### Kurulum Adımları

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. Sunucuyu başlatın:
```bash
npm start
```

Geliştirme modu için (otomatik yeniden başlatma):
```bash
npm run dev
```

## Sunucu Özellikleri

- **Port**: 8080 (varsayılan)
- **WebSocket Protokolü**: ws://
- **Real-time İletişim**: Tüm oyuncular arasında senkronize oyun durumu

## Oyun Akışı

1. **Oda Oluşturma**: Host oyuncu oda oluşturur
2. **Oyuncu Katılımı**: Diğer oyuncular 6 haneli kod ile katılır
3. **Oyun Başlatma**: Host kategori seçer ve oyunu başlatır
4. **Kelime Gösterimi**: Casuslar hariç herkese kelime gösterilir
5. **Tartışma**: 2 dakikalık tartışma süresi
6. **Oylama**: Herkes şüphelendiği kişiye oy verir
7. **Sonuç**: Casuslar yakalandı mı belirlenir

## API Mesaj Tipleri

### Client → Server
- `createRoom`: Yeni oda oluştur
- `joinRoom`: Odaya katıl
- `startGame`: Oyunu başlat
- `showWord`: Kelimeyi göster
- `startDiscussion`: Tartışmayı başlat
- `startVoting`: Oylamayı başlat
- `vote`: Oy ver
- `restartGame`: Oyunu yeniden başlat

### Server → Client
- `roomCreated`: Oda oluşturuldu
- `roomJoined`: Odaya katılındı
- `playerJoined`: Yeni oyuncu katıldı
- `playerLeft`: Oyuncu ayrıldı
- `gameStarted`: Oyun başladı
- `wordShown`: Kelime gösterildi
- `discussionStarted`: Tartışma başladı
- `votingStarted`: Oylama başladı
- `voteUpdate`: Oy sayısı güncellendi
- `gameFinished`: Oyun bitti
- `gameRestarted`: Oyun yeniden başladı
- `error`: Hata mesajı

## Kategoriler ve Kelimeler

Sunucu 4 farklı kategori içerir:
- **Hayvanlar**: 10 kelime
- **Yiyecekler**: 10 kelime
- **Meslekler**: 10 kelime
- **Eşyalar**: 10 kelime

## Güvenlik

- Oda kodları 6 haneli rastgele sayılardan oluşur
- Her oyuncuya benzersiz UUID atanır
- Host yetkileri sadece oda oluşturan oyuncuda
- Bağlantı kesildiğinde otomatik temizlik

## Geliştirme

Sunucuyu geliştirme modunda çalıştırmak için:
```bash
npm run dev
```

Bu mod dosya değişikliklerini izler ve sunucuyu otomatik olarak yeniden başlatır.

## Deployment

Prodüksiyon ortamına deploy etmek için:

1. Sunucuyu cloud servisine yükleyin (Heroku, DigitalOcean, AWS vs.)
2. Flutter uygulamasındaki `_serverUrl` değişkenini güncelleyin
3. HTTPS kullanıyorsanız `wss://` protokolünü kullanın

Örnek prodüksiyon URL'si:
```dart
static const String _serverUrl = 'wss://your-server.herokuapp.com';
``` 