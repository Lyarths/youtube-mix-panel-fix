# 🎵 YouTube Mix Panel Fix (Tampermonkey UserScript)

YouTube'un otomatik **Mix** oynatma listelerindeki kaybolan şarkıları koruyan, kendi sabit Mix sırasını oluşturan, şarkıları **favorilere (yıldız) alıp en üste taşıyan** ve istemediğiniz videoları **Geri Al (Undo)** desteğiyle gizleyen gelişmiş UserScript.

---

## ✨ Özellikler

- 📌 **Kaybolmayan Sabit Mix Sırası (Virtual Pool):** YouTube Mix listesi ilerledikçe listeden düşen/kaybolan şarkıları sanal havuzda (`localStorage`) korur ve sıranın bozulmasını engeller.
- ⭐ **Favori (Yıldız) Sistemi:** Beğendiğiniz şarkıları yıldızlayarak Mix listesinin en üstüne sabitleyebilir veya yalnızca favorilerin çalmasını sağlayabilirsiniz.
- 🚫 **Mix'ten Gizleme & Geri Alma (Undo):** İstenmeyen şarkıları tek tıkla (veya 3 nokta menüsünden) Mix'ten gizler; yanlışlıkla gizlenen şarkılar için 3.2 saniyelik **"Geri Al"** bildirimi sunar.
- 🔀 **Özel Karıştırma (Shuffle) & Erken Geçiş:** Şarkı bitmeden `0.45` saniye önce takılmadan sıradaki parçaya geçiş yapar.
- 🌍 **Çoklu Kapsam & Dil Desteği:** Yalnızca mevcut Mix için (`mix`), tüm Mix'ler için (`global`) veya geçmiş bazlı (`history`) filtreleme. Türkçe ve İngilizce arayüz desteği.

---

## 🚀 Kurulum

1. Tarayıcınıza [Tampermonkey](https://www.tampermonkey.net/) veya [Violentmonkey](https://violentmonkey.github.io/) eklentisini kurun.
2. Bu repodaki [`yt-mix-panel-fix.user.js`](./yt-mix-panel-fix.user.js) dosyasını açıp **Raw** butonuna tıklayın (veya içeriğini yeni bir Tampermonkey betiğine yapıştırıp kaydedin).
3. YouTube'da herhangi bir **Mix** oynatma listesi açtığınızda sağ panelde otomatik olarak devreye girer.
