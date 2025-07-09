# Railway'e WebSocket Sunucu Deploy Rehberi

## 1. Railway Hesabı Oluştur
1. [railway.app](https://railway.app) adresine git
2. "Login" → "Login with GitHub" seç
3. GitHub hesabınla giriş yap

## 2. GitHub'a Yükle (Gerekli)
```bash
# GitHub'da yeni repo oluştur: casus-kim-websocket
git remote add origin https://github.com/KULLANICI_ADIN/casus-kim-websocket.git
git branch -M main
git push -u origin main
```

## 3. Railway'de Deploy Et
1. Railway dashboard'da "New Project" tıkla
2. "Deploy from GitHub repo" seç
3. `casus-kim-websocket` repo'sunu seç
4. Otomatik deploy başlayacak

## 4. Domain Ayarla
1. Deploy bittikten sonra "Settings" → "Domains" 
2. "Generate Domain" butonuna tıkla
3. URL'yi kopyala (örnek: `casus-kim-websocket-production.up.railway.app`)

## 5. Railway Avantajları
- ✅ Aylık $5 ücretsiz kredi (hobby projeler için yeterli)
- ✅ Otomatik SSL (HTTPS/WSS)
- ✅ GitHub entegrasyonu
- ✅ Otomatik deploy
- ✅ Mükemmel WebSocket desteği
- ✅ Kolay yönetim

## 6. URL Formatı
Railway URL'in şu formatta olacak:
```
wss://PROJE-ADI-production.up.railway.app
```

## 7. Flutter'da URL Güncelle
`lib/services/multiplayer_service.dart` dosyasında:
```dart
final String _wsUrl = 'wss://PROJE-ADI-production.up.railway.app';
```

## 8. Otomatik Deploy
- GitHub'a her push yaptığında otomatik deploy olur
- Kod değişiklikleri anında yansır
- Rollback özelliği var

## 9. Monitoring
- CPU, RAM, Network kullanımı görüntüleme
- Logs real-time takip
- Performance metrics

## 10. Maliyet
- İlk $5 ücretsiz (aylık)
- Sonrası kullandığın kadar öde
- Küçük WebSocket sunucu ~$1-2/ay

Railway en profesyonel ve güvenilir seçenek! 