// Yapay Zekâ Gündemi: haberler.json'u okur, gün gün kart ızgarası çizer, kaynağa göre süzer.
// Derleme adımı yok; düz JavaScript.
(() => {
  'use strict';

  // Şablon deposunun adresi. GitHub Pages'ta (kullanici.github.io/depo/) kendiliğinden bulunur;
  // özel alan adı kullanıyorsanız buraya elle yazın, ör. 'https://github.com/kullanici/depo'.
  const SABLON_DEPO = '';
  const GUNCELLEME_SAAT = 3;   // .github/workflows/guncelle.yml içindeki cron ile aynı olmalı

  const liste = document.getElementById('liste');
  const tabaklar = document.getElementById('tabaklar');
  const TZ = 'Europe/Istanbul';

  const gunBicim = new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, day: 'numeric', month: 'long', weekday: 'long' });
  const kisaGun = new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, day: 'numeric', month: 'long' });
  const tamBicim = new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const saatBicim = new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  const anahtarBicim = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const goreli = new Intl.RelativeTimeFormat('tr', { numeric: 'auto' });

  let veri = null;
  let secili = 'Tümü';

  function el(etiket, ozellik = {}, ...cocuklar) {
    const e = document.createElement(etiket);
    for (const [k, v] of Object.entries(ozellik)) {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else e.setAttribute(k, v);
    }
    for (const c of cocuklar) if (c) e.append(c);
    return e;
  }

  function guvenliLink(adres) {
    try {
      const u = new URL(adres);
      return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : null;
    } catch { return null; }
  }

  function neZaman(tarih) {
    const fark = (tarih - Date.now()) / 1000;
    const adimlar = [[3600, 60, 'minute'], [86400, 3600, 'hour'], [604800, 86400, 'day']];
    if (Math.abs(fark) < 60) return 'az önce';
    for (const [sinir, bolen, birim] of adimlar) {
      if (Math.abs(fark) < sinir) return goreli.format(Math.round(fark / bolen), birim);
    }
    return kisaGun.format(tarih);
  }

  function gunBasligi(tarih) {
    const bugun = anahtarBicim.format(new Date());
    const dun = anahtarBicim.format(new Date(Date.now() - 86400000));
    const k = anahtarBicim.format(tarih);
    if (k === bugun) return ['Bugün', kisaGun.format(tarih)];
    if (k === dun) return ['Dün', kisaGun.format(tarih)];
    return [gunBicim.format(tarih), ''];
  }

  function sablonAdresi() {
    if (SABLON_DEPO) return SABLON_DEPO;
    const h = location.hostname;
    if (h.endsWith('.github.io')) {
      const kullanici = h.replace('.github.io', '');
      const depo = location.pathname.split('/').filter(Boolean)[0] || h;
      return `https://github.com/${kullanici}/${depo}`;
    }
    return null;
  }

  // Görseli olmayan ya da yüklenemeyen haber için: gece zemin, kaynak adı, buhar.
  function yedekGorsel(kaynak) {
    const buhar = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    buhar.setAttribute('viewBox', '0 0 44 40'); buhar.setAttribute('aria-hidden', 'true');
    buhar.innerHTML = '<path d="M10 36c-6-8 6-12 0-22M22 36c-6-8 6-12 0-22M34 36c-6-8 6-12 0-22" fill="none" stroke="#F7EEE4" stroke-width="3" stroke-linecap="round"/>';
    return el('div', { class: 'yedek' }, el('span', { text: kaynak }), buhar);
  }

  function tabak(ad, sayi, basili, hatali) {
    const b = el('button', { type: 'button', class: 'tabak' + (hatali ? ' hata' : ''), 'aria-pressed': String(basili) },
      el('span', { class: 'nokta', 'aria-hidden': 'true' }), document.createTextNode(ad),
      sayi != null ? el('span', { class: 'sayi', text: String(sayi) }) : null);
    if (hatali) b.title = 'Bu kaynak son denemede okunamadı; eski haberler gösteriliyor.';
    return b;
  }

  function tabaklariCiz() {
    const sayac = new Map();
    for (const h of veri.haberler) sayac.set(h.kaynak, (sayac.get(h.kaynak) || 0) + 1);
    const hatali = new Set((veri.kaynak_durumu || []).filter(d => d.durum !== 'tamam').map(d => d.kaynak));
    const adlar = ['Tümü', ...[...sayac.keys()].sort((a, b) => a.localeCompare(b, 'tr'))];
    tabaklar.replaceChildren(...adlar.map(ad => {
      const b = tabak(ad, ad === 'Tümü' ? veri.haberler.length : sayac.get(ad), ad === secili, hatali.has(ad));
      b.addEventListener('click', () => sec(ad));
      return b;
    }));
    // Mobilde yana kayan şeritte seçili tabağı görünür alana getir (sayfayı kaydırmadan).
    const aktif = tabaklar.querySelector('[aria-pressed="true"]');
    if (aktif && tabaklar.scrollWidth > tabaklar.clientWidth) {
      const sol = aktif.offsetLeft - tabaklar.offsetLeft;
      if (sol < tabaklar.scrollLeft || sol + aktif.offsetWidth > tabaklar.scrollLeft + tabaklar.clientWidth - 32) {
        tabaklar.scrollLeft = Math.max(0, sol - 16);
      }
    }
  }

  function kart(h, manset, sira) {
    const link = guvenliLink(h.link);
    if (!link) return null;
    const t = new Date(h.tarih);
    const saatVar = !h.tarih.endsWith('T00:00:00Z');

    const gorsel = el('div', { class: 'gorsel' });
    const adres = h.gorsel && guvenliLink(h.gorsel);
    if (adres) {
      const img = el('img', { src: adres, alt: '', loading: sira < 4 ? 'eager' : 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
      img.addEventListener('error', () => img.replaceWith(yedekGorsel(h.kaynak)), { once: true });
      gorsel.append(img);
    } else {
      gorsel.append(yedekGorsel(h.kaynak));
    }
    const etiket = el('span', { class: 'tabak' }, el('span', { class: 'nokta', 'aria-hidden': 'true' }), document.createTextNode(h.kaynak));
    gorsel.append(etiket);

    const meta = el('div', { class: 'meta' },
      el('time', { datetime: h.tarih, title: tamBicim.format(t), text: saatVar ? neZaman(t) : kisaGun.format(t) }),
      h.dil && h.dil !== 'tr' ? el('span', { class: 'dil', title: 'İngilizce kaynak', text: h.dil.toUpperCase() }) : null);
    const govde = el('div', { class: 'govde' }, meta, el('h2', { text: h.baslik }),
      h.ozet ? el('p', { class: 'ozet', text: h.ozet }) : null,
      el('span', { class: 'dis', text: 'habere git ↗' }));

    const a = el('a', { class: 'kart gir' + (manset ? ' manset' : ''), href: link, target: '_blank', rel: 'noopener noreferrer' }, gorsel, govde);
    a.style.animationDelay = Math.min(sira, 8) * 60 + 'ms';
    return a;
  }

  function listeyiCiz() {
    const haberler = veri.haberler.filter(h => secili === 'Tümü' || h.kaynak === secili);
    if (!haberler.length) {
      liste.replaceChildren(el('p', { class: 'bos' }, el('img', { src: 'assets/demli/demli-bos-420.webp', alt: '' }), document.createTextNode('Bu kaynaktan haber yok. Bardak boş.')));
      return;
    }
    const parcalar = [];
    let sira = 0, kalan = haberler;
    // Manşet: en yeni görselli haber büyük, yanında sıradaki iki haber (gün ayrımından bağımsız)
    const ilk = haberler.findIndex(h => h.gorsel);
    if (haberler.length >= 3 && ilk >= 0 && ilk < 3) {
      const ust = [haberler[ilk], ...haberler.filter((_, i) => i !== ilk).slice(0, 2)];
      const izgara = el('div', { class: 'izgara manset-izgara' });
      ust.forEach((h, i) => { const k = kart(h, i === 0, sira); if (k) { izgara.append(k); sira++; } });
      parcalar.push(el('h3', { class: 'gun' }, document.createTextNode('Son demlenenler')), izgara);
      const kullanilan = new Set(ust);
      kalan = haberler.filter(h => !kullanilan.has(h));
    }
    let sonGun = null, izgara = null;
    for (const h of kalan) {
      const [gun, ek] = gunBasligi(new Date(h.tarih));
      if (gun !== sonGun) {
        sonGun = gun;
        parcalar.push(el('h3', { class: 'gun' }, document.createTextNode(gun + ' '), ek ? el('small', { text: ek }) : null));
        izgara = el('div', { class: 'izgara' });
        parcalar.push(izgara);
      }
      const k = kart(h, false, sira);
      if (k) { izgara.append(k); sira++; }
    }
    liste.replaceChildren(...parcalar);
  }

  function sec(ad) {
    secili = ad;
    const yeniHash = ad === 'Tümü' ? '' : '#' + encodeURIComponent(ad);
    history.replaceState(null, '', location.pathname + location.search + yeniHash);
    tabaklariCiz();
    listeyiCiz();
  }

  function adisyonuDoldur() {
    const g = new Date(veri.guncellendi);
    const kaynakSayisi = new Set(veri.haberler.map(h => h.kaynak)).size;
    // sıradaki demleme: cron "17 */3 * * *" (UTC); GitHub birkaç dakika geciktirebilir
    const s = new Date(); s.setUTCSeconds(0, 0);
    s.setUTCMinutes(17);
    while (s <= new Date() || s.getUTCHours() % GUNCELLEME_SAAT !== 0) s.setUTCHours(s.getUTCHours() + 1);
    document.getElementById('a-son').textContent = saatBicim.format(g) + ' · ' + kisaGun.format(g);
    document.getElementById('a-son').title = tamBicim.format(g);
    document.getElementById('a-haber').textContent = String(veri.haberler.length);
    document.getElementById('a-kaynak').textContent = String(kaynakSayisi);
    document.getElementById('a-sonraki').textContent = '~' + saatBicim.format(s);
  }

  async function yukle() {
    try {
      const yanit = await fetch('haberler.json?t=' + Date.now(), { cache: 'no-store' });
      if (!yanit.ok) throw new Error('HTTP ' + yanit.status);
      veri = await yanit.json();
    } catch (hata) {
      document.getElementById('a-son').textContent = 'okunamadı';
      liste.replaceChildren(el('p', { class: 'bos' },
        el('img', { src: 'assets/demli/demli-bos-420.webp', alt: '' }),
        el('span', {}, document.createTextNode('haberler.json okunamadı. Sayfayı dosyadan değil bir sunucudan açın '),
          el('b', { text: '(python -m http.server)' }),
          document.createTextNode(' ya da Actions iş akışının en az bir kez çalıştığını kontrol edin.'))));
      return;
    }
    adisyonuDoldur();
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash && veri.haberler.some(h => h.kaynak === hash)) secili = hash;
    const sablon = sablonAdresi();
    const sb = document.getElementById('sablon-baglanti');
    if (sablon) sb.href = sablon; else sb.href = 'https://github.com/demliai/yapay-zeka-gundemi';
    tabaklariCiz();
    listeyiCiz();
  }

  yukle();
})();
