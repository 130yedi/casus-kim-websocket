# Glitch'e WebSocket Sunucu Deploy Rehberi

## 1. Glitch Hesabı Oluştur
1. [glitch.com](https://glitch.com) adresine git
2. "Sign up" ile hesap oluştur (GitHub ile giriş yapabilirsin)

## 2. Yeni Proje Oluştur
1. "New Project" butonuna tıkla
2. "Import from GitHub" seç
3. Repo URL'si: Bu klasörü GitHub'a yüklemen gerekiyor

## 3. GitHub'a Yükle (Kolay Yol)
```bash
# GitHub'da yeni repo oluştur: casus-kim-websocket
git remote add origin https://github.com/KULLANICI_ADIN/casus-kim-websocket.git
git branch -M main
git push -u origin main
```

## 4. Glitch'te Import Et
1. GitHub repo URL'sini yapıştır
2. "Import" butonuna tıkla
3. Otomatik olarak deploy olacak

## 5. Glitch Avantajları
- ✅ Tamamen ücretsiz
- ✅ Otomatik SSL (HTTPS/WSS)
- ✅ 7/24 çalışır
- ✅ Kolay kod düzenleme
- ✅ Anında deploy
- ✅ WebSocket tam desteği

## 6. URL Formatı
Glitch URL'in şu formatta olacak:
```
wss://PROJE-ADI.glitch.me
```

Örnek: `wss://casus-kim-websocket.glitch.me`

## 7. Flutter'da URL Güncelle
`lib/services/multiplayer_service.dart` dosyasında:
```dart
final String _wsUrl = 'wss://PROJE-ADI.glitch.me';
```

## 8. Test Et
1. Glitch'te proje açıldıktan sonra "Show" butonuna tıkla
2. URL'yi kopyala
3. Flutter uygulamasında güncelle
4. Çok oyunculu modu test et

## 9. Glitch Özellikleri
- Kod düzenleyici built-in
- Logs görüntüleme
- Dosya yönetimi
- Kolaborasyon desteği
- Otomatik backup

## 10. Limitler
- Proje 5 dakika boştaysa uyur (ilk request'te uyanır)
- 4000 saat/ay limit (pratik olarak sınırsız)
- 512MB RAM
- 200MB disk

Bu limitler senin proje için fazlasıyla yeterli! 