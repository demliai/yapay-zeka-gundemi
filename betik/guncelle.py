#!/usr/bin/env python3
"""Yapay zekâ haberlerini RSS/Atom kaynaklarından toplar, haberler.json üretir.

Yalnız Python standart kütüphanesi kullanır; kurulum gerekmez.
Telif için: haber metni kopyalanmaz. Yalnız başlık, kaynak, tarih, bağlantı
ve (varsa) RSS özetinin ilk cümlesi (en çok 180 karakter) alınır.
Görsel: kaynağın kendi paylaşım görseli (RSS medya etiketi ya da haber sayfasının og:image
adresi); görsel indirilmez, yalnız adresi saklanır.

Kullanım:
    python betik/guncelle.py            # haberler.json'u güncelle
    python betik/guncelle.py --kontrol  # yalnız kaynakları dene, dosya yazma
"""
from __future__ import annotations

import gzip
import html
import json
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
KAYNAK_DOSYASI = KOK / "kaynaklar.json"
CIKTI = KOK / "haberler.json"
OZET_SINIRI = 180
ZAMAN_ASIMI = 25
TARAYICI_KIMLIGI = "Mozilla/5.0 (compatible; haber-sitesi-sablonu/1.0; +https://github.com)"

ATOM = "{http://www.w3.org/2005/Atom}"
DC = "{http://purl.org/dc/elements/1.1/}"
MEDIA = "{http://search.yahoo.com/mrss/}"
OG_EN_FAZLA = 40      # bir çalıştırmada görsel için en çok kaç haber sayfası açılır
OG_ZAMAN_ASIMI = 10


def indir(adres: str, deneme: int = 2) -> bytes:
    istek = urllib.request.Request(adres, headers={
        "User-Agent": TARAYICI_KIMLIGI,
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
    })
    for kalan in range(deneme, 0, -1):
        try:
            with urllib.request.urlopen(istek, timeout=ZAMAN_ASIMI) as yanit:
                veri = yanit.read()
            # Bazı sunucular (ör. deepmind.google) istemesek de ara ara gzip yollar.
            if veri[:2] == b"\x1f\x8b":
                veri = gzip.decompress(veri)
            return veri
        except (OSError, EOFError):
            if kalan == 1:
                raise
            time.sleep(3)
    raise RuntimeError("indirilemedi")


def metin(el) -> str:
    if el is None:
        return ""
    return "".join(el.itertext()).strip()


def temizle(ham: str) -> str:
    """HTML etiketlerini ve fazla boşluğu at."""
    ham = html.unescape(ham or "")
    ham = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", ham, flags=re.S | re.I)
    ham = re.sub(r"<[^>]+>", " ", ham)
    ham = html.unescape(ham)
    return re.sub(r"\s+", " ", ham).strip()


def ilk_cumle(ham: str) -> str:
    """Özetin yalnız ilk cümlesini, en çok OZET_SINIRI karakterle döndür."""
    yazi = temizle(ham)
    if not yazi:
        return ""
    bul = re.search(r"^(.{20,}?[.!?…])(\s|$)", yazi)
    cumle = bul.group(1) if bul else yazi
    if len(cumle) > OZET_SINIRI:
        kesik = cumle[:OZET_SINIRI].rsplit(" ", 1)[0].rstrip(",;:-–—")
        cumle = kesik + "…"
    return cumle


def tarih_coz(ham: str):
    ham = (ham or "").strip()
    if not ham:
        return None
    try:
        t = parsedate_to_datetime(ham)  # RSS (RFC 822)
    except (TypeError, ValueError, IndexError):
        t = None
    if t is None:
        try:
            t = datetime.fromisoformat(ham.replace("Z", "+00:00"))  # Atom (ISO 8601)
        except ValueError:
            return None
    if t.tzinfo is None:
        t = t.replace(tzinfo=timezone.utc)
    t = t.astimezone(timezone.utc)
    simdi = datetime.now(timezone.utc)
    return min(t, simdi)  # gelecek tarihli kayıtları bugüne çek


def guvenli_baglanti(adres: str) -> str:
    adres = (adres or "").strip()
    return adres if re.match(r"^https?://", adres, re.I) else ""


def gorsel_bul(o) -> str:
    """RSS/Atom kaydından görsel adresi: media:content/thumbnail, enclosure, ya da açıklamadaki ilk <img>."""
    for etiket in (f"{MEDIA}content", f"{MEDIA}thumbnail"):
        for m in o.iter(etiket):
            adres = m.get("url", "")
            tur = m.get("type", "") or m.get("medium", "")
            if adres and (not tur or "image" in tur):
                return adres
    for e in o.findall("enclosure"):
        if "image" in e.get("type", "") and e.get("url"):
            return e.get("url")
    for alan in ("description", f"{ATOM}summary", f"{ATOM}content",
                 "{http://purl.org/rss/1.0/modules/content/}encoded"):
        bul = re.search(r"<img[^>]+src=[\"']([^\"']+)", html.unescape(metin(o.find(alan))))
        if bul:
            return bul.group(1)
    return ""


def og_gorsel(adres: str) -> str:
    """Haber sayfasının <head>'indeki og:image / twitter:image adresi (sayfanın yalnız ilk 200 KB'ı okunur)."""
    istek = urllib.request.Request(adres, headers={"User-Agent": TARAYICI_KIMLIGI, "Accept": "text/html"})
    with urllib.request.urlopen(istek, timeout=OG_ZAMAN_ASIMI) as yanit:
        ham = yanit.read(200_000)
    if ham[:2] == b"\x1f\x8b":
        ham = gzip.decompress(ham)
    sayfa = ham.decode("utf-8", "replace")
    for desen in (r"<meta[^>]+(?:property|name)=[\"'](?:og:image|twitter:image)[\"'][^>]*content=[\"']([^\"']+)",
                  r"<meta[^>]+content=[\"']([^\"']+)[\"'][^>]*(?:property|name)=[\"'](?:og:image|twitter:image)[\"']"):
        bul = re.search(desen, sayfa, re.I)
        if bul:
            return html.unescape(bul.group(1))
    return ""


def akisi_coz(veri: bytes):
    kok = ET.fromstring(veri.lstrip(b"\xef\xbb\xbf \r\n\t"))
    kayitlar = []
    if kok.tag == f"{ATOM}feed":
        for g in kok.findall(f"{ATOM}entry"):
            link = ""
            for l in g.findall(f"{ATOM}link"):
                if l.get("rel", "alternate") == "alternate":
                    link = l.get("href", "")
                    break
            kayitlar.append({
                "baslik": metin(g.find(f"{ATOM}title")),
                "link": link,
                "tarih": metin(g.find(f"{ATOM}published")) or metin(g.find(f"{ATOM}updated")),
                "ozet": metin(g.find(f"{ATOM}summary")),
                "gorsel": gorsel_bul(g),
            })
    else:
        kanal = kok.find("channel")
        ogeler = kanal.findall("item") if kanal is not None else kok.iter("item")
        for o in ogeler:
            kayitlar.append({
                "baslik": metin(o.find("title")),
                "link": metin(o.find("link")) or metin(o.find("guid")),
                "tarih": metin(o.find("pubDate")) or metin(o.find(f"{DC}date")),
                # content:encoded (tam metin) bilerek okunmaz; yalnız kısa açıklama.
                "ozet": metin(o.find("description")),
                "gorsel": gorsel_bul(o),
            })
    return kayitlar


def tr_kucuk(s: str) -> str:
    return s.replace("İ", "i").replace("I", "ı").lower()


def kaynagi_isle(k: dict, sinir: int):
    kayitlar = akisi_coz(indir(k["rss"]))
    filtre = [tr_kucuk(f) for f in k.get("filtre", [])]
    haberler, tarihsiz = [], 0
    for r in kayitlar:
        baslik = temizle(r["baslik"])
        link = guvenli_baglanti(r["link"])
        tarih = tarih_coz(r["tarih"])
        if not baslik or not link:
            continue
        if tarih is None:
            tarihsiz += 1
            continue
        ozet = ilk_cumle(r["ozet"])
        if ozet and tr_kucuk(ozet).startswith(tr_kucuk(baslik)[:40]):
            ozet = ""  # özet başlığın tekrarıysa gösterme
        if filtre:
            alan = tr_kucuk(baslik + " " + ozet)
            if not any(f in alan for f in filtre):
                continue
        haberler.append({
            "baslik": baslik,
            "kaynak": k["ad"],
            "dil": k.get("dil", ""),
            "tarih": tarih.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "link": link,
            "ozet": ozet,
            "gorsel": guvenli_baglanti(r.get("gorsel", "")).replace("http://", "https://", 1),
        })
    haberler.sort(key=lambda h: h["tarih"], reverse=True)
    return haberler[:sinir], len(kayitlar), tarihsiz


def main() -> int:
    yalniz_kontrol = "--kontrol" in sys.argv
    ayar = json.loads(KAYNAK_DOSYASI.read_text(encoding="utf-8"))
    sinir = int(ayar.get("kaynak_basina_en_fazla", 12))
    toplam_sinir = int(ayar.get("toplam_en_fazla", 120))
    kaynaklar = [k for k in ayar["kaynaklar"] if k.get("aktif", True)]

    eski = {}
    if CIKTI.exists():
        try:
            eski = json.loads(CIKTI.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            eski = {}
    eski_haberler = eski.get("haberler", [])

    tum, durum, calisan = [], [], 0
    for k in kaynaklar:
        try:
            haberler, ham, tarihsiz = kaynagi_isle(k, sinir)
            calisan += 1
            durum.append({"kaynak": k["ad"], "durum": "tamam", "haber": len(haberler)})
            ek = f", {tarihsiz} tarihsiz atlandı" if tarihsiz else ""
            print(f"  TAMAM  {k['ad']:<20} {ham:>3} kayıt -> {len(haberler)} haber{ek}")
            tum.extend(haberler)
        except Exception as hata:  # bir kaynak bozuksa diğerleri sürsün
            onceki = [h for h in eski_haberler if h.get("kaynak") == k["ad"]]
            tum.extend(onceki)
            durum.append({"kaynak": k["ad"], "durum": "hata", "hata": type(hata).__name__})
            print(f"  HATA   {k['ad']:<20} {type(hata).__name__}: {str(hata)[:90]}"
                  f"  (eski {len(onceki)} haber korundu)")

    print(f"\n{calisan}/{len(kaynaklar)} kaynak çalıştı.")
    if calisan == 0:
        print("Hiçbir kaynak çalışmadı; haberler.json değiştirilmedi.")
        return 1
    if yalniz_kontrol:
        return 0

    gorulen, benzersiz = set(), []
    for h in sorted(tum, key=lambda h: h["tarih"], reverse=True):
        anahtar = h["link"].split("#")[0].rstrip("/")
        if anahtar in gorulen:
            continue
        gorulen.add(anahtar)
        benzersiz.append(h)
    benzersiz = benzersiz[:toplam_sinir]

    # Görseli olmayan haberler: önce eski dosyadaki görsel, yoksa haber sayfasının og:image'i (sınırlı sayıda).
    eski_gorsel = {h["link"]: h.get("gorsel", "") for h in eski_haberler if h.get("gorsel")}
    acilan = 0
    for h in benzersiz:
        if h.get("gorsel"):
            continue
        if h["link"] in eski_gorsel:
            h["gorsel"] = eski_gorsel[h["link"]]
            continue
        if acilan >= OG_EN_FAZLA:
            continue
        acilan += 1
        try:
            h["gorsel"] = guvenli_baglanti(og_gorsel(h["link"])).replace("http://", "https://", 1)
        except Exception:
            h["gorsel"] = ""
    gorselli = sum(1 for h in benzersiz if h.get("gorsel"))
    print(f"Görsel: {gorselli}/{len(benzersiz)} haberde ({acilan} sayfa açıldı).")

    if benzersiz == eski_haberler:
        print("Yeni haber yok; dosya olduğu gibi bırakıldı (commit gerekmez).")
        return 0

    cikti = {
        "guncellendi": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "kaynak_durumu": durum,
        "haberler": benzersiz,
    }
    CIKTI.write_text(json.dumps(cikti, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"haberler.json yazıldı: {len(benzersiz)} haber.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
