# ⏳ Sanduhr

Eine realistische, animierte Sanduhr im Browser – gebaut mit **HTML, CSS, JavaScript und PHP**.
Läuft auf Handy, Tablet, Computer und TV.

> 🇹🇷 Türkçe açıklama aşağıda: [Türkçe](#-türkçe)

---

## 🇩🇪 Deutsch

### Funktionen

- **Dauer wählen:** 1, 5, 10, 15 oder 30 Minuten – oder eine eigene Dauer eingeben (0,1 – 600 min)
- **Realistischer Sand:** Trichter im oberen Kolben, feiner Sandstrahl, fallende und springende Körner, wachsender Sandhaufen unten
- **Umdreh-Animation:** Die Sanduhr dreht sich um 180° – wie eine echte. Beim Umdrehen mitten im Lauf wird die Restzeit umgekehrt.
- **Ton:** leises Rieseln während des Laufs, Geräusch beim Umdrehen, Glockenklang am Ende
- **Sprachausgabe:** Am Ende sagt die Sanduhr *„Sanduhr fertig“* (Web Speech API, Deutsch)
- **Vibration** am Handy, wenn die Zeit abgelaufen ist
- **Bildschirm bleibt an**, solange die Sanduhr läuft (Wake Lock API)
- **Verlauf:** Die letzten Durchläufe werden per PHP in einer JSON-Datei gespeichert
- **Responsive:** Hoch- und Querformat, große Schrift auf TV-Bildschirmen, Vollbild-Modus

### Bedienung

| Aktion | Wirkung |
|---|---|
| Klick/Tippen auf den **oberen oder unteren Holzrahmen** | Umdrehen |
| Klick/Tippen auf das **Glas** | Start / Pause |
| **Handy umdrehen** (auf den Kopf stellen) | Umdrehen |
| `Leertaste` / Play-Taste der Fernbedienung | Start / Pause |
| `↑` oder `U` | Umdrehen |
| `R` | Zurücksetzen |

### Voraussetzungen

- Ein Webserver mit **PHP 7.4+** (z. B. [XAMPP](https://www.apachefriends.org/))
- Ein moderner Browser (Chrome, Edge, Firefox, Safari)
- Keine Datenbank, keine externen Bibliotheken

### Installation (XAMPP)

1. Den Ordner `sanduhr` nach `C:\xampp\htdocs\` kopieren (oder das Repository dort klonen):
   ```bash
   cd C:\xampp\htdocs
   git clone https://github.com/<benutzername>/sanduhr.git
   ```
2. Im XAMPP Control Panel **Apache** starten.
3. Im Browser öffnen: `http://localhost/sanduhr/`

Ohne XAMPP geht es auch mit dem eingebauten PHP-Server:
```bash
php -S localhost:8000 -t sanduhr
```

### Auf dem Handy / Tablet öffnen

1. Handy und Computer müssen im **selben WLAN** sein.
2. IP-Adresse des Computers herausfinden (Windows: `ipconfig`) und am Handy öffnen:
   `http://<IP-des-Computers>/sanduhr/`
3. Lädt die Seite nicht (Timeout), blockiert meist die **Windows-Firewall**:
   - WLAN-Netzwerk in den Windows-Einstellungen auf **Privat** stellen
   - Apache für private Netzwerke in der Firewall erlauben

> **Hinweis:** Die Erkennung „Handy umdrehen“ braucht den Bewegungssensor. Browser erlauben ihn nur über
> **HTTPS** (oder `localhost`). Über `http://<IP>` funktioniert alles außer dem Umdrehen per Sensor.
> Auf dem iPhone muss außerdem beim ersten Start der Zugriff auf „Bewegung & Ausrichtung“ erlaubt werden.

### Projektstruktur

```
sanduhr/
├── index.html      # Aufbau der Seite
├── style.css       # Design & responsive Layout
├── script.js       # Sand-Animation (Canvas), Timer, Ton, Sprache, Steuerung
├── api.php         # JSON-API für den Verlauf
└── data/
    ├── .htaccess   # sperrt den direkten Zugriff auf die Daten
    └── history.json  # wird automatisch angelegt (nicht im Repository)
```

### API

| Anfrage | Beschreibung |
|---|---|
| `GET api.php?action=list` | die letzten 10 Durchläufe |
| `POST api.php?action=add` mit `{"seconds": 300}` | einen Durchlauf speichern |

---

## 🇹🇷 Türkçe

Tarayıcıda çalışan, gerçekçi animasyonlu bir **kum saati**. **HTML, CSS, JavaScript ve PHP** ile yapıldı.
Telefon, tablet, bilgisayar ve TV'de çalışır. Arayüz Almancadır.

### Özellikler

- **Süre seçimi:** 1, 5, 10, 15 veya 30 dakika ya da istediğin süreyi yaz (0,1 – 600 dk)
- **Gerçekçi kum:** Üstte oluşan çukur, ince kum akışı, düşüp seken kum taneleri, altta büyüyen kum tepesi
- **Çevirme animasyonu:** Kum saati 180° döner. Süre devam ederken çevrilirse kalan süre tersine döner.
- **Ses:** Akarken hafif hışırtı, çevirirken ses, bitince çan sesi
- **Konuşma:** Süre bitince *„Sanduhr fertig“* der (Almanca)
- **Titreşim:** Süre bitince telefon titrer
- **Ekran açık kalır:** Kum saati çalışırken ekran kararmaz
- **Geçmiş:** Son çalışmalar PHP ile bir JSON dosyasına kaydedilir
- **Her ekrana uyumlu:** Dikey ve yatay ekran, TV için büyük yazı, tam ekran modu

### Kullanım

| Ne yaparsan | Ne olur |
|---|---|
| **Üst veya alt ahşap çerçeveye** tıkla/dokun | Çevirir (Umdrehen) |
| **Cama** tıkla/dokun | Başlat / Duraklat |
| **Telefonu ters çevir** | Çevirir |
| `Boşluk` tuşu / kumandadaki Play tuşu | Başlat / Duraklat |
| `↑` veya `U` | Çevirir |
| `R` | Sıfırlar |

### Gereksinimler

- **PHP 7.4+** destekli bir web sunucusu (örneğin [XAMPP](https://www.apachefriends.org/))
- Güncel bir tarayıcı (Chrome, Edge, Firefox, Safari)
- Veritabanı veya dış kütüphane gerekmez

### Kurulum (XAMPP)

1. `sanduhr` klasörünü `C:\xampp\htdocs\` içine kopyala (veya depoyu orada klonla):
   ```bash
   cd C:\xampp\htdocs
   git clone https://github.com/<kullanici-adi>/sanduhr.git
   ```
2. XAMPP Control Panel'den **Apache**'yi başlat.
3. Tarayıcıda aç: `http://localhost/sanduhr/`

### Telefon / tablette açmak

1. Telefon ve bilgisayar **aynı Wi-Fi ağında** olmalı.
2. Bilgisayarın IP adresini bul (Windows: `ipconfig`) ve telefonda aç:
   `http://<bilgisayarın-IP-adresi>/sanduhr/`
3. Sayfa açılmazsa (timeout) genellikle **Windows Güvenlik Duvarı** engelliyordur:
   - Windows ayarlarında Wi-Fi ağını **Özel (Private)** yap
   - Güvenlik duvarında Apache'ye özel ağlar için izin ver

> **Not:** „Telefonu çevirme“ özelliği hareket sensörünü kullanır. Tarayıcılar bu sensörü sadece
> **HTTPS** (veya `localhost`) üzerinden açar. `http://<IP>` ile her şey çalışır, sadece sensörle çevirme çalışmaz.
> iPhone'da ayrıca ilk başlatmada „Hareket ve Yön“ iznini vermek gerekir.

Dosya yapısı ve API için yukarıdaki Almanca bölüme bak.
