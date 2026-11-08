// ==UserScript==
// @name         YouTube Mix Panel Fix
// @namespace    astral.youtube.mixfix
// @version      3.9.2
// @description  YouTube Mix panelini gösterir, kaybolan şarkıları koruyarak kendi sabit mix sıramızı oluşturur, favorileri en üste taşır, karışık çalar ve gizler
// @match        https://www.youtube.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    // ---------- Ayarlar ----------
    const DEBUG = false;
    const SHOW_HOVER_BUTTON = false;  // video üstüne gelince çıkan gizle butonu
    const SHOW_STAR_BUTTON  = true;   // video üstüne gelince çıkan favori (yıldız) butonu
    const SHOW_MENU_ENTRY   = true;   // üç nokta menüsüne "Mix'ten gizle" satırı
    const DEFAULT_SCOPE = 'mix';      // ⚙ penceresinde varsayılan kapsam: 'mix' | 'global' | 'history'
    const UNDO_MS = 3200;             // "Geri al" kutusunun ekranda kalma süresi
    const EARLY_SKIP_SEC = 0.45;      // şarkı bitmeden bu kadar saniye önce sıradaki şarkıya geç

    const log = (...args) => DEBUG && console.info('[YT Mix Fix]', ...args);

    const MARK = 'mixFixUnhid';
    const GONE_ATTR = 'data-ytmixfix-gone';
    const FAV_ATTR  = 'data-ytmixfix-fav';
    const ITEM_SEL = 'ytd-playlist-panel-video-renderer';
    const VIRT_SEL = '.ytmixfix-virtual-item';
    const LINK_SEL = 'a#wc-endpoint, a[href*="/watch?v="]';

    const STORE_KEY       = 'ytmixfix.hidden.v1';
    const FAV_STORE_KEY   = 'ytmixfix.fav.v1';
    const HIST_HIDDEN_KEY = 'ytmixfix.hist.hidden.v1';
    const HIST_FAV_KEY    = 'ytmixfix.hist.fav.v1';
    const POOL_STORE_KEY  = 'ytmixfix.pool.v1';
    const SCOPE_KEY       = 'ytmixfix.scope';
    const TAB_KEY         = 'ytmixfix.tab';
    const FAV_MODE_KEY    = 'ytmixfix.favmode';
    const SEED_KEY        = 'ytmixfix.seed';
    const LANG_KEY        = 'ytmixfix.lang';

    const GLOBAL_KEY = 'all';
    const MAX_SCOPES = 40;
    const MAX_HISTORY = 150;
    const MAX_POOL_MIXES = 12;
    const MAX_POOL_ITEMS = 120;

    // ---------- Modern SVG İkonlar (TrustedHTML CSP Uyumlu) ----------
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const ICONS = {
        starOutline: { stroke: true, nodes: [['polygon', { points: '12 2.5 14.95 8.48 21.55 9.44 16.77 14.1 17.9 20.67 12 17.57 6.1 20.67 7.23 14.1 2.45 9.44 9.05 8.48 12 2.5' }]] },
        starFilled:  { stroke: false, nodes: [['path', { d: 'M12 2.25a.75.75 0 0 1 .673.418l2.685 5.44 6.004.873a.75.75 0 0 1 .416 1.279l-4.344 4.234 1.025 5.98a.75.75 0 0 1-1.088.791L12 18.442l-5.371 2.823a.75.75 0 0 1-1.088-.79l1.025-5.981-4.344-4.234a.75.75 0 0 1 .416-1.28l6.004-.872 2.685-5.44A.75.75 0 0 1 12 2.25Z' }]] },
        eyeOff:      { stroke: true, nodes: [['path', { d: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24' }], ['line', { x1: '2', y1: '2', x2: '22', y2: '22' }]] },
        history:     { stroke: true, nodes: [['path', { d: 'M3 12a9 9 0 1 0 3-6.7L3 8' }], ['polyline', { points: '3 3 3 8 8 8' }], ['polyline', { points: '12 7 12 12 15.5 14' }]] },
        globe:       { stroke: true, nodes: [['circle', { cx: '12', cy: '12', r: '9.5' }], ['line', { x1: '2.5', y1: '12', x2: '21.5', y2: '12' }], ['path', { d: 'M12 2.5a14.5 14.5 0 0 1 3.8 9.5 14.5 14.5 0 0 1-3.8 9.5 14.5 14.5 0 0 1-3.8-9.5A14.5 14.5 0 0 1 12 2.5z' }]] },
        defaultMode: { stroke: true, nodes: [['circle', { cx: '12', cy: '12', r: '9' }], ['polygon', { points: '10 8.5 16 12 10 15.5 10 8.5', fill: 'currentColor' }]] },
        ordered:     { stroke: true, nodes: [['line', { x1: '9', y1: '6', x2: '20', y2: '6' }], ['line', { x1: '9', y1: '12', x2: '20', y2: '12' }], ['line', { x1: '9', y1: '18', x2: '20', y2: '18' }], ['circle', { cx: '4.5', cy: '6', r: '1.2', fill: 'currentColor' }], ['circle', { cx: '4.5', cy: '12', r: '1.2', fill: 'currentColor' }], ['circle', { cx: '4.5', cy: '18', r: '1.2', fill: 'currentColor' }]] },
        shuffle:     { stroke: true, nodes: [['polyline', { points: '16 3 21 3 21 8' }], ['line', { x1: '4', y1: '20', x2: '21', y2: '3' }], ['polyline', { points: '21 16 21 21 16 21' }], ['line', { x1: '15', y1: '15', x2: '21', y2: '21' }], ['line', { x1: '4', y1: '4', x2: '9', y2: '9' }]] },
        interleave:  { stroke: true, nodes: [['path', { d: 'M12 3l1.6 3.9L17.5 8.5l-3.9 1.6L12 14l-1.6-3.9L6.5 8.5l3.9-1.6L12 3z' }], ['path', { d: 'M5 17h14' }], ['path', { d: 'M8 21h8' }]] },
        search:      { stroke: true, nodes: [['circle', { cx: '11', cy: '11', r: '7' }], ['line', { x1: '20', y1: '20', x2: '16.2', y2: '16.2' }]] },
        trash:       { stroke: true, nodes: [['polyline', { points: '3 6 5 6 21 6' }], ['path', { d: 'M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6' }], ['path', { d: 'M10 11v6' }], ['path', { d: 'M14 11v6' }]] },
        closeSmall:  { stroke: true, nodes: [['line', { x1: '6', y1: '6', x2: '18', y2: '18' }], ['line', { x1: '18', y1: '6', x2: '6', y2: '18' }]] },
        playTri:     { stroke: false, nodes: [['path', { d: 'M5 4.623V19.38a1.5 1.5 0 002.26 1.29L22 12 7.26 3.33A1.5 1.5 0 005 4.623Z' }]] },
        gear:        { stroke: false, nodes: [['path', { d: 'M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z' }]] }
    };

    function makeSvg(def) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        if (def.stroke) {
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '1.9');
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');
        } else {
            svg.setAttribute('fill', 'currentColor');
        }
        for (const [tag, attrs] of def.nodes) {
            const el = document.createElementNS(SVG_NS, tag);
            for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
            svg.appendChild(el);
        }
        return svg;
    }

    // ---------- Çoklu Dil Sistemi ----------
    const I18N = {
        tr: {
            name: 'Türkçe', favTab: 'Favoriler', hiddenTab: 'Gizlenenler', onlyThisMix: 'Sadece bu mix', allMixes: 'Tüm mixler', history: 'Geçmiş',
            modeDefault: 'Varsayılan', modeNormal: 'Sıralı', modeShuffle: 'Karışık', modeInterleave: 'Aralı',
            descDefault: "YouTube'un kendi orijinal Mix sırası ve geçişleri kullanılır (özel sıralama devre dışı).",
            descNormal: 'Kaybolan şarkılar korunur; en yeni favori en üstte, ardından mixteki normal şarkılar sırayla çalar.',
            descShuffle: 'Favoriler sabit karışık sırada en üstte çalar (yeni şarkı eklense bile sıra bozulmaz), ardından normaller gelir.',
            descInterleave: '1-2 favori şarkının arasına mixten normal şarkılar sabit sırayla serpiştirilir.',
            searchFav: 'Favorilerde ara…', searchHidden: 'Gizlenenlerde ara…', searchHistory: 'Geçmişte ara…', noMatch: 'Eşleşen şarkı bulunamadı.',
            emptyFavMix: 'Bu mixte favori şarkı yok. Şarkıların üzerine gelip yıldızla ekleyebilirsin.', emptyFavAll: 'Henüz favori şarkı eklemedin.',
            emptyHiddenMix: 'Bu mixte gizlenen şarkı yok.', emptyHiddenAll: 'Gizlenen şarkı yok.',
            emptyHistFav: 'Favorilerden çıkarılan şarkı geçmişi boş.', emptyHistHidden: 'Gizlenenlerden geri getirilen şarkı geçmişi boş.',
            remove: 'Çıkar', restore: 'Geri getir', reAddFav: 'Tekrar ekle', reHide: 'Tekrar gizle',
            removeAllFav: 'Tüm favorileri kaldır', restoreAllHidden: 'Tümünü geri getir', clearHistory: 'Geçmişi temizle',
            hideFromMix: "Mix'ten gizle", addFavTip: 'Favorilere ekle (en üste taşır)', removeFavTip: 'Favorilerden çıkar',
            settingsTip: 'Favoriler & Gizlenen şarkılar', undo: 'Geri al', langAuto: 'Otomatik', langTitle: 'Dil seçimi',
            toastHidden: (t) => t ? `"${t}" gizlendi` : 'Şarkı gizlendi',
            toastFavAdded: (t) => t ? `"${t}" favorilere eklendi` : 'Favorilere eklendi',
            toastFavRemoved: (t) => t ? `"${t}" favorilerden çıkarıldı` : 'Favorilerden çıkarıldı'
        },
        en: {
            name: 'English', favTab: 'Favorites', hiddenTab: 'Hidden', onlyThisMix: 'This mix only', allMixes: 'All mixes', history: 'History',
            modeDefault: 'Default', modeNormal: 'Sequential', modeShuffle: 'Shuffle', modeInterleave: 'Interleave',
            descDefault: "Uses YouTube's native Mix order and transitions (custom queue disabled).",
            descNormal: 'Preserves unloaded songs; newest favorite at the top, followed by normal mix songs.',
            descShuffle: 'Plays favorites in a locked random order first, followed by normal mix songs.',
            descInterleave: 'Interleaves 1–2 shuffled favorites with normal songs from the mix.',
            searchFav: 'Search favorites…', searchHidden: 'Search hidden…', searchHistory: 'Search history…', noMatch: 'No matching songs found.',
            emptyFavMix: 'No favorites in this mix. Hover over a song and click the star to add.', emptyFavAll: 'No favorite songs added yet.',
            emptyHiddenMix: 'No hidden songs in this mix.', emptyHiddenAll: 'No hidden songs.',
            emptyHistFav: 'Removed favorites history is empty.', emptyHistHidden: 'Restored hidden songs history is empty.',
            remove: 'Remove', restore: 'Restore', reAddFav: 'Add again', reHide: 'Hide again',
            removeAllFav: 'Clear all favorites', restoreAllHidden: 'Restore all', clearHistory: 'Clear history',
            hideFromMix: 'Hide from Mix', addFavTip: 'Add to favorites (moves to top)', removeFavTip: 'Remove from favorites',
            settingsTip: 'Favorites & Hidden songs', undo: 'Undo', langAuto: 'Auto', langTitle: 'Language',
            toastHidden: (t) => t ? `Hidden "${t}"` : 'Song hidden',
            toastFavAdded: (t) => t ? `Added "${t}" to favorites` : 'Added to favorites',
            toastFavRemoved: (t) => t ? `Removed "${t}" from favorites` : 'Removed from favorites'
        },
        es: {
            name: 'Español', favTab: 'Favoritos', hiddenTab: 'Ocultos', onlyThisMix: 'Solo este mix', allMixes: 'Todos los mixes', history: 'Historial',
            modeDefault: 'Original', modeNormal: 'En orden', modeShuffle: 'Aleatorio', modeInterleave: 'Intercalado',
            descDefault: 'Usa el orden y las transiciones originales de YouTube Mix.',
            descNormal: 'El favorito más reciente arriba, luego las canciones normales del mix.',
            descShuffle: 'Reproduce primero los favoritos al azar y luego las canciones normales.',
            descInterleave: 'Intercala 1-2 favoritos con canciones normales del mix.',
            searchFav: 'Buscar en favoritos…', searchHidden: 'Buscar en ocultos…', searchHistory: 'Buscar en historial…', noMatch: 'No se encontraron canciones.',
            emptyFavMix: 'No hay favoritos en este mix.', emptyFavAll: 'Aún no has añadido favoritos.',
            emptyHiddenMix: 'No hay canciones ocultas en este mix.', emptyHiddenAll: 'No hay canciones ocultas.',
            emptyHistFav: 'El historial de favoritos eliminados está vacío.', emptyHistHidden: 'El historial de canciones restauradas está vacío.',
            remove: 'Quitar', restore: 'Restaurar', reAddFav: 'Añadir de nuevo', reHide: 'Ocultar de nuevo',
            removeAllFav: 'Quitar todos los favoritos', restoreAllHidden: 'Restaurar todo', clearHistory: 'Borrar historial',
            hideFromMix: 'Ocultar del Mix', addFavTip: 'Añadir a favoritos (subir al inicio)', removeFavTip: 'Quitar de favoritos',
            settingsTip: 'Favoritos y canciones ocultas', undo: 'Deshacer', langAuto: 'Automático', langTitle: 'Idioma',
            toastHidden: (t) => t ? `"${t}" oculta` : 'Canción oculta',
            toastFavAdded: (t) => t ? `"${t}" añadida a favoritos` : 'Añadida a favoritos',
            toastFavRemoved: (t) => t ? `"${t}" quitada de favoritos` : 'Quitada de favoritos'
        },
        de: {
            name: 'Deutsch', favTab: 'Favoriten', hiddenTab: 'Ausgeblendet', onlyThisMix: 'Nur dieser Mix', allMixes: 'Alle Mixe', history: 'Verlauf',
            modeDefault: 'Standard', modeNormal: 'Reihenfolge', modeShuffle: 'Zufall', modeInterleave: 'Gemischt',
            descDefault: 'Verwendet die originale YouTube-Mix-Reihenfolge.',
            descNormal: 'Neuester Favorit ganz oben, danach normale Songs aus dem Mix.',
            descShuffle: 'Spielt zuerst alle Favoriten zufällig ab, danach normale Songs.',
            descInterleave: 'Mischt nach 1–2 Favoriten jeweils einen normalen Mix-Song dazwischen.',
            searchFav: 'Favoriten durchsuchen…', searchHidden: 'Ausgeblendete suchen…', searchHistory: 'Verlauf durchsuchen…', noMatch: 'Keine passenden Songs gefunden.',
            emptyFavMix: 'Keine Favoriten in diesem Mix.', emptyFavAll: 'Noch keine Favoriten hinzugefügt.',
            emptyHiddenMix: 'Keine ausgeblendeten Songs in diesem Mix.', emptyHiddenAll: 'Keine ausgeblendeten Songs.',
            emptyHistFav: 'Verlauf entfernter Favoriten ist leer.', emptyHistHidden: 'Verlauf wiederhergestellter Songs ist leer.',
            remove: 'Entfernen', restore: 'Wiederherstellen', reAddFav: 'Erneut hinzufügen', reHide: 'Erneut ausblenden',
            removeAllFav: 'Alle Favoriten entfernen', restoreAllHidden: 'Alle wiederherstellen', clearHistory: 'Verlauf löschen',
            hideFromMix: 'Aus Mix ausblenden', addFavTip: 'Zu Favoriten hinzufügen (nach oben)', removeFavTip: 'Aus Favoriten entfernen',
            settingsTip: 'Favoriten & Ausgeblendete Songs', undo: 'Rückgängig', langAuto: 'Automatisch', langTitle: 'Sprache',
            toastHidden: (t) => t ? `„${t}“ ausgeblendet` : 'Song ausgeblendet',
            toastFavAdded: (t) => t ? `„${t}“ zu Favoriten hinzugefügt` : 'Zu Favoriten hinzugefügt',
            toastFavRemoved: (t) => t ? `„${t}“ aus Favoriten entfernt` : 'Aus Favoriten entfernt'
        },
        fr: {
            name: 'Français', favTab: 'Favoris', hiddenTab: 'Masqués', onlyThisMix: 'Ce mix uniquement', allMixes: 'Tous les mix', history: 'Historique',
            modeDefault: 'Défaut', modeNormal: 'Séquentiel', modeShuffle: 'Aléatoire', modeInterleave: 'Alterné',
            descDefault: "Utilise l'ordre original de YouTube Mix.",
            descNormal: 'Favori le plus récent en haut, suivi des titres normaux du mix.',
            descShuffle: 'Joue les favoris aléatoirement en premier, puis les titres normaux.',
            descInterleave: 'Alterne 1 à 2 favoris avec des titres normaux du mix.',
            searchFav: 'Rechercher dans les favoris…', searchHidden: 'Rechercher dans les masqués…', searchHistory: "Rechercher dans l'historique…", noMatch: 'Aucun titre trouvé.',
            emptyFavMix: 'Aucun favori dans ce mix.', emptyFavAll: 'Aucun favori ajouté.',
            emptyHiddenMix: 'Aucun titre masqué dans ce mix.', emptyHiddenAll: 'Aucun titre masqué.',
            emptyHistFav: 'Historique des favoris retirés vide.', emptyHistHidden: 'Historique des titres restaurés vide.',
            remove: 'Retirer', restore: 'Restaurer', reAddFav: 'Rajouter', reHide: 'Masquer à nouveau',
            removeAllFav: 'Supprimer tous les favoris', restoreAllHidden: 'Tout restaurer', clearHistory: "Effacer l'historique",
            hideFromMix: 'Masquer du Mix', addFavTip: 'Ajouter aux favoris (placer en haut)', removeFavTip: 'Retirer des favoris',
            settingsTip: 'Favoris et titres masqués', undo: 'Annuler', langAuto: 'Auto', langTitle: 'Langue',
            toastHidden: (t) => t ? `« ${t} » masqué` : 'Titre masqué',
            toastFavAdded: (t) => t ? `« ${t} » ajouté aux favoris` : 'Ajouté aux favoris',
            toastFavRemoved: (t) => t ? `« ${t} » retiré des favoris` : 'Retiré des favoris'
        },
        ru: {
            name: 'Русский', favTab: 'Избранное', hiddenTab: 'Скрытые', onlyThisMix: 'Только этот микс', allMixes: 'Все миксы', history: 'История',
            modeDefault: 'По умолч.', modeNormal: 'По порядку', modeShuffle: 'Перемешать', modeInterleave: 'Чередование',
            descDefault: 'Используется стандартный порядок YouTube Mix.',
            descNormal: 'Новые избранные сверху, затем обычные треки из микса.',
            descShuffle: 'Сначала избранные в случайном порядке, затем остальные треки.',
            descInterleave: 'Чередует 1–2 избранных трека с обычными треками микса.',
            searchFav: 'Поиск в избранном…', searchHidden: 'Поиск в скрытых…', searchHistory: 'Поиск в истории…', noMatch: 'Ничего не найдено.',
            emptyFavMix: 'В этом миксе нет избранных треков.', emptyFavAll: 'Избранных треков пока нет.',
            emptyHiddenMix: 'В этом миксе нет скрытых треков.', emptyHiddenAll: 'Нет скрытых треков.',
            emptyHistFav: 'История удалённых из избранного пуста.', emptyHistHidden: 'История восстановленных треков пуста.',
            remove: 'Удалить', restore: 'Вернуть', reAddFav: 'Добавить снова', reHide: 'Скрыть снова',
            removeAllFav: 'Очистить избранное', restoreAllHidden: 'Вернуть все', clearHistory: 'Очистить историю',
            hideFromMix: 'Скрыть из микса', addFavTip: 'В избранное (наверх списка)', removeFavTip: 'Убрать из избранного',
            settingsTip: 'Избранное и скрытые треки', undo: 'Отменить', langAuto: 'Авто', langTitle: 'Язык',
            toastHidden: (t) => t ? `«${t}» скрыто` : 'Трек скрыт',
            toastFavAdded: (t) => t ? `«${t}» в избранном` : 'Добавлено в избранное',
            toastFavRemoved: (t) => t ? `«${t}» удалено из избранного` : 'Удалено из избранного'
        },
        pt: {
            name: 'Português', favTab: 'Favoritos', hiddenTab: 'Ocultos', onlyThisMix: 'Apenas este mix', allMixes: 'Todos os mixes', history: 'Histórico',
            modeDefault: 'Padrão', modeNormal: 'Sequencial', modeShuffle: 'Aleatório', modeInterleave: 'Intercalado',
            descDefault: 'Usa a ordem padrão original do YouTube Mix.',
            descNormal: 'Favorito mais recente no topo, seguido pelas músicas normais do mix.',
            descShuffle: 'Toca primeiro os favoritos aleatoriamente e depois as músicas normais.',
            descInterleave: 'Intercala 1–2 favoritos com músicas normais do mix.',
            searchFav: 'Pesquisar favoritos…', searchHidden: 'Pesquisar ocultos…', searchHistory: 'Pesquisar histórico…', noMatch: 'Nenhuma música encontrada.',
            emptyFavMix: 'Sem favoritos neste mix.', emptyFavAll: 'Nenhum favorito adicionado.',
            emptyHiddenMix: 'Sem músicas ocultas neste mix.', emptyHiddenAll: 'Sem músicas ocultas.',
            emptyHistFav: 'Histórico de favoritos removidos vazio.', emptyHistHidden: 'Histórico de músicas restauradas vazio.',
            remove: 'Remover', restore: 'Restaurar', reAddFav: 'Adicionar novamente', reHide: 'Ocultar novamente',
            removeAllFav: 'Limpar favoritos', restoreAllHidden: 'Restaurar tudo', clearHistory: 'Limpar histórico',
            hideFromMix: 'Ocultar do Mix', addFavTip: 'Adicionar aos favoritos (mover para o topo)', removeFavTip: 'Remover dos favoritos',
            settingsTip: 'Favoritos e músicas ocultas', undo: 'Desfazer', langAuto: 'Auto', langTitle: 'Idioma',
            toastHidden: (t) => t ? `"${t}" ocultada` : 'Música ocultada',
            toastFavAdded: (t) => t ? `"${t}" nos favoritos` : 'Adicionada aos favoritos',
            toastFavRemoved: (t) => t ? `"${t}" removida dos favoritos` : 'Removida dos favoritos'
        },
        it: {
            name: 'Italiano', favTab: 'Preferiti', hiddenTab: 'Nascosti', onlyThisMix: 'Solo questo mix', allMixes: 'Tutti i mix', history: 'Cronologia',
            modeDefault: 'Predefinito', modeNormal: 'In ordine', modeShuffle: 'Casuale', modeInterleave: 'Alternato',
            descDefault: "Usa l'ordine originale di YouTube Mix.",
            descNormal: 'Il preferito più recente in alto, poi i brani normali del mix.',
            descShuffle: 'Riproduce prima i preferiti in ordine casuale, poi i brani normali.',
            descInterleave: 'Alterna 1–2 preferiti con brani normali del mix.',
            searchFav: 'Cerca nei preferiti…', searchHidden: 'Cerca nei nascosti…', searchHistory: 'Cerca nella cronologia…', noMatch: 'Nessun brano trovato.',
            emptyFavMix: 'Nessun preferito in questo mix.', emptyFavAll: 'Nessun preferito aggiunto.',
            emptyHiddenMix: 'Nessun brano nascosto in questo mix.', emptyHiddenAll: 'Nessun brano nascosto.',
            emptyHistFav: 'Cronologia preferiti rimossi vuota.', emptyHistHidden: 'Cronologia brani ripristinati vuota.',
            remove: 'Rimuovi', restore: 'Ripristina', reAddFav: 'Riaggiungi', reHide: 'Nascondi di nuovo',
            removeAllFav: 'Rimuovi tutti i preferiti', restoreAllHidden: 'Ripristina tutto', clearHistory: 'Cancella cronologia',
            hideFromMix: 'Nascondi dal Mix', addFavTip: 'Aggiungi ai preferiti (sposta in alto)', removeFavTip: 'Rimuovi dai preferiti',
            settingsTip: 'Preferiti e brani nascosti', undo: 'Annulla', langAuto: 'Auto', langTitle: 'Lingua',
            toastHidden: (t) => t ? `"${t}" nascosto` : 'Brano nascosto',
            toastFavAdded: (t) => t ? `"${t}" aggiunto ai preferiti` : 'Aggiunto ai preferiti',
            toastFavRemoved: (t) => t ? `"${t}" rimosso dai preferiti` : 'Rimosso dai preferiti'
        },
        az: {
            name: 'Azərbaycanca', favTab: 'Sevimlilər', hiddenTab: 'Gizlədilənlər', onlyThisMix: 'Yalnız bu miks', allMixes: 'Bütün mikslər', history: 'Tarixçə',
            modeDefault: 'Standart', modeNormal: 'Ardıcıl', modeShuffle: 'Qarışıq', modeInterleave: 'Aralı',
            descDefault: 'YouTube-un öz orijinal Miks sıralaması istifadə olunur.',
            descNormal: 'Ən yeni sevimli ən üstdə, ardınca miksdəki normal mahnılar oxunur.',
            descShuffle: 'Əvvəlcə sevimlilər qarışıq oxunur, sonra normal mahnılar gəlir.',
            descInterleave: '1-2 sevimli mahnının arasına miksdən normal mahnılar əlavə edilir.',
            searchFav: 'Sevimlilərdə axtar…', searchHidden: 'Gizlədilənlərdə axtar…', searchHistory: 'Tarixçədə axtar…', noMatch: 'Uyğun mahnı tapılmadı.',
            emptyFavMix: 'Bu miksdə sevimli mahnı yoxdur.', emptyFavAll: 'Hələ sevimli mahnı əlavə etməmisiniz.',
            emptyHiddenMix: 'Bu miksdə gizlədilən mahnı yoxdur.', emptyHiddenAll: 'Gizlədilən mahnı yoxdur.',
            emptyHistFav: 'Silinən sevimlilər tarixçəsi boşdur.', emptyHistHidden: 'Bərpa edilən mahnılar tarixçəsi boşdur.',
            remove: 'Çıxar', restore: 'Geri qaytar', reAddFav: 'Yenidən əlavə et', reHide: 'Yenidən gizlət',
            removeAllFav: 'Bütün sevimliləri sil', restoreAllHidden: 'Hamısını geri qaytar', clearHistory: 'Tarixçəni təmizlə',
            hideFromMix: 'Miksdən gizlət', addFavTip: 'Sevimlilərə əlavə et (ən üstə daşı)', removeFavTip: 'Sevimlilərdən çıxar',
            settingsTip: 'Sevimlilər və Gizlədilənlər', undo: 'Geri al', langAuto: 'Avtomatik', langTitle: 'Dil',
            toastHidden: (t) => t ? `"${t}" gizlədildi` : 'Mahnı gizlədildi',
            toastFavAdded: (t) => t ? `"${t}" sevimlilərə əlavə edildi` : 'Sevimlilərə əlavə edildi',
            toastFavRemoved: (t) => t ? `"${t}" sevimlilərdən çıxarıldı` : 'Sevimlilərdən çıxarıldı'
        },
        ar: {
            name: 'العربية', favTab: 'المفضلة', hiddenTab: 'المخفية', onlyThisMix: 'هذا الميكس فقط', allMixes: 'كل الميكسات', history: 'السجل',
            modeDefault: 'افتراضي', modeNormal: 'بالترتيب', modeShuffle: 'عشوائي', modeInterleave: 'مدمج',
            descDefault: 'يستخدم ترتيب يوتيوب الأصلي للميكس.',
            descNormal: 'الأحدث في المفضلة بالأعلى، ثم الأغاني العادية في الميكس.',
            descShuffle: 'تشغيل المفضلة عشوائياً أولاً، ثم الأغاني العادية.',
            descInterleave: 'يدمج أغنية عادية بين كل 1-2 من الأغاني المفضلة.',
            searchFav: 'ابحث في المفضلة…', searchHidden: 'ابحث في المخفية…', searchHistory: 'ابحث في السجل…', noMatch: 'لم يتم العثور على أغانٍ مطابقة.',
            emptyFavMix: 'لا توجد أغانٍ مفضلة في هذا الميكس.', emptyFavAll: 'لم تضف أي أغانٍ مفضلة بعد.',
            emptyHiddenMix: 'لا توجد أغانٍ مخفية في هذا الميكس.', emptyHiddenAll: 'لا توجد أغانٍ مخفية.',
            emptyHistFav: 'سجل المفضلة المحذوفة فارغ.', emptyHistHidden: 'سجل الأغاني المستعادة فارغ.',
            remove: 'إزالة', restore: 'استعادة', reAddFav: 'إضافة مجدداً', reHide: 'إخفاء مجدداً',
            removeAllFav: 'مسح كل المفضلة', restoreAllHidden: 'استعادة الكل', clearHistory: 'مسح السجل',
            hideFromMix: 'إخفاء من الميكس', addFavTip: 'إضافة للمفضلة (نقل للأعلى)', removeFavTip: 'إزالة من المفضلة',
            settingsTip: 'المفضلة والأغاني المخفية', undo: 'تراجع', langAuto: 'تلقائي', langTitle: 'اللغة',
            toastHidden: (t) => t ? `تم إخفاء "${t}"` : 'تم إخفاء الأغنية',
            toastFavAdded: (t) => t ? `تمت إضافة "${t}" للمفضلة` : 'تمت الإضافة للمفضلة',
            toastFavRemoved: (t) => t ? `تمت إزالة "${t}" من المفضلة` : 'تمت الإزالة من المفضلة'
        },
        ja: {
            name: '日本語', favTab: 'お気に入り', hiddenTab: '非表示', onlyThisMix: 'このミックスのみ', allMixes: 'すべてのミックス', history: '履歴',
            modeDefault: '標準', modeNormal: '順番', modeShuffle: 'シャッフル', modeInterleave: '交互',
            descDefault: 'YouTube標準のミックス順序を使用します。',
            descNormal: '最新のお気に入りを最上部に配置し、その後に通常の曲を再生します。',
            descShuffle: 'お気に入りをランダムに再生した後、通常の曲を再生します。',
            descInterleave: 'お気に入り1〜2曲ごとにミックスの通常曲を挟んで再生します。',
            searchFav: 'お気に入りを検索…', searchHidden: '非表示を検索…', searchHistory: '履歴を検索…', noMatch: '一致する曲が見つかりません。',
            emptyFavMix: 'このミックスにはお気に入りがありません。', emptyFavAll: 'お気に入りはまだありません。',
            emptyHiddenMix: 'このミックスに非表示の曲はありません。', emptyHiddenAll: '非表示の曲はありません。',
            emptyHistFav: '削除したお気に入りの履歴はありません。', emptyHistHidden: '復元した曲の履歴はありません。',
            remove: '削除', restore: '元に戻す', reAddFav: '再追加', reHide: '再非表示',
            removeAllFav: 'すべて削除', restoreAllHidden: 'すべて元に戻す', clearHistory: '履歴を消去',
            hideFromMix: 'ミックスから非表示', addFavTip: 'お気に入りに追加（最上部へ移動）', removeFavTip: 'お気に入りから削除',
            settingsTip: 'お気に入り＆非表示の曲', undo: '元に戻す', langAuto: '自動', langTitle: '言語',
            toastHidden: (t) => t ? `「${t}」を非表示にしました` : '曲を非表示にしました',
            toastFavAdded: (t) => t ? `「${t}」をお気に入りに追加` : 'お気に入りに追加しました',
            toastFavRemoved: (t) => t ? `「${t}」をお気に入りから削除` : 'お気に入りから削除しました'
        },
        ko: {
            name: '한국어', favTab: '즐겨찾기', hiddenTab: '숨김', onlyThisMix: '이 믹스에서만', allMixes: '모든 믹스', history: '기록',
            modeDefault: '기본', modeNormal: '순차', modeShuffle: '셔플', modeInterleave: '교차',
            descDefault: 'YouTube 기본 믹스 순서를 사용합니다.',
            descNormal: '최근 추가한 즐겨찾기가 맨 위에 오고, 이후 일반 곡이 재생됩니다.',
            descShuffle: '즐겨찾기를 먼저 무작위로 재생한 뒤 일반 곡을 재생합니다.',
            descInterleave: '즐겨찾기 1~2곡마다 일반 곡을 섞어 재생합니다.',
            searchFav: '즐겨찾기 검색…', searchHidden: '숨긴 곡 검색…', searchHistory: '기록 검색…', noMatch: '일치하는 곡이 없습니다.',
            emptyFavMix: '이 믹스에 즐겨찾기한 곡이 없습니다.', emptyFavAll: '아직 즐겨찾기한 곡이 없습니다.',
            emptyHiddenMix: '이 믹스에 숨긴 곡이 없습니다.', emptyHiddenAll: '숨긴 곡이 없습니다.',
            emptyHistFav: '삭제된 즐겨찾기 기록이 없습니다.', emptyHistHidden: '복원된 곡 기록이 없습니다.',
            remove: '제거', restore: '복원', reAddFav: '다시 추가', reHide: '다시 숨기기',
            removeAllFav: '즐겨찾기 모두 삭제', restoreAllHidden: '모두 복원', clearHistory: '기록 지우기',
            hideFromMix: '믹스에서 숨기기', addFavTip: '즐겨찾기에 추가 (맨 위로 이동)', removeFavTip: '즐겨찾기에서 제거',
            settingsTip: '즐겨찾기 및 숨긴 곡', undo: '실행 취소', langAuto: '자동', langTitle: '언어',
            toastHidden: (t) => t ? `"${t}" 숨김 처리됨` : '곡이 숨겨졌습니다',
            toastFavAdded: (t) => t ? `"${t}" 즐겨찾기에 추가됨` : '즐겨찾기에 추가됨',
            toastFavRemoved: (t) => t ? `"${t}" 즐겨찾기에서 제거됨` : '즐겨찾기에서 제거됨'
        },
        zh: {
            name: '中文', favTab: '收藏夹', hiddenTab: '已隐藏', onlyThisMix: '仅此合辑', allMixes: '所有合辑', history: '历史记录',
            modeDefault: '默认', modeNormal: '顺序', modeShuffle: '随机', modeInterleave: '穿插',
            descDefault: '使用 YouTube 原生合辑播放顺序。',
            descNormal: '最新收藏置顶，旧收藏靠后，随后播放合辑中的普通歌曲。',
            descShuffle: '先随机播放所有收藏歌曲，随后播放普通歌曲。',
            descInterleave: '每播放 1–2 首收藏歌曲，自动穿插一首合辑中的普通歌曲。',
            searchFav: '搜索收藏…', searchHidden: '搜索已隐藏…', searchHistory: '搜索历史记录…', noMatch: '未找到匹配的歌曲。',
            emptyFavMix: '此合辑暂无收藏歌曲。', emptyFavAll: '尚未添加收藏歌曲。',
            emptyHiddenMix: '此合辑中没有隐藏歌曲。', emptyHiddenAll: '没有隐藏的歌曲。',
            emptyHistFav: '已移除的收藏历史为空。', emptyHistHidden: '已恢复的隐藏历史为空。',
            remove: '移除', restore: '恢复', reAddFav: '重新添加', reHide: '重新隐藏',
            removeAllFav: '清空所有收藏', restoreAllHidden: '全部恢复', clearHistory: '清空历史记录',
            hideFromMix: '从合辑中隐藏', addFavTip: '添加到收藏（置顶）', removeFavTip: '从收藏中移除',
            settingsTip: '收藏与隐藏歌曲', undo: '撤销', langAuto: '自动', langTitle: '语言',
            toastHidden: (t) => t ? `已隐藏“${t}”` : '已隐藏歌曲',
            toastFavAdded: (t) => t ? `已将“${t}”添加到收藏` : '已添加到收藏',
            toastFavRemoved: (t) => t ? `已将“${t}”移出收藏` : '已从收藏中移除'
        },
        nl: {
            name: 'Nederlands', favTab: 'Favorieten', hiddenTab: 'Verborgen', onlyThisMix: 'Alleen deze mix', allMixes: 'Alle mixen', history: 'Geschiedenis',
            modeDefault: 'Standaard', modeNormal: 'Volgorde', modeShuffle: 'Willekeurig', modeInterleave: 'Afwisselend',
            descDefault: 'Gebruikt de standaard YouTube Mix-volgorde.',
            descNormal: 'Nieuwste favoriet bovenaan, gevolgd door normale nummers.',
            descShuffle: 'Speelt eerst favorieten willekeurig af, daarna normale nummers.',
            descInterleave: 'Wisselt 1–2 favorieten af met normale nummers uit de mix.',
            searchFav: 'Zoek in favorieten…', searchHidden: 'Zoek in verborgen…', searchHistory: 'Zoek in geschiedenis…', noMatch: 'Geen nummers gevonden.',
            emptyFavMix: 'Geen favorieten in deze mix.', emptyFavAll: 'Nog geen favorieten toegevoegd.',
            emptyHiddenMix: 'Geen verborgen nummers in deze mix.', emptyHiddenAll: 'Geen verborgen nummers.',
            emptyHistFav: 'Geschiedenis van verwijderde favorieten is leeg.', emptyHistHidden: 'Geschiedenis van herstelde nummers is leeg.',
            remove: 'Verwijderen', restore: 'Herstellen', reAddFav: 'Opnieuw toevoegen', reHide: 'Opnieuw verbergen',
            removeAllFav: 'Alle favorieten wissen', restoreAllHidden: 'Alles herstellen', clearHistory: 'Geschiedenis wissen',
            hideFromMix: 'Verbergen uit Mix', addFavTip: 'Toevoegen aan favorieten (bovenaan)', removeFavTip: 'Verwijderen uit favorieten',
            settingsTip: 'Favorieten & Verborgen nummers', undo: 'Ongedaan maken', langAuto: 'Auto', langTitle: 'Taal',
            toastHidden: (t) => t ? `"${t}" verborgen` : 'Nummer verborgen',
            toastFavAdded: (t) => t ? `"${t}" toegevoegd aan favorieten` : 'Toegevoegd aan favorieten',
            toastFavRemoved: (t) => t ? `"${t}" verwijderd uit favorieten` : 'Verwijderd uit favorieten'
        },
        pl: {
            name: 'Polski', favTab: 'Ulubione', hiddenTab: 'Ukryte', onlyThisMix: 'Tylko ten miks', allMixes: 'Wszystkie miksy', history: 'Historia',
            modeDefault: 'Domyślny', modeNormal: 'Kolejno', modeShuffle: 'Losowo', modeInterleave: 'Przeplatane',
            descDefault: 'Używa oryginalnej kolejności YouTube Mix.',
            descNormal: 'Najnowsze ulubione na górze, potem zwykłe utwory z miksu.',
            descShuffle: 'Najpierw odtwarza losowo ulubione, a potem zwykłe utwory.',
            descInterleave: 'Przeplata 1–2 ulubione utwory ze zwykłymi utworami z miksu.',
            searchFav: 'Szukaj w ulubionych…', searchHidden: 'Szukaj w ukrytych…', searchHistory: 'Szukaj w historii…', noMatch: 'Nie znaleziono utworów.',
            emptyFavMix: 'Brak ulubionych w tym miksie.', emptyFavAll: 'Nie dodano jeszcze ulubionych.',
            emptyHiddenMix: 'Brak ukrytych utworów w tym miksie.', emptyHiddenAll: 'Brak ukrytych utworów.',
            emptyHistFav: 'Historia usuniętych ulubionych jest pusta.', emptyHistHidden: 'Historia przywróconych utworów jest pusta.',
            remove: 'Usuń', restore: 'Przywróć', reAddFav: 'Dodaj ponownie', reHide: 'Ukryj ponownie',
            removeAllFav: 'Usuń wszystkie ulubione', restoreAllHidden: 'Przywróć wszystko', clearHistory: 'Wyczyść historię',
            hideFromMix: 'Ukryj z miksu', addFavTip: 'Dodaj do ulubionych (przenieś na górę)', removeFavTip: 'Usuń z ulubionych',
            settingsTip: 'Ulubione i ukryte utwory', undo: 'Cofnij', langAuto: 'Auto', langTitle: 'Język',
            toastHidden: (t) => t ? `Ukryto „${t}”` : 'Ukryto utwór',
            toastFavAdded: (t) => t ? `Dodano „${t}” do ulubionych` : 'Dodano do ulubionych',
            toastFavRemoved: (t) => t ? `Usunięto „${t}” z ulubionych` : 'Usunięto z ulubionych'
        },
        uk: {
            name: 'Українська', favTab: 'Обране', hiddenTab: 'Приховані', onlyThisMix: 'Лише цей мікс', allMixes: 'Усі мікси', history: 'Історія',
            modeDefault: 'Стандарт', modeNormal: 'По черзі', modeShuffle: 'Перемішати', modeInterleave: 'Чергування',
            descDefault: 'Використовує стандартний порядок YouTube Mix.',
            descNormal: 'Нові обрані зверху, далі звичайні треки з міксу.',
            descShuffle: 'Спочатку обрані випадково, потім звичайні треки.',
            descInterleave: 'Чергує 1–2 обрані треки зі звичайними треками міксу.',
            searchFav: 'Пошук в обраному…', searchHidden: 'Пошук у прихованих…', searchHistory: 'Пошук в історії…', noMatch: 'Пісень не знайдено.',
            emptyFavMix: 'У цьому міксі немає обраних пісень.', emptyFavAll: 'Ви ще не додали обраних пісень.',
            emptyHiddenMix: 'У цьому міксі немає прихованих пісень.', emptyHiddenAll: 'Немає прихованих пісень.',
            emptyHistFav: 'Історія видалених з обраного порожня.', emptyHistHidden: 'Історія відновлених пісень порожня.',
            remove: 'Видалити', restore: 'Відновити', reAddFav: 'Додати знову', reHide: 'Приховати знову',
            removeAllFav: 'Очистити обране', restoreAllHidden: 'Відновити все', clearHistory: 'Очистити історію',
            hideFromMix: 'Приховати з міксу', addFavTip: 'Додати в обране (на початок)', removeFavTip: 'Видалити з обраного',
            settingsTip: 'Обране та приховані пісні', undo: 'Скасувати', langAuto: 'Авто', langTitle: 'Мова',
            toastHidden: (t) => t ? `«${t}» приховано` : 'Пісню приховано',
            toastFavAdded: (t) => t ? `«${t}» додано в обране` : 'Додано в обране',
            toastFavRemoved: (t) => t ? `«${t}» видалено з обраного` : 'Видалено з обраного'
        },
        hi: {
            name: 'हिन्दी', favTab: 'पसंदीदा', hiddenTab: 'छिपाए गए', onlyThisMix: 'केवल यह मिक्स', allMixes: 'सभी मिक्स', history: 'इतिहास',
            modeDefault: 'डिफ़ॉल्ट', modeNormal: 'क्रम से', modeShuffle: 'शफ़ल', modeInterleave: 'मिश्रित',
            descDefault: 'YouTube के मूल मिक्स क्रम का उपयोग करता है।',
            descNormal: 'नवीनतम पसंदीदा सबसे ऊपर, उसके बाद सामान्य गाने बजेंगे।',
            descShuffle: 'पहले सभी पसंदीदा गाने रैंडम क्रम में, फिर सामान्य गाने।',
            descInterleave: 'हर 1-2 पसंदीदा गानों के बीच एक सामान्य गाना बजाता है।',
            searchFav: 'पसंदीदा में खोजें…', searchHidden: 'छिपाए गए में खोजें…', searchHistory: 'इतिहास में खोजें…', noMatch: 'कोई मिलान नहीं मिला।',
            emptyFavMix: 'इस मिक्स में कोई पसंदीदा गाना नहीं है।', emptyFavAll: 'अभी तक कोई पसंदीदा गाना नहीं जोड़ा गया।',
            emptyHiddenMix: 'इस मिक्स में कोई छिपा गाना नहीं है।', emptyHiddenAll: 'कोई छिपा गाना नहीं है।',
            emptyHistFav: 'हटाए गए पसंदीदा का इतिहास खाली है।', emptyHistHidden: 'वापस लाए गए गानों का इतिहास खाली है।',
            remove: 'हटाएं', restore: 'वापस लाएं', reAddFav: 'फिर से जोड़ें', reHide: 'फिर से छिपाएं',
            removeAllFav: 'सभी पसंदीदा हटाएं', restoreAllHidden: 'सभी वापस लाएं', clearHistory: 'इतिहास साफ़ करें',
            hideFromMix: 'मिक्स से छिपाएं', addFavTip: 'पसंदीदा में जोड़ें (सबसे ऊपर)', removeFavTip: 'पसंदीदा से हटाएं',
            settingsTip: 'पसंदीदा और छिपाए गए गाने', undo: 'पूर्ववत करें', langAuto: 'ऑटो', langTitle: 'भाषा',
            toastHidden: (t) => t ? `"${t}" को छिपाया गया` : 'गाना छिपाया गया',
            toastFavAdded: (t) => t ? `"${t}" पसंदीदा में जोड़ा गया` : 'पसंदीदा में जोड़ा गया',
            toastFavRemoved: (t) => t ? `"${t}" पसंदीदा से हटाया गया` : 'पसंदीदा से हटाया गया'
        },
        id: {
            name: 'Indonesia', favTab: 'Favorit', hiddenTab: 'Disembunyikan', onlyThisMix: 'Mix ini saja', allMixes: 'Semua mix', history: 'Riwayat',
            modeDefault: 'Bawaan', modeNormal: 'Berurutan', modeShuffle: 'Acak', modeInterleave: 'Selang-seling',
            descDefault: 'Menggunakan urutan asli YouTube Mix.',
            descNormal: 'Favorit terbaru di paling atas, diikuti lagu normal dari mix.',
            descShuffle: 'Putar semua favorit secara acak lebih dulu, lalu lagu normal.',
            descInterleave: 'Selingi setiap 1–2 lagu favorit dengan lagu normal dari mix.',
            searchFav: 'Cari favorit…', searchHidden: 'Cari yang disembunyikan…', searchHistory: 'Cari riwayat…', noMatch: 'Lagu tidak ditemukan.',
            emptyFavMix: 'Belum ada favorit di mix ini.', emptyFavAll: 'Belum ada lagu favorit.',
            emptyHiddenMix: 'Tidak ada lagu yang disembunyikan di mix ini.', emptyHiddenAll: 'Tidak ada lagu yang disembunyikan.',
            emptyHistFav: 'Riwayat favorit yang dihapus kosong.', emptyHistHidden: 'Riwayat lagu yang dipulihkan kosong.',
            remove: 'Hapus', restore: 'Pulihkan', reAddFav: 'Tambah lagi', reHide: 'Sembunyikan lagi',
            removeAllFav: 'Hapus semua favorit', restoreAllHidden: 'Pulihkan semua', clearHistory: 'Hapus riwayat',
            hideFromMix: 'Sembunyikan dari Mix', addFavTip: 'Tambah ke favorit (pindah ke atas)', removeFavTip: 'Hapus dari favorit',
            settingsTip: 'Favorit & Lagu disembunyikan', undo: 'Urungkan', langAuto: 'Otomatis', langTitle: 'Bahasa',
            toastHidden: (t) => t ? `"${t}" disembunyikan` : 'Lagu disembunyikan',
            toastFavAdded: (t) => t ? `"${t}" ditambahkan ke favorit` : 'Ditambahkan ke favorit',
            toastFavRemoved: (t) => t ? `"${t}" dihapus dari favorit` : 'Dihapus dari favorit'
        }
    };

    let langPref = (() => {
        try {
            const v = localStorage.getItem(LANG_KEY);
            return v && (v === 'auto' || I18N[v]) ? v : 'auto';
        } catch { return 'auto'; }
    })();

    function detectHtmlLang() {
        const raw = document.documentElement?.getAttribute('lang') || window.ytcfg?.get?.('HL') || navigator.language || 'tr';
        const base = String(raw).trim().toLowerCase().split(/[-_]/)[0];
        return I18N[base] ? base : 'en';
    }

    const activeLangCode = () => (langPref === 'auto' ? detectHtmlLang() : (I18N[langPref] ? langPref : 'tr'));
    const L = () => I18N[activeLangCode()] || I18N.tr;

    // ---------- Yardımcı Seçiciler ----------
    const isMixPage = () =>
        location.pathname === '/watch' &&
        (new URLSearchParams(location.search).get('list') || '').startsWith('RD');

    const currentVideoId = () => new URLSearchParams(location.search).get('v');
    const panelEl = () => document.querySelector('ytd-playlist-panel-renderer#playlist');
    const itemsContainer = (panel) => panel?.querySelector('#items.playlist-items, #items');
    const itemsOf = (panel) => [...panel.querySelectorAll(ITEM_SEL)];
    const mainVideo = () => document.querySelector('#movie_player video');
    const isMainVideo = (el) => el instanceof HTMLVideoElement && !!el.closest('#movie_player');
    const adShowing = () => !!document.querySelector('#movie_player.ad-showing');

    const idOf = (item) => {
        if (!item) return null;
        if (item.dataset?.vid) return item.dataset.vid;
        const direct = item.data?.videoId;
        if (typeof direct === 'string' && direct) return direct;
        const a = item.querySelector(LINK_SEL);
        if (!a) return null;
        try { return new URL(a.href, location.origin).searchParams.get('v'); }
        catch { return null; }
    };

    const titleOf = (item) => (item?.querySelector('#video-title')?.textContent || '').trim();
    const bylineOf = (item) => (item?.querySelector('#byline')?.textContent || '').trim();
    const durOf = (item) => (item?.querySelector('.ytBadgeShapeText, ytd-thumbnail-overlay-time-status-renderer #text')?.textContent || '').trim();

    // ---------- Kalıcı Depolama (Gizlenenler + Favoriler + Geçmiş + Mix Havuzu) ----------
    let store      = loadBucket(STORE_KEY, false);
    let favStore   = loadBucket(FAV_STORE_KEY, true);
    let histHidden = loadHistory(HIST_HIDDEN_KEY);
    let histFav    = loadHistory(HIST_FAV_KEY);
    let mixPool    = loadPool();

    function normalizeFavVal(val, fallbackTs) {
        if (val && typeof val === 'object' && 't' in val) {
            return {
                t: String(val.t || ''),
                by: String(val.by || ''),
                dur: String(val.dur || ''),
                ts: Number(val.ts) || fallbackTs
            };
        }
        return { t: typeof val === 'string' ? val : '', by: '', dur: '', ts: fallbackTs };
    }

    function loadBucket(storageKey, isFavBucket) {
        try {
            const s = JSON.parse(localStorage.getItem(storageKey));
            const obj = s && typeof s === 'object' ? s : {};
            let step = 1;
            for (const [k, v] of Object.entries(obj)) {
                if (!v?.ids || typeof v.ids !== 'object') continue;
                if (isFavBucket) {
                    for (const [id, raw] of Object.entries(v.ids)) v.ids[id] = normalizeFavVal(raw, step++);
                }
                if (k === GLOBAL_KEY) continue;
                const all = (obj[GLOBAL_KEY] ||= { ts: 0, ids: {} });
                for (const [id, val] of Object.entries(v.ids)) {
                    if (!all.ids[id]) all.ids[id] = isFavBucket ? { ...val } : val;
                    else if (isFavBucket && (val.ts || 0) > (all.ids[id].ts || 0)) all.ids[id] = { ...val };
                }
            }
            return obj;
        } catch { return {}; }
    }

    function loadPool() {
        try {
            const s = JSON.parse(sessionStorage.getItem(POOL_STORE_KEY));
            return s && typeof s === 'object' ? s : {};
        } catch { return {}; }
    }

    function savePool() {
        try {
            const keys = Object.keys(mixPool);
            if (keys.length > MAX_POOL_MIXES) {
                keys.sort((a, b) => (mixPool[a].ts || 0) - (mixPool[b].ts || 0))
                    .slice(0, keys.length - MAX_POOL_MIXES)
                    .forEach((k) => delete mixPool[k]);
            }
            sessionStorage.setItem(POOL_STORE_KEY, JSON.stringify(mixPool));
        } catch { /* yoksay */ }
    }

    function loadHistory(storageKey) {
        try {
            const arr = JSON.parse(localStorage.getItem(storageKey));
            return Array.isArray(arr) ? arr.filter((x) => x && typeof x.id === 'string') : [];
        } catch { return []; }
    }

    function saveHistory(storageKey, arr) {
        try {
            if (arr.length > MAX_HISTORY) arr.length = MAX_HISTORY;
            localStorage.setItem(storageKey, JSON.stringify(arr));
        } catch { /* yoksay */ }
    }

    function pushHistory(list, storageKey, id, title) {
        if (!id) return;
        const cleanTitle = (typeof title === 'string' && title && title !== '1') ? title : `Video ${id}`;
        const existingIdx = list.findIndex((x) => x.id === id);
        if (existingIdx >= 0) list.splice(existingIdx, 1);
        list.unshift({ id, t: cleanTitle, ts: Date.now() });
        saveHistory(storageKey, list);
    }

    function removeFromHistory(list, storageKey, id) {
        const idx = list.findIndex((x) => x.id === id);
        if (idx >= 0) {
            list.splice(idx, 1);
            saveHistory(storageKey, list);
        }
    }

    function trimAndSave(storageKey, obj) {
        try {
            for (const k of Object.keys(obj)) {
                if (!obj[k]?.ids || Object.keys(obj[k].ids).length === 0) delete obj[k];
            }
            const keys = Object.keys(obj).filter((k) => k !== GLOBAL_KEY);
            if (keys.length > MAX_SCOPES) {
                keys.sort((a, b) => (obj[a].ts || 0) - (obj[b].ts || 0))
                    .slice(0, keys.length - MAX_SCOPES)
                    .forEach((k) => delete obj[k]);
            }
            localStorage.setItem(storageKey, JSON.stringify(obj));
        } catch { /* depolama kapalıysa sessizce geç */ }
    }

    const syncChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('ytmixfix_sync') : null;

    function saveStore() { trimAndSave(STORE_KEY, store); syncChannel?.postMessage('sync'); }
    function saveFavStore() { trimAndSave(FAV_STORE_KEY, favStore); syncChannel?.postMessage('sync'); }

    let scopeMode = (() => {
        try {
            const v = localStorage.getItem(SCOPE_KEY);
            return v === 'global' || v === 'mix' || v === 'history' ? v : DEFAULT_SCOPE;
        } catch { return DEFAULT_SCOPE; }
    })();

    let activeTab = (() => {
        try {
            const v = localStorage.getItem(TAB_KEY);
            return v === 'fav' || v === 'hidden' ? v : 'fav';
        } catch { return 'fav'; }
    })();

    let favMode = (() => {
        try {
            const v = localStorage.getItem(FAV_MODE_KEY);
            return v === 'default' || v === 'normal' || v === 'shuffle' || v === 'interleave' ? v : 'normal';
        } catch { return 'normal'; }
    })();

    let shuffleSeed = (() => {
        try {
            const v = Number(localStorage.getItem(SEED_KEY));
            return v > 0 ? v : ((Date.now() & 0x7fffffff) || 1);
        } catch { return (Date.now() & 0x7fffffff) || 1; }
    })();

    function applyExternalSync() {
        store = loadBucket(STORE_KEY, false);
        favStore = loadBucket(FAV_STORE_KEY, true);
        histHidden = loadHistory(HIST_HIDDEN_KEY);
        histFav = loadHistory(HIST_FAV_KEY);
        try {
            const s = localStorage.getItem(SCOPE_KEY);
            if (s === 'global' || s === 'mix' || s === 'history') scopeMode = s;
            const m = localStorage.getItem(FAV_MODE_KEY);
            if (m === 'default' || m === 'normal' || m === 'shuffle' || m === 'interleave') favMode = m;
            const sd = Number(localStorage.getItem(SEED_KEY));
            if (sd > 0) shuffleSeed = sd;
            const l = localStorage.getItem(LANG_KEY);
            if (l && (l === 'auto' || I18N[l])) langPref = l;
        } catch { /* yoksay */ }
        skippedFrom = null;
        refresh();
        skipIfHidden();
        renderPop();
    }

    window.addEventListener('storage', (e) => {
        if (!e.key || [STORE_KEY, FAV_STORE_KEY, HIST_HIDDEN_KEY, HIST_FAV_KEY, SCOPE_KEY, FAV_MODE_KEY, SEED_KEY, LANG_KEY].includes(e.key)) {
            applyExternalSync();
        }
    });
    syncChannel?.addEventListener('message', applyExternalSync);

    const mixKey = () => new URLSearchParams(location.search).get('list') || 'none';
    const scopeKey = () => (scopeMode === 'global' ? GLOBAL_KEY : mixKey());

    const isHidden = (id) => !!id && !!(store[mixKey()]?.ids?.[id] || store[GLOBAL_KEY]?.ids?.[id]);
    const favInfo = (id) => (id && (favStore[mixKey()]?.ids?.[id] || favStore[GLOBAL_KEY]?.ids?.[id])) || null;
    const isFav = (id) => !!favInfo(id);
    const favTs = (id) => favInfo(id)?.ts || 0;

    // ---------- Sabit Karma & Kendi Mix Kuyruğu Motoru (Şarkı Kaybolmasını Önler) ----------
    // Her şarkı ID'si için seed'e göre sabit bir sayı üretir; listeye yeni şarkı eklense bile mevcut şarkıların sırası değişmez!
    function songHash(id, seed) {
        const str = `${id}:${seed}`;
        let h = (seed ^ 0x811c9dc5) >>> 0;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193) >>> 0;
        }
        h ^= h >>> 16;
        h = Math.imul(h, 0x85ebca6b) >>> 0;
        h ^= h >>> 13;
        return h >>> 0;
    }

    // Paneldeki canlı öğeleri mixPool'a kaydeder ve bu mixte karşılaşılan global favori/gizlileri "Sadece bu mix"e eşitler
    function harvestPanelItems(panel) {
        const mk = mixKey();
        if (!mk || mk === 'none') return new Map();

        const pool = (mixPool[mk] ||= { ts: Date.now(), seq: 1, items: {} });
        pool.ts = Date.now();

        const domMap = new Map();
        const rawItems = itemsOf(panel);
        let favDirty = false;
        let hidDirty = false;

        for (const el of rawItems) {
            const id = idOf(el);
            if (!id) continue;
            domMap.set(id, el);

            const t = titleOf(el);
            const by = bylineOf(el);
            const dur = durOf(el);
            const a = el.querySelector('a#wc-endpoint') || el.querySelector(LINK_SEL);
            const href = a?.getAttribute('href') || `/watch?v=${id}&list=${mk}`;

            let rawIndex = 0;
            try { rawIndex = Number(new URL(href, location.origin).searchParams.get('index')) || 0; } catch { /* yoksay */ }

            const existing = pool.items[id];
            if (!existing) {
                if (Object.keys(pool.items).length < MAX_POOL_ITEMS) {
                    pool.items[id] = {
                        id,
                        t: t || `Video ${id}`,
                        by: by || '',
                        dur: dur || '',
                        href,
                        rawIndex: rawIndex || (pool.seq * 100),
                        seq: pool.seq++
                    };
                }
            } else {
                if (t) existing.t = t;
                if (by) existing.by = by;
                if (dur) existing.dur = dur;
                if (href) existing.href = href;
                // rawIndex'i sonradan üzerine YAZMA: YouTube index=38'e geçince şarkıların index'ini kaydırır, ilk keşfedilen sıra sabit kalmalı!
                if (!existing.rawIndex && rawIndex > 0) existing.rawIndex = rawIndex;
            }

            // Bu mixte karşılaşılan global favorileri otomatik olarak "Sadece bu mix"e de kaydet
            const gFav = favStore[GLOBAL_KEY]?.ids?.[id];
            if (gFav) {
                if (t && (!gFav.t || gFav.t.startsWith('Video '))) { gFav.t = t; favDirty = true; }
                if (by && !gFav.by) { gFav.by = by; favDirty = true; }
                if (dur && !gFav.dur) { gFav.dur = dur; favDirty = true; }
                const mEntry = (favStore[mk] ||= { ts: Date.now(), ids: {} });
                if (!mEntry.ids[id]) {
                    mEntry.ids[id] = { ...gFav };
                    mEntry.ts = Date.now();
                    favDirty = true;
                } else {
                    if (t) mEntry.ids[id].t = t;
                    if (by) mEntry.ids[id].by = by;
                    if (dur) mEntry.ids[id].dur = dur;
                }
            }

            // Bu mixte karşılaşılan global gizlenenleri otomatik olarak "Sadece bu mix"e de kaydet
            const gHid = store[GLOBAL_KEY]?.ids?.[id];
            if (gHid) {
                const mHid = (store[mk] ||= { ts: Date.now(), ids: {} });
                if (!mHid.ids[id]) {
                    mHid.ids[id] = t || (typeof gHid === 'string' ? gHid : 1);
                    mHid.ts = Date.now();
                    hidDirty = true;
                }
            }
        }

        if (favDirty) trimAndSave(FAV_STORE_KEY, favStore);
        if (hidDirty) trimAndSave(STORE_KEY, store);
        savePool();
        return domMap;
    }

    // Hem DOM'daki canlı şarkıları hem de index=30'a gidince YouTube'un DOM'dan sildiği şarkıları birleştirip sabit sıraya diz
    function buildOrderedQueue(panel) {
        const mk = mixKey();
        const domMap = harvestPanelItems(panel);
        const poolItems = mixPool[mk]?.items || {};

        const allIds = new Set([...Object.keys(poolItems), ...domMap.keys()]);
        // Bu mixteki favorileri de kesinlikle kuyruğa dahil et (index kaymasıyla DOM'dan düşmüş olsalar bile)
        for (const id of Object.keys(favStore[mk]?.ids || {})) allIds.add(id);
        // Eğer ayarlarda "Tüm mixler" seçiliyse tüm favorileri de bu mix kuyruğuna getir (kendi özel mixini oluşturur)
        if (scopeMode === 'global') {
            for (const id of Object.keys(favStore[GLOBAL_KEY]?.ids || {})) allIds.add(id);
        }

        const favs = [];
        const norms = [];
        const hiddenDomEls = [];

        for (const id of allIds) {
            const realEl = domMap.get(id) || null;
            const pInfo = poolItems[id];
            const fInfo = favInfo(id);

            const entry = {
                id,
                t: pInfo?.t || fInfo?.t || titleOf(realEl) || `Video ${id}`,
                by: pInfo?.by || fInfo?.by || bylineOf(realEl) || '',
                dur: pInfo?.dur || fInfo?.dur || durOf(realEl) || '',
                href: pInfo?.href || `/watch?v=${id}&list=${mk}`,
                rawIndex: pInfo?.rawIndex || 9999,
                seq: pInfo?.seq || 9999,
                realEl
            };

            if (isHidden(id)) {
                if (realEl) hiddenDomEls.push(realEl);
            } else if (isFav(id)) {
                favs.push(entry);
            } else {
                norms.push(entry);
            }
        }

        // Normal şarkıları ilk keşfedilme sırasına göre diz (index=30'a geçince YouTube yeni şarkılar yüklese bile üstteki Aralı sıra ASLA kaymaz!)
        norms.sort((a, b) => (a.seq - b.seq) || (a.rawIndex - b.rawIndex));

        let orderedQueue = [];
        if (favMode === 'default') {
            orderedQueue = [...favs, ...norms].sort((a, b) => (a.rawIndex - b.rawIndex) || (a.seq - b.seq));
        } else if (favMode === 'normal') {
            favs.sort((a, b) => (favTs(b.id) - favTs(a.id)) || (a.seq - b.seq));
            orderedQueue = [...favs, ...norms];
        } else if (favMode === 'shuffle') {
            // Sabit per-song hash: yeni şarkı eklense bile mevcut şarkıların kendi arasındaki sırası ASLA değişmez
            favs.sort((a, b) => (songHash(a.id, shuffleSeed) - songHash(b.id, shuffleSeed)));
            orderedQueue = [...favs, ...norms];
        } else if (favMode === 'interleave') {
            favs.sort((a, b) => (songHash(a.id, shuffleSeed) - songHash(b.id, shuffleSeed)));
            let fi = 0, ni = 0;
            while (fi < favs.length || ni < norms.length) {
                if (fi < favs.length) {
                    const takeFav = (songHash(favs[fi].id, shuffleSeed + 77) & 1) === 0 ? 1 : 2;
                    for (let k = 0; k < takeFav && fi < favs.length; k++) orderedQueue.push(favs[fi++]);
                    if (ni < norms.length && fi < favs.length) orderedQueue.push(norms[ni++]);
                } else {
                    orderedQueue.push(norms[ni++]);
                }
            }
        }

        return { orderedQueue, hiddenDomEls };
    }

    // ---------- Stil ----------
    function injectStyle() {
        if (document.getElementById('yt-mixfix-style')) return;
        const root = document.head || document.documentElement;
        if (!root) return;
        const style = document.createElement('style');
        style.id = 'yt-mixfix-style';
        style.textContent = `
            ytd-playlist-panel-renderer#playlist #items.playlist-items { display: flex !important; flex-direction: column !important; }
            ${ITEM_SEL}[${GONE_ATTR}] { display: none !important; }
            ${ITEM_SEL}[${FAV_ATTR}], .ytmixfix-virtual-item[${FAV_ATTR}] {
                background: linear-gradient(90deg, rgba(245, 197, 24, .09), transparent 74%);
            }

            /* YouTube DOM penceresinden düşen şarkılar için birebir YouTube görünümlü sanal satır */
            .ytmixfix-virtual-item {
                display: flex; align-items: center; padding: 4px 8px 4px 0; min-height: 64px;
                box-sizing: border-box; cursor: pointer; user-select: none; position: relative;
                color: var(--yt-spec-text-primary, #f1f1f1); font-family: Roboto, Arial, sans-serif;
                transition: background .12s;
            }
            .ytmixfix-virtual-item:hover { background: var(--yt-spec-10-percent-layer, rgba(255,255,255,.08)); }
            .ytmixfix-virtual-item[selected] { background: var(--yt-spec-10-percent-layer, rgba(255,255,255,.12)); }
            .ytmixfix-virtual-item .v-idx {
                width: 24px; flex: none; display: inline-flex; align-items: center; justify-content: center;
                color: var(--yt-spec-text-secondary, #aaa); font-size: 12px;
            }
            .ytmixfix-virtual-item .v-idx svg { width: 12px; height: 12px; color: var(--yt-spec-text-primary, #fff); }
            .ytmixfix-virtual-item .v-thumb {
                position: relative; width: 100px; height: 56px; border-radius: 8px; overflow: hidden;
                flex: none; background: #181818; margin-right: 8px;
            }
            .ytmixfix-virtual-item .v-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
            .ytmixfix-virtual-item .v-dur {
                position: absolute; right: 4px; bottom: 4px; padding: 1px 4px; border-radius: 4px;
                background: rgba(0,0,0,.8); color: #fff; font-size: 11px; font-weight: 500; line-height: 14px;
            }
            .ytmixfix-virtual-item .v-meta { flex: 1; min-width: 0; padding-right: 6px; }
            .ytmixfix-virtual-item .v-title {
                font-size: 14px; font-weight: 500; line-height: 20px; color: var(--yt-spec-text-primary, #fff);
                display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
            }
            .ytmixfix-virtual-item .v-byline {
                font-size: 12px; line-height: 18px; color: var(--yt-spec-text-secondary, #aaa);
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;
            }
            .ytmixfix-virtual-item .v-actions { display: inline-flex; align-items: center; gap: 2px; flex: none; }

            .ytmixfix-btn, .ytmixfix-star {
                all: unset; box-sizing: border-box; width: 30px; height: 30px;
                display: inline-flex; align-items: center; justify-content: center;
                vertical-align: middle; border-radius: 50%; cursor: pointer;
                color: var(--yt-spec-text-secondary, #aaa); opacity: 0;
                transition: opacity .14s ease, background .14s ease, transform .14s ease, color .14s ease;
            }
            .ytmixfix-btn svg, .ytmixfix-star svg { width: 17px; height: 17px; pointer-events: none; display: block; }
            ${ITEM_SEL}:hover .ytmixfix-btn, .ytmixfix-btn:focus-visible,
            ${ITEM_SEL}:hover .ytmixfix-star, .ytmixfix-star:focus-visible,
            .ytmixfix-virtual-item:hover .ytmixfix-btn, .ytmixfix-virtual-item:hover .ytmixfix-star,
            .ytmixfix-star.on { opacity: 1; }
            .ytmixfix-star.on { color: #f5c518; filter: drop-shadow(0 0 6px rgba(245, 197, 24, .25)); }
            .ytmixfix-btn:hover, .ytmixfix-star:hover {
                background: var(--yt-spec-badge-chip-background, rgba(255,255,255,.12));
                color: var(--yt-spec-text-primary, #fff); transform: scale(1.1);
            }
            .ytmixfix-star.on:hover { color: #ffd83b; }

            .ytmixfix-menu-item {
                display: flex; align-items: center; gap: 16px; height: 36px; padding: 0 16px;
                cursor: pointer; user-select: none; font: 400 14px/20px Roboto, Arial, sans-serif;
                color: var(--yt-spec-text-primary, #fff); transition: background .12s;
            }
            .ytmixfix-menu-item:hover { background: var(--yt-spec-10-percent-layer, rgba(255,255,255,.1)); }
            .ytmixfix-menu-item .ico { width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; }
            .ytmixfix-menu-item .ico svg { width: 20px; height: 20px; display: block; }

            @keyframes ytmixfix-toast-in { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
            #ytmixfix-toast {
                position: fixed; right: 20px; bottom: 20px; z-index: 99999;
                display: flex; align-items: center; gap: 14px; max-width: 430px; padding: 11px 16px;
                background: rgba(24, 24, 27, .96); backdrop-filter: blur(14px);
                color: #f4f4f5; border-radius: 12px; border: 1px solid rgba(255,255,255,.1);
                font: 400 13.5px/20px Roboto, Arial, sans-serif; box-shadow: 0 10px 32px rgba(0,0,0,.55);
                overflow: hidden; animation: ytmixfix-toast-in .18s cubic-bezier(.2, .9, .3, 1);
            }
            #ytmixfix-toast span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            #ytmixfix-toast button {
                all: unset; cursor: pointer; font-weight: 500; color: #3ea6ff; flex: none;
                padding: 4px 9px; margin: -3px -4px; border-radius: 7px; transition: background .15s;
            }
            #ytmixfix-toast button:hover { background: rgba(62,166,255,.15); }
            #ytmixfix-toast i {
                position: absolute; left: 0; bottom: 0; height: 2.5px; width: 100%;
                background: linear-gradient(90deg, #3ea6ff, #79c4ff); transform-origin: left;
                animation: ytmixfix-bar ${UNDO_MS}ms linear forwards;
            }
            @keyframes ytmixfix-bar { to { transform: scaleX(0); } }

            .ytmixfix-settings {
                all: unset; box-sizing: border-box; position: absolute; z-index: 2;
                width: 40px; height: 40px; flex: none; display: inline-flex; align-items: center; justify-content: center;
                border-radius: 50%; cursor: pointer; color: var(--yt-spec-text-primary, #fff); transition: background .15s;
            }
            .ytmixfix-settings:hover { background: var(--yt-spec-badge-chip-background, rgba(255,255,255,.1)); }
            .ytmixfix-settings svg { width: 21px; height: 21px; fill: currentColor; pointer-events: none; transition: transform .25s cubic-bezier(.2, .9, .3, 1); }
            .ytmixfix-settings:hover svg, .ytmixfix-settings.open svg { transform: rotate(35deg); }
            .ytmixfix-settings[data-count]:not([data-count="0"])::after {
                content: attr(data-count); position: absolute; transform: translate(11px, -11px);
                min-width: 16px; height: 16px; padding: 0 4px; box-sizing: border-box;
                border-radius: 8px; background: #3ea6ff; color: #09090b;
                font: 600 10px/16px Roboto, Arial, sans-serif; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,.45);
            }

            @keyframes ytmixfix-pop-in { from { opacity: 0; transform: translateY(-6px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
            #ytmixfix-pop {
                position: fixed; z-index: 99998; width: 404px; max-width: calc(100vw - 24px); max-height: 76vh;
                display: flex; flex-direction: column; background: rgba(24, 24, 27, .97); backdrop-filter: blur(18px);
                color: var(--yt-spec-text-primary, #f4f4f5); border-radius: 16px; border: 1px solid rgba(255,255,255,.09);
                box-shadow: 0 16px 44px rgba(0,0,0,.62); font: 400 13.5px/20px Roboto, Arial, sans-serif;
                overflow: hidden; transform-origin: top right; animation: ytmixfix-pop-in .16s cubic-bezier(.2, .9, .3, 1);
            }
            #ytmixfix-pop .topbar { display: flex; align-items: center; gap: 6px; padding: 10px 12px 8px; border-bottom: 1px solid rgba(255,255,255,.07); }
            #ytmixfix-pop .tabs {
                display: flex; flex: 1; gap: 4px; background: rgba(255,255,255,.04);
                padding: 3px; border-radius: 11px; border: 1px solid rgba(255,255,255,.05);
            }
            #ytmixfix-pop .tabs button {
                all: unset; cursor: pointer; flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
                padding: 6px 8px; border-radius: 8px; color: var(--yt-spec-text-secondary, #a1a1aa);
                font-weight: 500; font-size: 13px; transition: background .15s, color .15s, box-shadow .15s;
            }
            #ytmixfix-pop .tabs button svg { width: 15px; height: 15px; flex: none; }
            #ytmixfix-pop .tabs button:hover { color: var(--yt-spec-text-primary, #fff); }
            #ytmixfix-pop .tabs button.on { background: rgba(255,255,255,.12); color: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3); }
            #ytmixfix-pop .tabs button.on.fav-tab { background: rgba(245, 197, 24, .16); color: #ffd83b; }
            #ytmixfix-pop .tabs button .cnt { font-size: 11px; padding: 0 6px; border-radius: 8px; background: rgba(255,255,255,.09); line-height: 17px; }
            #ytmixfix-pop .tabs button.on.fav-tab .cnt { background: rgba(245, 197, 24, .22); color: #ffe266; }

            #ytmixfix-pop .lang-btn {
                all: unset; cursor: pointer; flex: none; display: inline-flex; align-items: center; gap: 4px;
                height: 32px; padding: 0 9px; border-radius: 9px; background: rgba(255,255,255,.05);
                border: 1px solid rgba(255,255,255,.07); color: var(--yt-spec-text-secondary, #b4b4bb);
                font-size: 11.5px; font-weight: 600; letter-spacing: .3px; transition: background .15s, color .15s, border-color .15s;
            }
            #ytmixfix-pop .lang-btn svg { width: 15px; height: 15px; }
            #ytmixfix-pop .lang-btn:hover, #ytmixfix-pop .lang-btn.on { background: rgba(62,166,255,.15); border-color: rgba(62,166,255,.35); color: #fff; }

            #ytmixfix-pop .lang-panel {
                display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; padding: 10px 12px;
                max-height: 250px; overflow-y: auto; background: rgba(15, 15, 18, .9);
                border-bottom: 1px solid rgba(255,255,255,.08); scrollbar-width: thin;
            }
            #ytmixfix-pop .lang-panel button {
                all: unset; cursor: pointer; display: flex; align-items: center; justify-content: space-between;
                padding: 6px 10px; border-radius: 8px; background: rgba(255,255,255,.04);
                border: 1px solid rgba(255,255,255,.05); color: var(--yt-spec-text-secondary, #bbb);
                font-size: 12.5px; transition: background .12s, color .12s, border-color .12s;
            }
            #ytmixfix-pop .lang-panel button.full { grid-column: 1 / -1; }
            #ytmixfix-pop .lang-panel button:hover { background: rgba(255,255,255,.1); color: #fff; }
            #ytmixfix-pop .lang-panel button.on { background: rgba(62,166,255,.18); border-color: rgba(62,166,255,.45); color: #65b8ff; font-weight: 500; }
            #ytmixfix-pop .lang-panel button .code { font-size: 10.5px; opacity: .65; text-transform: uppercase; }

            #ytmixfix-pop .scope { display: flex; gap: 5px; padding: 9px 12px 7px; flex-wrap: wrap; }
            #ytmixfix-pop .scope button {
                all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;
                padding: 5px 10px; border-radius: 14px; background: rgba(255,255,255,.06);
                border: 1px solid rgba(255,255,255,.05); color: var(--yt-spec-text-secondary, #b4b4bb);
                font-size: 12px; font-weight: 500; transition: background .15s, color .15s, border-color .15s;
            }
            #ytmixfix-pop .scope button svg { width: 13.5px; height: 13.5px; }
            #ytmixfix-pop .scope button:hover { background: rgba(255,255,255,.12); color: #fff; }
            #ytmixfix-pop .scope button.on { background: #f4f4f5; color: #09090b; border-color: transparent; }
            #ytmixfix-pop .scope button .cnt { font-size: 10.5px; padding: 0 5px; border-radius: 7px; background: rgba(255,255,255,.1); line-height: 15px; }
            #ytmixfix-pop .scope button.on .cnt { background: rgba(0,0,0,.14); color: #09090b; }

            #ytmixfix-pop .playmode {
                display: flex; flex-direction: column; gap: 6px; margin: 0 12px 8px; padding: 8px 10px;
                background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.06); border-radius: 11px;
            }
            #ytmixfix-pop .playmode-btns { display: flex; gap: 4px; }
            #ytmixfix-pop .playmode-btns button {
                all: unset; cursor: pointer; flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 4px;
                text-align: center; padding: 5.5px 4px; border-radius: 8px; background: rgba(255,255,255,.05);
                color: var(--yt-spec-text-secondary, #b4b4bb); font-size: 11.4px; font-weight: 500; transition: background .15s, color .15s;
            }
            #ytmixfix-pop .playmode-btns button svg { width: 13.5px; height: 13.5px; flex: none; }
            #ytmixfix-pop .playmode-btns button:hover { background: rgba(255,255,255,.11); color: #fff; }
            #ytmixfix-pop .playmode-btns button.on { background: #3ea6ff; color: #061018; font-weight: 600; }
            #ytmixfix-pop .playmode-desc { font-size: 11px; color: var(--yt-spec-text-secondary, #9a9aa2); line-height: 15px; padding: 0 2px; }

            #ytmixfix-pop .search { padding: 0 12px 8px; position: relative; }
            #ytmixfix-pop .search svg { position: absolute; left: 21px; top: 8px; width: 14px; height: 14px; color: #888; pointer-events: none; }
            #ytmixfix-pop .search input {
                all: unset; box-sizing: border-box; width: 100%; padding: 6px 11px 6px 30px; border-radius: 9px;
                background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.06);
                color: var(--yt-spec-text-primary, #fff); font-size: 12.8px; transition: background .15s, border-color .15s;
            }
            #ytmixfix-pop .search input::placeholder { color: var(--yt-spec-text-secondary, #888); }
            #ytmixfix-pop .search input:focus { background: rgba(255,255,255,.09); border-color: rgba(62,166,255,.5); }
            #ytmixfix-pop .list { overflow-y: auto; padding: 0 8px 8px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.2) transparent; }
            #ytmixfix-pop .list::-webkit-scrollbar { width: 6px; }
            #ytmixfix-pop .list::-webkit-scrollbar-thumb { background: rgba(255,255,255,.2); border-radius: 3px; }
            #ytmixfix-pop .row { display: flex; align-items: center; gap: 9px; padding: 5.5px 8px; border-radius: 9px; transition: background .12s; }
            #ytmixfix-pop .row:hover { background: rgba(255,255,255,.07); }
            #ytmixfix-pop .row img { width: 58px; height: 33px; object-fit: cover; border-radius: 6px; flex: none; background: #111; box-shadow: 0 1px 4px rgba(0,0,0,.35); }
            #ytmixfix-pop .row .t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.8px; cursor: pointer; }
            #ytmixfix-pop .row .t:hover { color: #3ea6ff; }
            #ytmixfix-pop .row .act { all: unset; cursor: pointer; flex: none; color: #3ea6ff; font-weight: 500; font-size: 12px; padding: 4px 8px; border-radius: 6px; transition: background .15s; }
            #ytmixfix-pop .row .act:hover { background: rgba(62,166,255,.15); }
            #ytmixfix-pop .row .del {
                all: unset; cursor: pointer; flex: none; width: 24px; height: 24px; border-radius: 6px;
                display: inline-flex; align-items: center; justify-content: center;
                color: var(--yt-spec-text-secondary, #888); transition: background .15s, color .15s;
            }
            #ytmixfix-pop .row .del svg { width: 13px; height: 13px; }
            #ytmixfix-pop .row .del:hover { background: rgba(255, 85, 85, .16); color: #ff6b6b; }
            #ytmixfix-pop .empty { padding: 22px 16px 26px; text-align: center; color: var(--yt-spec-text-secondary, #9a9aa2); font-size: 12.8px; }
            #ytmixfix-pop .ft { padding: 8px 14px 10px; display: flex; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,.07); }
            #ytmixfix-pop .ft button {
                all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
                color: #3ea6ff; font-weight: 500; font-size: 12.5px; padding: 4px 9px; border-radius: 7px; transition: background .15s;
            }
            #ytmixfix-pop .ft button svg { width: 14px; height: 14px; }
            #ytmixfix-pop .ft button:hover { background: rgba(62,166,255,.15); }
        `;
        root.appendChild(style);
    }

    // ---------- Gizleme, Favori ve Geçmiş İşlemleri ----------
    let skippedFrom = null;
    let toastTimer = null;

    function toast(message, onUndo) {
        clearTimeout(toastTimer);
        document.getElementById('ytmixfix-toast')?.remove();
        const box = document.createElement('div');
        box.id = 'ytmixfix-toast';
        const text = document.createElement('span');
        text.textContent = message;
        const bar = document.createElement('i');
        box.appendChild(text);
        if (onUndo) {
            const undo = document.createElement('button');
            undo.type = 'button';
            undo.textContent = L().undo;
            undo.addEventListener('click', () => {
                clearTimeout(toastTimer);
                onUndo();
                box.remove();
            });
            box.appendChild(undo);
        }
        box.appendChild(bar);
        (document.body || document.documentElement).appendChild(box);
        toastTimer = setTimeout(() => box.remove(), UNDO_MS);
    }

    function getHiddenTitle(id) {
        for (const k of [mixKey(), GLOBAL_KEY, ...Object.keys(store)]) {
            const v = store[k]?.ids?.[id];
            if (typeof v === 'string' && v && v !== '1') return v;
        }
        return mixPool[mixKey()]?.items?.[id]?.t || `Video ${id}`;
    }

    function unhideVideo(id, recordHistory = true) {
        const prevTitle = getHiddenTitle(id);
        for (const k of Object.keys(store)) delete store[k]?.ids?.[id];
        if (recordHistory) pushHistory(histHidden, HIST_HIDDEN_KEY, id, prevTitle);
        saveStore();
        skippedFrom = null;
        refresh();
        renderPop();
    }

    function hideVideo(id, title) {
        if (!id) return;
        title = title || mixPool[mixKey()]?.items?.[id]?.t || '';
        const now = Date.now();
        const mk = mixKey();

        const wasFav = isFav(id);
        const prevFavInfo = favInfo(id);
        if (wasFav) {
            for (const k of Object.keys(favStore)) delete favStore[k]?.ids?.[id];
            pushHistory(histFav, HIST_FAV_KEY, id, prevFavInfo?.t || title);
            saveFavStore();
        }
        removeFromHistory(histHidden, HIST_HIDDEN_KEY, id);

        for (const key of [mk, GLOBAL_KEY]) {
            const entry = (store[key] ||= { ts: 0, ids: {} });
            entry.ids[id] = title || 1;
            entry.ts = now;
        }
        saveStore();
        skippedFrom = null;
        log('gizlendi', { mix: mk, id, url: location.href });

        refresh();
        if (currentVideoId() === id) skipIfHidden();
        renderPop();

        const short = title.length > 42 ? title.slice(0, 42) + '…' : title;
        toast(L().toastHidden(short), () => {
            unhideVideo(id, false);
            if (wasFav) addFav(id, prevFavInfo?.t || title, true, prevFavInfo?.by, prevFavInfo?.dur);
        });
    }

    function addFav(id, title, silent, by = '', dur = '') {
        if (!id) return;
        const mk = mixKey();
        const pItem = mixPool[mk]?.items?.[id];
        title = title || pItem?.t || '';
        by = by || pItem?.by || '';
        dur = dur || pItem?.dur || '';
        const now = Date.now();

        if (isHidden(id)) {
            for (const k of Object.keys(store)) delete store[k]?.ids?.[id];
            saveStore();
        }
        removeFromHistory(histFav, HIST_FAV_KEY, id);

        for (const key of [mk, GLOBAL_KEY]) {
            const entry = (favStore[key] ||= { ts: 0, ids: {} });
            entry.ids[id] = { t: title || `Video ${id}`, by, dur, ts: now };
            entry.ts = now;
        }
        saveFavStore();
        refresh();
        renderPop();

        if (!silent) {
            const short = title.length > 40 ? title.slice(0, 40) + '…' : title;
            toast(L().toastFavAdded(short), () => removeFav(id, true));
        }
    }

    function removeFav(id, silent, recordHistory = true) {
        const info = favInfo(id);
        for (const k of Object.keys(favStore)) delete favStore[k]?.ids?.[id];
        if (recordHistory && info) pushHistory(histFav, HIST_FAV_KEY, id, info.t || `Video ${id}`);
        saveFavStore();
        refresh();
        renderPop();

        if (!silent && info) {
            const title = info.t || '';
            const short = title.length > 40 ? title.slice(0, 40) + '…' : title;
            toast(L().toastFavRemoved(short), () => addFav(id, title, true, info.by, info.dur));
        }
    }

    function toggleFavFromItem(item) {
        const id = idOf(item);
        if (!id) return;
        if (isFav(id)) removeFav(id, false, true);
        else addFav(id, titleOf(item), false, bylineOf(item), durOf(item));
    }

    const hideFromItem = (item) => hideVideo(idOf(item), titleOf(item));

    // ---------- SPA Geçiş & Shift+N / ⏭ Kancalama Motoru ----------
    // Şarkı YouTube'un DOM penceresinden silinmiş olsa bile (ör. index=38'deyken index=12'ye geçiş) SPA ile anında açar
    function navigateToEntry(entry) {
        if (!entry?.id) return false;
        const mk = mixKey();

        // 1) Eğer şarkının gerçek YouTube DOM satırı panelde duruyorsa doğrudan onun bağlantısını tetikle
        if (entry.realEl && entry.realEl.isConnected) {
            const link = entry.realEl.querySelector('a#wc-endpoint') || entry.realEl.querySelector(LINK_SEL);
            if (link) {
                link.click();
                return true;
            }
        }

        // 2) Şarkı YouTube'un DOM penceresinden düşmüşse (sanal satır), YouTube'un SPA yönlendiricisini veya #movie_player API'sini kullan
        const watchUrl = `/watch?v=${encodeURIComponent(entry.id)}&list=${encodeURIComponent(mk)}`;
        const endpoint = {
            commandMetadata: {
                webCommandMetadata: {
                    url: watchUrl,
                    webPageType: 'WEB_PAGE_TYPE_WATCH',
                    rootVe: 3832
                }
            },
            watchEndpoint: {
                videoId: entry.id,
                playlistId: mk
            }
        };

        const flexy = document.querySelector('ytd-watch-flexy');
        const app = document.querySelector('ytd-app');
        if (app && typeof app.handleNavigate === 'function') {
            try { app.handleNavigate({ detail: { endpoint } }); return true; } catch { /* devam */ }
        }
        if (app || flexy) {
            (flexy || app).dispatchEvent(new CustomEvent('yt-navigate', {
                bubbles: true,
                composed: true,
                detail: { endpoint }
            }));
            return true;
        }

        const player = document.getElementById('movie_player');
        if (player && typeof player.loadVideoById === 'function') {
            try {
                history.pushState(history.state, '', watchUrl);
                player.loadVideoById(entry.id);
                setTimeout(schedule, 60);
                return true;
            } catch { /* devam */ }
        }

        location.href = watchUrl;
        return true;
    }

    function neighbor(dir) {
        const panel = panelEl();
        if (!panel) return null;

        const { orderedQueue } = buildOrderedQueue(panel);
        if (orderedQueue.length === 0) return null;

        const v = currentVideoId();
        let vIdx = orderedQueue.findIndex((x) => x.id === v);
        if (vIdx < 0) {
            const selEl = panel.querySelector(`${ITEM_SEL}[selected]`);
            const selId = idOf(selEl);
            if (selId) vIdx = orderedQueue.findIndex((x) => x.id === selId);
        }

        let target = null;
        if (dir > 0) target = vIdx >= 0 ? (orderedQueue[vIdx + 1] || orderedQueue[0] || null) : (orderedQueue[0] || null);
        else target = vIdx > 0 ? (orderedQueue[vIdx - 1] || null) : null;

        return target;
    }

    function navigateByOrder(dir) {
        if (!isMixPage() || favMode === 'default') return false;
        const target = neighbor(dir);
        if (!target) return false;
        return navigateToEntry(target);
    }

    function skipIfHidden() {
        if (!isMixPage()) return;
        const v = currentVideoId();
        if (!v || !isHidden(v) || skippedFrom === v) return;

        const next = neighbor(1);
        if (next) {
            skippedFrom = v;
            navigateToEntry(next);
            return;
        }
        const btn = document.querySelector('.ytp-next-button');
        if (btn) { skippedFrom = v; btn.click(); }
    }

    // ---------- Alt+Tab / Fn+9 Medya Tuşu (MediaSession API) & Player Kancalama ----------
    // Windows'ta Alt+Tab'dayken Fn+9 (NextTrack / PrevTrack) basıldığında tarayıcı keydown yerine
    // doğrudan navigator.mediaSession action handler'ını tetikler! Bunu kancalayıp kendi sıramıza yönlendiriyoruz.
    let mediaSessionHooked = false;
    function hookMediaSession() {
        try {
            if (!('mediaSession' in navigator) || !navigator.mediaSession) return;
            const ms = navigator.mediaSession;
            const proto = Object.getPrototypeOf(ms);
            if (proto && !proto._ytmixfixMSHooked && typeof proto.setActionHandler === 'function') {
                proto._ytmixfixMSHooked = true;
                const origSet = proto.setActionHandler;
                proto.setActionHandler = function (action, handler) {
                    if (action === 'nexttrack') {
                        return origSet.call(this, action, (...args) => {
                            if (isMixPage() && favMode !== 'default' && navigateByOrder(1)) return;
                            return typeof handler === 'function' ? handler(...args) : undefined;
                        });
                    }
                    if (action === 'previoustrack') {
                        return origSet.call(this, action, (...args) => {
                            if (isMixPage() && favMode !== 'default' && (mainVideo()?.currentTime || 0) <= 3 && navigateByOrder(-1)) return;
                            return typeof handler === 'function' ? handler(...args) : undefined;
                        });
                    }
                    return origSet.call(this, action, handler);
                };
            }
            if (!mediaSessionHooked) {
                mediaSessionHooked = true;
                ms.setActionHandler('nexttrack', () => {
                    if (isMixPage() && favMode !== 'default' && navigateByOrder(1)) return;
                    document.querySelector('.ytp-next-button')?.click();
                });
                ms.setActionHandler('previoustrack', () => {
                    if (isMixPage() && favMode !== 'default' && (mainVideo()?.currentTime || 0) <= 3 && navigateByOrder(-1)) return;
                    document.querySelector('.ytp-prev-button')?.click();
                });
            }
        } catch { /* yoksay */ }
    }
    hookMediaSession();

    // YouTube'un kendi #movie_player.nextVideo / previousVideo fonksiyonlarını kancala
    function hookPlayerMethods() {
        hookMediaSession();
        const player = document.getElementById('movie_player');
        if (!player || player._ytmixfixHooked) return;
        if (typeof player.nextVideo !== 'function') return;
        player._ytmixfixHooked = true;

        const origNext = player.nextVideo.bind(player);
        const origPrev = typeof player.previousVideo === 'function' ? player.previousVideo.bind(player) : null;

        player.nextVideo = function (...args) {
            if (isMixPage() && favMode !== 'default' && navigateByOrder(1)) return;
            return origNext(...args);
        };
        if (origPrev) {
            player.previousVideo = function (...args) {
                if (isMixPage() && favMode !== 'default' && (mainVideo()?.currentTime || 0) <= 3 && navigateByOrder(-1)) return;
                return origPrev(...args);
            };
        }
    }

    let earlyFor = null;
    document.addEventListener('timeupdate', (e) => {
        const vid = e.target;
        if (!isMainVideo(vid) || !isMixPage() || favMode === 'default' || vid.loop || vid.paused || adShowing()) return;
        const left = vid.duration - vid.currentTime;
        if (!isFinite(left) || left > EARLY_SKIP_SEC) return;
        const v = currentVideoId();
        if (earlyFor === v) return;
        if (navigateByOrder(1)) earlyFor = v;
    }, true);

    document.addEventListener('ended', (e) => {
        if (!isMainVideo(e.target) || !isMixPage() || favMode === 'default' || adShowing()) return;
        if (earlyFor === currentVideoId()) return;
        if (navigateByOrder(1)) {
            e.stopImmediatePropagation();
            e.stopPropagation();
        }
    }, true);

    // ⏭ / ⏮ butonları: her zaman bizim görsel sıradaki komşu şarkıya geçir
    document.addEventListener('click', (e) => {
        if (!isMixPage() || favMode === 'default' || !e.target?.closest) return;
        let dir = 0;
        if (e.target.closest('.ytp-next-button')) dir = 1;
        else if (e.target.closest('.ytp-prev-button')) dir = -1;
        if (!dir) return;
        if (dir < 0 && (mainVideo()?.currentTime || 0) > 3) return;
        if (!navigateByOrder(dir)) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    }, true);

    // Shift+N / Shift+P ve Fn+9 (MediaTrackNext / MediaTrackPrevious) kısayolları: YouTube'un kendi hotkey dinleyicisini kesin olarak engeller
    const isTyping = (t) => !!t?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
    let blockShiftKeyUp = false;

    function handleShiftNavKey(e) {
        if (e.repeat) return false;
        if (!isMixPage() || favMode === 'default') return false;

        let dir = 0;
        const isMediaNext = e.key === 'MediaTrackNext' || e.code === 'MediaTrackNext' || e.keyCode === 176;
        const isMediaPrev = e.key === 'MediaTrackPrevious' || e.code === 'MediaTrackPrevious' || e.keyCode === 177;

        if (isMediaNext) {
            dir = 1;
        } else if (isMediaPrev) {
            dir = -1;
        } else {
            if (!e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || isTyping(e.target)) return false;
            if (e.code === 'KeyN' || e.key === 'N' || e.key === 'n') dir = 1;
            else if (e.code === 'KeyP' || e.key === 'P' || e.key === 'p') dir = -1;
        }

        if (!dir) return false;
        if (dir < 0 && (mainVideo()?.currentTime || 0) > 3) return false;
        if (!navigateByOrder(dir)) return false;
        blockShiftKeyUp = true;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return true;
    }

    window.addEventListener('keydown', handleShiftNavKey, true);
    document.addEventListener('keydown', handleShiftNavKey, true);

    window.addEventListener('keyup', (e) => {
        if (!blockShiftKeyUp) return;
        if (
            e.code === 'KeyN' || e.code === 'KeyP' || e.key === 'N' || e.key === 'n' || e.key === 'P' || e.key === 'p' ||
            e.key === 'MediaTrackNext' || e.code === 'MediaTrackNext' || e.keyCode === 176 ||
            e.key === 'MediaTrackPrevious' || e.code === 'MediaTrackPrevious' || e.keyCode === 177
        ) {
            blockShiftKeyUp = false;
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    }, true);

    // ---------- Panel Öğelerine Yıldız, Gizle İkonu ve Sanal Satır Ekleme ----------
    function decorate(item) {
        const host = item.querySelector('#menu');
        if (!host) return;

        if (SHOW_HOVER_BUTTON && !item.querySelector('.ytmixfix-btn')) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ytmixfix-btn';
            btn.title = L().hideFromMix;
            btn.setAttribute('aria-label', L().hideFromMix);
            btn.appendChild(makeSvg(ICONS.eyeOff));
            btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); hideFromItem(item); });
            host.prepend(btn);
        }

        if (SHOW_STAR_BUTTON) {
            let star = item.querySelector('.ytmixfix-star');
            if (!star) {
                star = document.createElement('button');
                star.type = 'button';
                star.className = 'ytmixfix-star';
                for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend']) {
                    star.addEventListener(type, (e) => e.stopPropagation());
                }
                star.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggleFavFromItem(item); });
                host.prepend(star);
            }
            const fav = isFav(idOf(item));
            const nextState = fav ? '1' : '0';
            if (star.dataset.favState !== nextState) {
                star.dataset.favState = nextState;
                star.classList.toggle('on', fav);
                star.textContent = '';
                star.appendChild(makeSvg(fav ? ICONS.starFilled : ICONS.starOutline));
            }
            const tip = fav ? L().removeFavTip : L().addFavTip;
            if (star.title !== tip) { star.title = tip; star.setAttribute('aria-label', tip); }
        }
    }

    // YouTube index=30'dayken DOM'dan sildiği şarkılar için sanal satır oluşturur veya günceller
    function ensureVirtualRow(container, entry, ord, isCurrent) {
        let row = container.querySelector(`${VIRT_SEL}[data-vid="${CSS.escape(entry.id)}"]`);
        if (!row) {
            row = document.createElement('div');
            row.className = 'ytmixfix-virtual-item';
            row.dataset.vid = entry.id;

            const idxBox = document.createElement('div');
            idxBox.className = 'v-idx';

            const thumb = document.createElement('div');
            thumb.className = 'v-thumb';
            const img = document.createElement('img');
            img.loading = 'lazy';
            img.src = `https://i.ytimg.com/vi/${encodeURIComponent(entry.id)}/hqdefault.jpg`;
            img.alt = '';
            thumb.appendChild(img);
            if (entry.dur) {
                const d = document.createElement('span');
                d.className = 'v-dur';
                d.textContent = entry.dur;
                thumb.appendChild(d);
            }

            const meta = document.createElement('div');
            meta.className = 'v-meta';
            const title = document.createElement('div');
            title.className = 'v-title';
            const byline = document.createElement('div');
            byline.className = 'v-byline';
            meta.append(title, byline);

            const actions = document.createElement('div');
            actions.className = 'v-actions';

            const star = document.createElement('button');
            star.type = 'button';
            star.className = 'ytmixfix-star';
            for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend']) {
                star.addEventListener(type, (e) => e.stopPropagation());
            }
            star.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isFav(entry.id)) removeFav(entry.id, false, true);
                else addFav(entry.id, entry.t, false, entry.by, entry.dur);
            });

            const hideBtn = document.createElement('button');
            hideBtn.type = 'button';
            hideBtn.className = 'ytmixfix-btn';
            hideBtn.title = L().hideFromMix;
            hideBtn.appendChild(makeSvg(ICONS.eyeOff));
            hideBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                hideVideo(entry.id, entry.t);
            });

            actions.append(star, hideBtn);
            row.append(idxBox, thumb, meta, actions);

            row.addEventListener('click', (e) => {
                if (e.target?.closest?.('.ytmixfix-star, .ytmixfix-btn')) return;
                e.preventDefault();
                e.stopPropagation();
                navigateToEntry(entry);
            });

            container.appendChild(row);
        }

        const titleEl = row.querySelector('.v-title');
        if (titleEl && titleEl.textContent !== entry.t) {
            titleEl.textContent = entry.t;
            titleEl.title = entry.t;
        }
        const bylineEl = row.querySelector('.v-byline');
        if (bylineEl && bylineEl.textContent !== entry.by) {
            bylineEl.textContent = entry.by;
        }

        const idxBox = row.querySelector('.v-idx');
        if (idxBox) {
            const wantState = isCurrent ? 'play' : String(ord);
            if (idxBox.dataset.state !== wantState) {
                idxBox.dataset.state = wantState;
                idxBox.textContent = '';
                if (isCurrent) idxBox.appendChild(makeSvg(ICONS.playTri));
                else idxBox.textContent = '•';
            }
        }

        const fav = isFav(entry.id);
        const star = row.querySelector('.ytmixfix-star');
        if (star) {
            const nextState = fav ? '1' : '0';
            if (star.dataset.favState !== nextState) {
                star.dataset.favState = nextState;
                star.classList.toggle('on', fav);
                star.textContent = '';
                star.appendChild(makeSvg(fav ? ICONS.starFilled : ICONS.starOutline));
            }
            const tip = fav ? L().removeFavTip : L().addFavTip;
            if (star.title !== tip) { star.title = tip; star.setAttribute('aria-label', tip); }
        }

        row.toggleAttribute('selected', isCurrent);
        row.toggleAttribute(FAV_ATTR, fav);
        if (row.style.order !== String(ord)) row.style.order = String(ord);
    }

    function refresh() {
        if (!isMixPage()) return;
        injectStyle();
        hookPlayerMethods();
        const panel = panelEl();
        if (!panel) return;
        ensureSettingsButton(panel);

        const container = itemsContainer(panel);
        const { orderedQueue, hiddenDomEls } = buildOrderedQueue(panel);
        const curId = currentVideoId();

        // Varsayılan (Default) moddaysa tüm sanal satırları ve özel sıralamayı kaldır, sadece gizlenenleri gizle
        if (favMode === 'default') {
            container?.querySelectorAll(VIRT_SEL).forEach((el) => el.remove());
            for (const item of itemsOf(panel)) {
                const id = idOf(item);
                const hid = isHidden(id);
                const fav = isFav(id);
                decorate(item);
                item.toggleAttribute(GONE_ATTR, hid);
                item.toggleAttribute(FAV_ATTR, !hid && fav);
                if (item.style.order) item.style.order = '';
            }
            updateBadge();
            return;
        }

        const activeVirtualIds = new Set();

        orderedQueue.forEach((entry, idx) => {
            const ord = idx + 1;
            const ordStr = String(ord);
            const fav = isFav(entry.id);

            if (entry.realEl) {
                decorate(entry.realEl);
                if (entry.realEl.hasAttribute(GONE_ATTR)) entry.realEl.removeAttribute(GONE_ATTR);
                if (entry.realEl.hasAttribute(FAV_ATTR) !== fav) entry.realEl.toggleAttribute(FAV_ATTR, fav);
                if (entry.realEl.style.order !== ordStr) entry.realEl.style.order = ordStr;
            } else if (container) {
                activeVirtualIds.add(entry.id);
                ensureVirtualRow(container, entry, ord, entry.id === curId);
            }
        });

        // Artık gerçek DOM satırı gelmiş veya silinmiş olan sanal satırları temizle
        if (container) {
            container.querySelectorAll(VIRT_SEL).forEach((el) => {
                if (!activeVirtualIds.has(el.dataset.vid)) el.remove();
            });
        }

        hiddenDomEls.forEach((item, idx) => {
            const ordStr = String(orderedQueue.length + idx + 1);
            decorate(item);
            if (!item.hasAttribute(GONE_ATTR)) item.setAttribute(GONE_ATTR, '');
            if (item.hasAttribute(FAV_ATTR)) item.removeAttribute(FAV_ATTR);
            if (item.style.order !== ordStr) item.style.order = ordStr;
        });

        updateBadge();
    }

    // ---------- Ayarlar Butonu + Favoriler / Gizlenenler / Geçmiş Penceresi ----------
    const CLOSE_PATH_START = 'M17.293 5.293';

    const hiddenEntries = (key = scopeKey()) => Object.entries(store[key]?.ids || {}).reverse();
    const favEntries = (key = scopeKey()) =>
        Object.entries(favStore[key]?.ids || {})
            .sort((a, b) => (b[1]?.ts || 0) - (a[1]?.ts || 0))
            .map(([id, obj]) => [id, obj?.t || `Video ${id}`]);
    const historyEntries = (isFavTab) => (isFavTab ? histFav : histHidden).map((x) => [x.id, x.t || `Video ${x.id}`]);

    const countHidden = (key) => Object.keys(store[key]?.ids || {}).length;
    const countFav    = (key) => Object.keys(favStore[key]?.ids || {}).length;

    function updateBadge() {
        const b = document.querySelector('.ytmixfix-settings');
        if (!b) return;
        const key = scopeMode === 'global' ? GLOBAL_KEY : mixKey();
        b.dataset.count = String(activeTab === 'fav' ? countFav(key) : countHidden(key));
        b.title = L().settingsTip;
        b.setAttribute('aria-label', L().settingsTip);
    }

    function findCloseButton(panel) {
        const direct = panel.querySelector(
            '#header-top-row #trailing-button > button#button, ' +
            '#trailing-button > button#button, ' +
            '#header-top-row #trailing-button button, ' +
            '#trailing-button button'
        );
        if (direct) return direct;
        for (const p of panel.querySelectorAll('svg path')) {
            if ((p.getAttribute('d') || '').startsWith(CLOSE_PATH_START)) {
                return p.closest('button, yt-icon-button, yt-button-shape') || null;
            }
        }
        return null;
    }

    function ensureSettingsButton(panel) {
        const existing = panel.querySelector('.ytmixfix-settings');
        if (existing) { updateBadge(); positionGear(existing); return; }

        const close = findCloseButton(panel);
        if (!close) return;
        let anchor = close;
        while (
            anchor.parentElement &&
            anchor.parentElement !== panel &&
            anchor.parentElement.tagName !== 'YT-ICON-BUTTON' &&
            anchor.parentElement.children.length === 1
        ) {
            anchor = anchor.parentElement;
        }
        if (!anchor.parentElement) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ytmixfix-settings';
        btn.title = L().settingsTip;
        btn.setAttribute('aria-label', L().settingsTip);
        btn.appendChild(makeSvg(ICONS.gear));
        for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'focus']) {
            btn.addEventListener(type, (e) => e.stopPropagation());
        }
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            btn.blur();
            if (document.getElementById('ytmixfix-pop')) closePop();
            else openPop(btn);
        });
        anchor.parentElement.insertBefore(btn, anchor);
        btn._anchor = anchor;
        positionGear(btn);
        updateBadge();
    }

    function positionGear(btn) {
        const anchor = btn._anchor;
        const parent = btn.parentElement;
        if (!anchor || !parent || !anchor.isConnected) return;
        if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
        const size = 40, gap = 4;
        const h = anchor.offsetHeight || size;
        btn.style.top = (anchor.offsetTop + (h - size) / 2) + 'px';
        btn.style.left = (anchor.offsetLeft - size - gap) + 'px';
    }
    window.addEventListener('resize', () => {
        const b = document.querySelector('.ytmixfix-settings');
        if (b) positionGear(b);
    });

    let popAnchor = null;
    let searchQuery = '';
    let showLangMenu = false;

    function closePop() {
        document.getElementById('ytmixfix-pop')?.remove();
        popAnchor?.classList.remove('open');
        popAnchor = null;
        searchQuery = '';
        showLangMenu = false;
    }

    function openPop(anchorBtn) {
        closePop();
        popAnchor = anchorBtn;
        anchorBtn.classList.add('open');
        const pop = document.createElement('div');
        pop.id = 'ytmixfix-pop';
        document.body.appendChild(pop);
        renderPop();
        const r = anchorBtn.getBoundingClientRect();
        const w = pop.offsetWidth;
        pop.style.top = Math.max(8, Math.min(r.bottom + 8, innerHeight - 120)) + 'px';
        pop.style.left = Math.max(12, Math.min(r.right - w, innerWidth - w - 12)) + 'px';
    }

    function createIconSpan(def) {
        const s = document.createElement('span');
        s.style.display = 'inline-flex';
        s.style.alignItems = 'center';
        s.appendChild(makeSvg(def));
        return s;
    }

    function renderPop() {
        const pop = document.getElementById('ytmixfix-pop');
        if (!pop) return;
        pop.textContent = '';

        const t = L();
        const isFavTab = activeTab === 'fav';
        const isHistView = scopeMode === 'history';
        const key = scopeMode === 'global' ? GLOBAL_KEY : mixKey();
        const entries = isHistView
            ? historyEntries(isFavTab)
            : (isFavTab ? favEntries(key) : hiddenEntries(key));

        // 1) Üst Çubuk: [ Favoriler | Gizlenenler ] + [ Dil Seçici Butonu ]
        const topbar = document.createElement('div');
        topbar.className = 'topbar';

        const topTabs = document.createElement('div');
        topTabs.className = 'tabs';
        const badgeKey = scopeMode === 'global' ? GLOBAL_KEY : mixKey();
        const mainTabs = [
            ['fav',    t.favTab,    ICONS.starFilled, countFav(badgeKey),    true],
            ['hidden', t.hiddenTab, ICONS.eyeOff,     countHidden(badgeKey), false]
        ];
        for (const [id, label, iconSvg, cntVal, favStyle] of mainTabs) {
            const b = document.createElement('button');
            b.type = 'button';
            if (activeTab === id) b.className = favStyle ? 'on fav-tab' : 'on';
            const txt = document.createElement('span');
            txt.textContent = label;
            const cnt = document.createElement('span');
            cnt.className = 'cnt';
            cnt.textContent = String(cntVal);
            b.append(createIconSpan(iconSvg), txt, cnt);
            b.addEventListener('click', () => {
                activeTab = id;
                searchQuery = '';
                try { localStorage.setItem(TAB_KEY, id); } catch { /* yoksay */ }
                renderPop();
            });
            topTabs.appendChild(b);
        }

        const langBtn = document.createElement('button');
        langBtn.type = 'button';
        langBtn.className = 'lang-btn' + (showLangMenu ? ' on' : '');
        langBtn.title = t.langTitle;
        const langCode = document.createElement('span');
        langCode.textContent = activeLangCode().toUpperCase();
        langBtn.append(createIconSpan(ICONS.globe), langCode);
        langBtn.addEventListener('click', () => { showLangMenu = !showLangMenu; renderPop(); });

        topbar.append(topTabs, langBtn);
        pop.appendChild(topbar);

        if (showLangMenu) {
            const lp = document.createElement('div');
            lp.className = 'lang-panel';

            const htmlLangRaw = document.documentElement?.getAttribute('lang') || navigator.language || 'tr-TR';
            const autoBtn = document.createElement('button');
            autoBtn.type = 'button';
            autoBtn.className = 'full' + (langPref === 'auto' ? ' on' : '');
            const autoLbl = document.createElement('span');
            autoLbl.textContent = `${t.langAuto} (${htmlLangRaw})`;
            const autoCode = document.createElement('span');
            autoCode.className = 'code';
            autoCode.textContent = detectHtmlLang().toUpperCase();
            autoBtn.append(autoLbl, autoCode);
            autoBtn.addEventListener('click', () => {
                langPref = 'auto';
                showLangMenu = false;
                try { localStorage.setItem(LANG_KEY, 'auto'); } catch { /* yoksay */ }
                syncChannel?.postMessage('sync');
                refresh();
                renderPop();
            });
            lp.appendChild(autoBtn);

            for (const [code, dict] of Object.entries(I18N)) {
                const b = document.createElement('button');
                b.type = 'button';
                if (langPref === code) b.className = 'on';
                const nameSpan = document.createElement('span');
                nameSpan.textContent = dict.name;
                const codeSpan = document.createElement('span');
                codeSpan.className = 'code';
                codeSpan.textContent = code;
                b.append(nameSpan, codeSpan);
                b.addEventListener('click', () => {
                    langPref = code;
                    showLangMenu = false;
                    try { localStorage.setItem(LANG_KEY, code); } catch { /* yoksay */ }
                    syncChannel?.postMessage('sync');
                    refresh();
                    renderPop();
                });
                lp.appendChild(b);
            }
            pop.appendChild(lp);
        }

        // 2) Alt Kapsam & Geçmiş Sekmeleri: [ Sadece bu mix ] [ Tüm mixler ] [ Geçmiş ]
        const scope = document.createElement('div');
        scope.className = 'scope';
        const subTabs = [
            ['mix',     t.onlyThisMix, null,          isFavTab ? countFav(mixKey())    : countHidden(mixKey())],
            ['global',  t.allMixes,    null,          isFavTab ? countFav(GLOBAL_KEY) : countHidden(GLOBAL_KEY)],
            ['history', t.history,     ICONS.history, isFavTab ? histFav.length        : histHidden.length]
        ];
        for (const [mode, label, iconSvg, count] of subTabs) {
            const b = document.createElement('button');
            b.type = 'button';
            if (scopeMode === mode) b.className = 'on';
            if (iconSvg) b.appendChild(createIconSpan(iconSvg));
            const txt = document.createElement('span');
            txt.textContent = label;
            const cnt = document.createElement('span');
            cnt.className = 'cnt';
            cnt.textContent = String(count);
            b.append(txt, cnt);
            b.addEventListener('click', () => {
                scopeMode = mode;
                searchQuery = '';
                try { localStorage.setItem(SCOPE_KEY, mode); } catch { /* yoksay */ }
                syncChannel?.postMessage('sync');
                refresh();
                renderPop();
            });
            scope.appendChild(b);
        }
        pop.appendChild(scope);

        // 3) Favoriler Çalma Modu seçici: [ Varsayılan | Sıralı | Karışık | Aralı ]
        if (isFavTab && !isHistView) {
            const pm = document.createElement('div');
            pm.className = 'playmode';
            const btnRow = document.createElement('div');
            btnRow.className = 'playmode-btns';
            const desc = document.createElement('div');
            desc.className = 'playmode-desc';

            const modes = [
                ['default',    t.modeDefault,    ICONS.defaultMode, t.descDefault],
                ['normal',     t.modeNormal,     ICONS.ordered,     t.descNormal],
                ['shuffle',    t.modeShuffle,    ICONS.shuffle,     t.descShuffle],
                ['interleave', t.modeInterleave, ICONS.interleave,  t.descInterleave]
            ];
            for (const [mKey, mLabel, mIcon, mDesc] of modes) {
                const b = document.createElement('button');
                b.type = 'button';
                const lbl = document.createElement('span');
                lbl.textContent = mLabel;
                b.append(createIconSpan(mIcon), lbl);
                if (favMode === mKey) { b.className = 'on'; desc.textContent = mDesc; }
                b.addEventListener('click', () => {
                    favMode = mKey;
                    if (mKey === 'shuffle' || mKey === 'interleave') {
                        shuffleSeed = (Date.now() & 0x7fffffff) || 1;
                        try { localStorage.setItem(SEED_KEY, String(shuffleSeed)); } catch { /* yoksay */ }
                    }
                    try { localStorage.setItem(FAV_MODE_KEY, mKey); } catch { /* yoksay */ }
                    syncChannel?.postMessage('sync');
                    refresh();
                    renderPop();
                });
                btnRow.appendChild(b);
            }
            pm.append(btnRow, desc);
            pop.appendChild(pm);
        }

        // 4) Arama kutusu + Liste
        const list = document.createElement('div');
        list.className = 'list';

        function fillRows() {
            list.textContent = '';
            const q = searchQuery.trim().toLowerCase();
            const filtered = q
                ? entries.filter(([id, title]) => (typeof title === 'string' ? title : id).toLowerCase().includes(q))
                : entries;

            if (filtered.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'empty';
                if (q) empty.textContent = t.noMatch;
                else if (isHistView) empty.textContent = isFavTab ? t.emptyHistFav : t.emptyHistHidden;
                else if (isFavTab) empty.textContent = scopeMode === 'mix' ? t.emptyFavMix : t.emptyFavAll;
                else empty.textContent = scopeMode === 'mix' ? t.emptyHiddenMix : t.emptyHiddenAll;
                list.appendChild(empty);
                return;
            }

            for (const [id, title] of filtered) {
                const row = document.createElement('div');
                row.className = 'row';
                const img = document.createElement('img');
                img.loading = 'lazy';
                img.alt = '';
                img.src = `https://i.ytimg.com/vi/${encodeURIComponent(id)}/default.jpg`;
                const titleEl = document.createElement('div');
                titleEl.className = 't';
                const name = typeof title === 'string' && title && title !== '1' ? title : `Video ${id}`;
                titleEl.textContent = name;
                titleEl.title = name;
                titleEl.addEventListener('click', () => {
                    closePop();
                    navigateToEntry({ id, t: name });
                });

                const action = document.createElement('button');
                action.type = 'button';
                action.className = 'act';

                if (isHistView) {
                    action.textContent = isFavTab ? t.reAddFav : t.reHide;
                    action.addEventListener('click', () => {
                        if (isFavTab) addFav(id, name, false);
                        else hideVideo(id, name);
                    });
                    const delBtn = document.createElement('button');
                    delBtn.type = 'button';
                    delBtn.className = 'del';
                    delBtn.title = t.remove;
                    delBtn.appendChild(makeSvg(ICONS.closeSmall));
                    delBtn.addEventListener('click', () => {
                        if (isFavTab) removeFromHistory(histFav, HIST_FAV_KEY, id);
                        else removeFromHistory(histHidden, HIST_HIDDEN_KEY, id);
                        syncChannel?.postMessage('sync');
                        renderPop();
                    });
                    row.append(img, titleEl, action, delBtn);
                } else {
                    action.textContent = isFavTab ? t.remove : t.restore;
                    action.addEventListener('click', () => {
                        if (isFavTab) removeFav(id, false, true);
                        else unhideVideo(id, true);
                    });
                    row.append(img, titleEl, action);
                }
                list.appendChild(row);
            }
        }

        if (entries.length > 5) {
            const searchWrap = document.createElement('div');
            searchWrap.className = 'search';
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.placeholder = isHistView ? t.searchHistory : (isFavTab ? t.searchFav : t.searchHidden);
            inp.value = searchQuery;
            inp.addEventListener('input', () => { searchQuery = inp.value; fillRows(); });
            searchWrap.append(makeSvg(ICONS.search), inp);
            pop.appendChild(searchWrap);
        }

        fillRows();
        pop.appendChild(list);

        if (entries.length > 0 && (isHistView || entries.length > 1)) {
            const ft = document.createElement('div');
            ft.className = 'ft';
            const all = document.createElement('button');
            all.type = 'button';
            const allTxt = document.createElement('span');
            allTxt.textContent = isHistView ? t.clearHistory : (isFavTab ? t.removeAllFav : t.restoreAllHidden);
            all.append(createIconSpan(ICONS.trash), allTxt);

            all.addEventListener('click', () => {
                if (isHistView) {
                    if (isFavTab) { histFav = []; saveHistory(HIST_FAV_KEY, histFav); }
                    else { histHidden = []; saveHistory(HIST_HIDDEN_KEY, histHidden); }
                    syncChannel?.postMessage('sync');
                } else if (isFavTab) {
                    for (const [id, title] of entries) pushHistory(histFav, HIST_FAV_KEY, id, title);
                    if (scopeMode === 'global') favStore = {};
                    else for (const [id] of entries) for (const k of Object.keys(favStore)) delete favStore[k]?.ids?.[id];
                    saveFavStore();
                } else {
                    for (const [id, title] of entries) pushHistory(histHidden, HIST_HIDDEN_KEY, id, title);
                    if (scopeMode === 'global') store = {};
                    else for (const [id] of entries) for (const k of Object.keys(store)) delete store[k]?.ids?.[id];
                    saveStore();
                    skippedFrom = null;
                }
                refresh();
                renderPop();
            });
            ft.appendChild(all);
            pop.appendChild(ft);
        }
        updateBadge();
    }

    document.addEventListener('click', (e) => {
        if (!popAnchor) return;
        if (e.target?.closest?.('#ytmixfix-pop, .ytmixfix-settings')) return;
        closePop();
    }, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(); }, true);
    window.addEventListener('yt-navigate-start', closePop);

    // ---------- Üç Nokta Menüsüne Satır Ekleme ----------
    let menuTimer = null;

    function closePopup(from) {
        const dd = from.closest('tp-yt-iron-dropdown');
        if (dd && typeof dd.close === 'function') dd.close();
        else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    }

    function findMenuList() {
        const root = document.querySelector('ytd-popup-container');
        if (!root) return null;
        const candidates = root.querySelectorAll(
            'tp-yt-iron-dropdown:not([aria-hidden="true"]) ytd-menu-popup-renderer tp-yt-paper-listbox#items, ' +
            'tp-yt-iron-dropdown:not([aria-hidden="true"]) tp-yt-paper-listbox, ' +
            'tp-yt-iron-dropdown:not([aria-hidden="true"]) yt-list-view-model, ' +
            'ytd-menu-popup-renderer tp-yt-paper-listbox#items'
        );
        for (const el of candidates) {
            const r = el.getBoundingClientRect();
            if (r.width > 30 && r.height > 20) return el;
        }
        return null;
    }

    function addMenuEntry(item) {
        const list = findMenuList();
        if (!list) return false;
        if (list.querySelector('.ytmixfix-menu-item')) return true;

        const row = document.createElement('div');
        row.className = 'ytmixfix-menu-item';
        row.setAttribute('role', 'menuitem');
        const icon = document.createElement('span');
        icon.className = 'ico';
        icon.appendChild(makeSvg(ICONS.eyeOff));
        const label = document.createElement('span');
        label.textContent = L().hideFromMix;
        row.append(icon, label);
        row.addEventListener('click', (e) => {
            e.stopPropagation();
            closePopup(row);
            hideFromItem(item);
        });
        list.appendChild(row);
        const dd = list.closest('tp-yt-iron-dropdown');
        if (dd && typeof dd.refit === 'function') dd.refit();
        return true;
    }

    document.addEventListener('click', (e) => {
        if (e.target?.closest?.('.ytmixfix-menu-item')) return;
        document.querySelectorAll('.ytmixfix-menu-item').forEach((n) => n.remove());
        clearInterval(menuTimer);

        if (!SHOW_MENU_ENTRY || !isMixPage()) return;
        const target = e.target;
        if (!target?.closest || target.closest('.ytmixfix-btn, .ytmixfix-star')) return;

        const menu = target.closest(`ytd-playlist-panel-renderer#playlist ${ITEM_SEL} #menu`);
        if (!menu) return;
        const item = menu.closest(ITEM_SEL);

        let n = 0;
        menuTimer = setInterval(() => {
            if (addMenuEntry(item) || ++n >= 40) clearInterval(menuTimer);
        }, 35);
    }, true);

    // ---------- Panel Gösterme ve Anında Yükleme ----------
    const hasItems = (panel) => {
        const contents = panel.data?.contents;
        return contents === undefined ? true : contents.length > 0;
    };

    function sync(panel) {
        const mix = isMixPage() && (panel.getAttribute('playlist-type') || '').startsWith('RD');
        if (mix) {
            if (panel.hasAttribute('hidden') && hasItems(panel)) {
                panel.removeAttribute('hidden');
                panel.dataset[MARK] = '1';
            }
        } else if (panel.dataset[MARK]) {
            panel.setAttribute('hidden', '');
            delete panel.dataset[MARK];
        }
    }

    let panelObserver = null, listObserver = null, observedPanel = null, refreshQueued = false;

    function queueRefresh() {
        if (refreshQueued) return;
        refreshQueued = true;
        requestAnimationFrame(() => {
            refreshQueued = false;
            refresh();
            skipIfHidden();
        });
    }

    function fixPanel() {
        injectStyle();
        const panel = panelEl();
        if (!panel) return;

        sync(panel);
        refresh();
        skipIfHidden();

        if (panel !== observedPanel) {
            panelObserver?.disconnect();
            listObserver?.disconnect();
            observedPanel = panel;

            panelObserver = new MutationObserver(() => sync(panel));
            panelObserver.observe(panel, { attributes: true, attributeFilter: ['hidden', 'playlist-type'] });

            listObserver = new MutationObserver(queueRefresh);
            listObserver.observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'selected'] });
        }
    }

    let timer = null;
    function schedule() {
        clearInterval(timer);
        let tries = 0;
        fixPanel();
        timer = setInterval(() => {
            fixPanel();
            if (++tries >= 40) clearInterval(timer);
        }, 80);
    }

    const bootObserver = new MutationObserver(() => {
        if (panelEl()) {
            bootObserver.disconnect();
            fixPanel();
        }
    });
    if (document.documentElement) {
        bootObserver.observe(document.documentElement, { childList: true, subtree: true });
    }

    window.ytMixFix = {
        reset() {
            store = {}; favStore = {}; histHidden = []; histFav = []; mixPool = {};
            saveStore(); saveFavStore(); savePool();
            saveHistory(HIST_HIDDEN_KEY, histHidden);
            saveHistory(HIST_FAV_KEY, histFav);
            skippedFrom = null;
            refresh();
            renderPop();
        },
        list: () => ({
            hidden: JSON.parse(JSON.stringify(store)),
            favorites: JSON.parse(JSON.stringify(favStore)),
            pool: JSON.parse(JSON.stringify(mixPool)),
            historyHidden: [...histHidden],
            historyFavorites: [...histFav]
        })
    };

    window.addEventListener('DOMContentLoaded', schedule);
    window.addEventListener('yt-navigate-start', schedule);
    window.addEventListener('yt-navigate-finish', schedule);
    window.addEventListener('yt-page-data-updated', schedule);
    schedule();
})();
