# Heroku'ya WebSocket Sunucusu Deploy Rehberi

## 🚀 Hızlı Deploy Adımları

### 1. Heroku Hesabı ve CLI Kurulumu

1. [Heroku](https://heroku.com) hesabı oluşturun (ücretsiz)
2. [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) indirin ve kurun
3. Terminal'de giriş yapın:
```bash
heroku login
```

### 2. Heroku Uygulaması Oluşturma

```bash
# websocket_server klasörüne gidin
cd websocket_server

# Git repository başlatın (eğer yoksa)
git init

# Heroku uygulaması oluşturun (benzersiz isim verin)
heroku create casus-kim-websocket-[RANDOM]

# Örnek:
# heroku create casus-kim-websocket-2024
# heroku create casus-kim-multiplayer-server
```

### 3. Deploy İşlemi

```bash
# Dosyaları git'e ekleyin
git add .
git commit -m "Initial WebSocket server deploy"

# Heroku'ya push edin
git push heroku main

# Logları kontrol edin
heroku logs --tail
```

### 4. Heroku URL'sini Alın

Deploy başarılı olduktan sonra:
```bash
heroku info
```

URL örneği: `https://casus-kim-websocket-2024.herokuapp.com`

### 5. Flutter Uygulamasını Güncelleyin

Flutter uygulamasında WebSocket URL'sini güncelleyin:
```dart
// lib/services/multiplayer_service.dart
static const String _serverUrl = 'wss://casus-kim-websocket-2024.herokuapp.com';
```

## 🔧 Heroku Ayarları

### Ücretsiz Plan Limitler
- **Dyno Saatleri**: Ayda 550 saat ücretsiz
- **Sleep Mode**: 30 dakika aktivite yoksa uyur
- **Wake Up**: İlk istek 10-15 saniye sürebilir

### Uyku Modunu Engellemek (Opsiyonel)
Ücretsiz planda uyku modunu engellemek için ping servisi kullanabilirsiniz:

1. [UptimeRobot](https://uptimerobot.com) hesabı oluşturun
2. Monitor ekleyin: `https://your-app.herokuapp.com`
3. 5 dakikada bir ping atacak şekilde ayarlayın

### Ücretli Plan (Önerilen)
- **Hobby Plan**: $7/ay
- 7/24 çalışır, uyku modu yok
- SSL sertifikası dahil
- Daha iyi performans

## 🔍 Sorun Giderme

### Deploy Hataları
```bash
# Logları kontrol edin
heroku logs --tail

# Build loglarını görün
heroku logs --source app

# Dyno durumunu kontrol edin
heroku ps
```

### Yaygın Hatalar

1. **Port Hatası**: 
   - `process.env.PORT` kullandığınızdan emin olun
   - Heroku otomatik port atar

2. **Build Hatası**:
   - `package.json` dosyasının doğru olduğundan emin olun
   - Node.js versiyonunu kontrol edin

3. **WebSocket Bağlantı Hatası**:
   - URL'nin `wss://` ile başladığından emin olun
   - Heroku otomatik SSL sağlar

## 📊 Monitoring

### Heroku Dashboard
- [dashboard.heroku.com](https://dashboard.heroku.com)
- Logs, metrics, ve dyno durumu

### Performans İzleme
```bash
# Gerçek zamanlı loglar
heroku logs --tail

# Dyno durumu
heroku ps

# Restart (gerekirse)
heroku ps:restart
```

## 🔄 Güncelleme

Kod değişikliklerini deploy etmek için:
```bash
git add .
git commit -m "Update message"
git push heroku main
```

## 💰 Maliyet Optimizasyonu

### Ücretsiz Plan İçin
- Uygulamayı sadece gerektiğinde kullanın
- Gece saatlerinde otomatik uyku moduna girsin

### Ücretli Plan İçin
- Hobby plan ($7/ay) çoğu kullanım için yeterli
- Yoğun kullanım için Standard plan ($25/ay)

## 🌐 Custom Domain (Opsiyonel)

Kendi domain'inizi kullanmak için:
```bash
# Domain ekleyin
heroku domains:add websocket.casuskim.com.tr

# DNS ayarları
# CNAME: websocket -> your-app.herokuapp.com
```

## ✅ Test Etme

Deploy sonrası test için:
1. Flutter uygulamasını çalıştırın
2. "Çok Oyunculu Mod" seçin
3. Oda oluşturmayı deneyin
4. Heroku loglarını izleyin

## 🆘 Destek

Sorun yaşarsanız:
1. Heroku loglarını kontrol edin
2. WebSocket URL'sini doğrulayın
3. Flutter uygulamasında network hatalarını kontrol edin 