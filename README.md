# Yapay Zekâ Gündemi: kendi kendini güncelleyen haber sitesi

Yapay zekâ haberlerini (Anthropic, OpenAI, Google DeepMind, Google AI / Gemini, Hugging Face, Webrazzi, ShiftDelete.Net, Webtekno) **her 3 saatte bir kendiliğinden** toplayan, tek sayfalık bir site.
Sunucu yok, API anahtarı yok, ücret yok: GitHub Actions haberleri çeker, GitHub Pages siteyi yayınlar.

Canlı örnek: https://demliai.github.io/yapay-zeka-gundemi/

---

## 3 adımda kendi siteni kur

Kod bilmen gerekmiyor. Yalnız bir GitHub hesabı lazım.

### 1. "Use this template"
Bu sayfanın sağ üstündeki yeşil **Use this template → Create a new repository** düğmesine bas.
Depoya bir ad ver (ör. `yapay-zeka-haberleri`) ve **Public** seç. (Neden public: aşağıdaki "Ücretsiz sınırlar" bölümüne bak.)

### 2. Settings → Pages
Yeni deponda **Settings → Pages** sayfasını aç.
**Build and deployment → Source** kısmında **GitHub Actions** seç. Kaydetmen gereken başka bir şey yok.

### 3. Actions'ı aç ve ilk kez çalıştır
**Actions** sekmesine geç. "Workflows aren't being run on this repository" gibi bir uyarı görürsen **I understand my workflows, go ahead and enable them** düğmesine bas.
Soldan **Haberleri güncelle** iş akışını seç, sağdaki **Run workflow → Run workflow** düğmesine bas.

Bir iki dakika sonra siten şu adreste: `https://<kullanici-adin>.github.io/<depo-adin>/`
Bundan sonra her 3 saatte bir kendiliğinden güncellenir; sana bir şey yapmak düşmez.

---

## Nasıl çalışıyor?

```
kaynaklar.json ──► betik/guncelle.py ──► haberler.json ──► index.html + site.js
   (RSS listesi)     (GitHub Actions,       (yalnız değiştiyse     (GitHub Pages)
                      3 saatte bir)          commit'lenir)
```

| Dosya | Ne işe yarar |
|---|---|
| `kaynaklar.json` | Haber kaynaklarının listesi. Kaynak eklemek/çıkarmak için yalnız bunu düzenle. |
| `betik/guncelle.py` | RSS/Atom akışlarını okur, `haberler.json` üretir. Yalnız Python standart kütüphanesi; kurulacak paket yok. |
| `haberler.json` | Sitenin okuduğu veri. Elle düzenleme; betik üretir. |
| `.github/workflows/guncelle.yml` | Zamanlayıcı: her 3 saatte bir betiği çalıştırır, değişiklik varsa commit'ler ve siteyi yayınlar. |
| `index.html`, `stil.css`, `site.js` | Sitenin kendisi. Derleme adımı yok. |
| `fontlar/` | Bricolage Grotesque, Inter, JetBrains Mono (SIL Open Font License). |

## Değiştirmek istersen

- **Kaynak eklemek:** `kaynaklar.json` içindeki bir satırı kopyala; `ad` ve `rss` adresini değiştir. Genel teknoloji sitesi ekliyorsan `filtre` ile yalnız yapay zekâ haberlerini al (Webtekno örneğine bak). Bir kaynağı kapatmak için `"aktif": false`.
- **Sıklık:** `.github/workflows/guncelle.yml` içindeki `cron: "17 */3 * * *"` satırı. `*/3` yerine `*/6` yazarsan 6 saatte bir olur. Saatler UTC'dir.
- **Başlık ve açıklama:** `index.html` içindeki `<h1>` ve `.alt` paragrafı.
- **Renkler:** `stil.css` en üstteki `:root` bloğu.
- **Özel alan adı kullanıyorsan:** `site.js` başındaki `SABLON_DEPO` değişkenine depo adresini yaz (alt bilgideki "açık bir şablondan" bağlantısı için). `github.io` adresinde buna gerek yok, kendiliğinden bulunur.

Değişikliği GitHub'ın web arayüzünden yapıp commit'lemen yeterli; site birkaç dakika içinde yeniden yayınlanır.

## Yerelde denemek (isteğe bağlı)

```bash
python betik/guncelle.py            # haberler.json'u günceller
python betik/guncelle.py --kontrol  # yalnız kaynakları dener, dosya yazmaz
python -m http.server 8000          # http://localhost:8000 adresinden aç
```

`index.html`'i çift tıklayıp açarsan haberler gelmez: tarayıcılar dosyadan açılan sayfanın `haberler.json` okumasını engeller. Yerel sunucu kullan.

---

## Ücretsiz sınırlar (dürüst hâli)

Bu kurulum **public (herkese açık) depoda tamamen ücretsizdir.** Bilmen gerekenler:

- **GitHub Actions:** Public depolarda standart çalıştırıcılar ücretsizdir, dakika sayılmaz. Private depoda ücretsiz planda aylık 2.000 dakika var; bu iş akışı her çalışmada yaklaşık 1 dakika sürer, günde 8 çalışma ayda kabaca 240 dakika eder.
- **GitHub Pages:** Ücretsiz planda **yalnız public depolardan** yayın yapılır (private depodan Pages için ücretli plan gerekir). Site boyutu en çok 1 GB, aylık trafik için yumuşak sınır 100 GB. Bu site birkaç yüz KB; kişisel kullanımda sınıra yaklaşmazsın.
- **Zamanlama tam dakikasında değildir:** GitHub yoğunken zamanlanmış çalışmalar birkaç dakika, nadiren daha fazla gecikebilir ya da atlanabilir. "Her 3 saatte bir" = "yaklaşık her 3 saatte bir".
- **60 gün kuralı:** Public depoda 60 gün boyunca hiç etkinlik olmazsa GitHub zamanlanmış iş akışlarını kendiliğinden durdurur ve sana e-posta atar. Actions sekmesinden tek tıkla yeniden açarsın.
- **Ticari kullanım:** GitHub Pages kişisel/proje siteleri içindir; ticari bir hizmeti (ör. e-ticaret) barındırmak için tasarlanmamıştır.

### Neler ücretli DEĞİL
API anahtarı yok, yapay zekâ modeli çağrısı yok, sunucu kirası yok, alan adı zorunlu değil (`github.io` adresi ücretsiz), kurulacak paket yok. Tek ücretli seçenek, istersen kendi alan adını (ör. `haberlerim.com`) satın almaktır.

## Telif notu

Site haber metnini kopyalamaz. Yalnız **başlık, kaynak adı, tarih, orijinal habere bağlantı** ve RSS'te varsa kısa özetin **ilk cümlesi** (en çok 180 karakter) gösterilir. Okumak isteyen haberi kaynağında açar. Haberlerin tüm hakları kaynak sitelere aittir.

Anthropic resmî bir RSS akışı yayınlamıyor; şablon, topluluğun açık kaynak ürettiği bir akışı kullanır ([Olshansk/rss-feeds](https://github.com/Olshansk/rss-feeds)). Bu akış bir gün kapanırsa betik o kaynağı atlar ve son bilinen haberleri korur; diğer kaynaklar çalışmaya devam eder.

## Lisans

Kod MIT lisanslıdır (`LICENSE`). Yazı tipleri SIL Open Font License 1.1 ile dağıtılır.
