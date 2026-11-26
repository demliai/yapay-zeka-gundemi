// Yapay Zekâ Gündemi: haberler.json'u okur, gün gün listeler, kaynağa göre süzer.
// Derleme adımı yok; düz JavaScript.
(() => {
  'use strict';

  // Şablon deposunun adresi. GitHub Pages'ta (kullanici.github.io/depo/) kendiliğinden bulunur;
  // özel alan adı kullanıyorsanız buraya elle yazın, ör. 'https://github.com/kullanici/depo'.
  const SABLON_DEPO = '';

  const liste = document.getElementById('liste');
  const cipler = document.getElementById('cipler');
  const durum = document.getElementById('durum');
  const TZ = 'Europe/Istanbul';

  const gunBicim = new Intl.DateTimeFormat('tr-TR', { timeZone: TZ, day: 'numeric', month: 'long', weekday: 'long' });
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
    // [bu sürenin altındaysa, bu birime böl, bu adla yaz]
    const adimlar = [[3600, 60, 'minute'], [86400, 3600, 'hour'], [604800, 86400, 'day']];
    if (Math.abs(fark) < 60) return 'az önce';
    for (const [sinir, bolen, birim] of adimlar) {
      if (Math.abs(fark) < sinir) return goreli.format(Math.round(fark / bolen), birim);
    }
    return null; // bir haftadan eskiyse saat göster
  }

  function gunBasligi(tarih) {
    const bugun = anahtarBicim.format(new Date());
    const dun = anahtarBicim.format(new Date(Date.now() - 86400000));
    const k = anahtarBicim.format(tarih);
    if (k === bugun) return 'bugün';
    if (k === dun) return 'dün';
    return gunBicim.format(tarih);
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

  function cipleriCiz() {
    const sayac = new Map();
    for (const h of veri.haberler) sayac.set(h.kaynak, (sayac.get(h.kaynak) || 0) + 1);
    const hatali = new Set((veri.kaynak_durumu || []).filter(d => d.durum !== 'tamam').map(d => d.kaynak));
    const adlar = ['Tümü', ...[...sayac.keys()].sort((a, b) => a.localeCompare(b, 'tr'))];
    cipler.replaceChildren(...adlar.map(ad => {
      const s = ad === 'Tümü' ? veri.haberler.length : sayac.get(ad);
      const b = el('button', { type: 'button', class: 'cip' + (hatali.has(ad) ? ' hata' : ''), 'aria-pressed': String(ad === secili) },
        document.createTextNode(ad), el('span', { class: 'sayi', text: String(s) }));
      if (hatali.has(ad)) b.title = 'Bu kaynak son denemede okunamadı; eski haberler gösteriliyor.';
      b.addEventListener('click', () => sec(ad));
      return b;
    }));
    // Mobilde yana kayan şeritte seçili çipi görünür alana getir (sayfayı kaydırmadan).
    const aktif = cipler.querySelector('[aria-pressed="true"]');
    if (aktif && cipler.scrollWidth > cipler.clientWidth) {
      const sol = aktif.offsetLeft - cipler.offsetLeft;  // ikisinin de offsetParent'ı .filtre
      if (sol < cipler.scrollLeft || sol + aktif.offsetWidth > cipler.scrollLeft + cipler.clientWidth - 32) {
        cipler.scrollLeft = Math.max(0, sol - 16);
      }
    }
  }

  function listeyiCiz() {
    const haberler = veri.haberler.filter(h => secili === 'Tümü' || h.kaynak === secili);
    if (!haberler.length) {
      liste.replaceChildren(el('p', { class: 'bos', text: 'Bu kaynaktan haber yok.' }));
      return;
    }
    const parcalar = [];
    let sonGun = null, ul = null;
    for (const h of haberler) {
      const link = guvenliLink(h.link);
      if (!link) continue;
      const t = new Date(h.tarih);
      const gun = gunBasligi(t);
      if (gun !== sonGun) {
        sonGun = gun;
        parcalar.push(el('h3', { class: 'gun', text: gun }));
        ul = el('ul', { class: 'haberler' });
        parcalar.push(ul);
      }
      const saatVar = !h.tarih.endsWith('T00:00:00Z');
      const zaman = el('time', { datetime: h.tarih, title: tamBicim.format(t), text: (saatVar && neZaman(t)) || (saatVar ? saatBicim.format(t) : '') });
      const meta = el('div', { class: 'meta' }, el('span', { class: 'kaynak', text: h.kaynak }), zaman);
      const a = el('a', { href: link, target: '_blank', rel: 'noopener noreferrer', text: h.baslik });
      const baslik = el('h2', {}, a, el('span', { class: 'dis', 'aria-hidden': 'true', text: '↗' }));
      if (h.dil && h.dil !== 'tr') baslik.append(el('span', { class: 'dil', title: 'İngilizce kaynak', text: h.dil.toUpperCase() }));
      const icerik = el('div', { class: 'icerik' }, baslik, h.ozet ? el('p', { class: 'ozet', text: h.ozet }) : null);
      ul.append(el('li', { class: 'haber' }, meta, icerik));
    }
    liste.replaceChildren(...parcalar);
  }

  function sec(ad) {
    secili = ad;
    const yeniHash = ad === 'Tümü' ? '' : '#' + encodeURIComponent(ad);
    history.replaceState(null, '', location.pathname + location.search + yeniHash);
    cipleriCiz();
    listeyiCiz();
  }

  async function yukle() {
    try {
      const yanit = await fetch('haberler.json?t=' + Date.now(), { cache: 'no-store' });
      if (!yanit.ok) throw new Error('HTTP ' + yanit.status);
      veri = await yanit.json();
    } catch (hata) {
      durum.textContent = 'haberler okunamadı';
      liste.replaceChildren(el('p', { class: 'bos' },
        document.createTextNode('haberler.json okunamadı. Sayfayı dosyadan değil bir sunucudan açın '),
        el('b', { text: '(python -m http.server)' }),
        document.createTextNode(' ya da Actions iş akışının en az bir kez çalıştığını kontrol edin.')));
      return;
    }
    const g = new Date(veri.guncellendi);
    const kaynakSayisi = new Set(veri.haberler.map(h => h.kaynak)).size;
    durum.replaceChildren(
      el('span', {}, document.createTextNode('son güncelleme: '), el('b', { text: tamBicim.format(g) })),
      document.createTextNode(' · '), el('span', { text: `${veri.haberler.length} haber` }),
      document.createTextNode(' · '), el('span', { text: `${kaynakSayisi} kaynak` }));
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash && veri.haberler.some(h => h.kaynak === hash)) secili = hash;
    const sablon = sablonAdresi();
    const sb = document.getElementById('sablon-baglanti');
    if (sablon) sb.href = sablon; else sb.removeAttribute('href');
    cipleriCiz();
    listeyiCiz();
  }

  yukle();
})();
