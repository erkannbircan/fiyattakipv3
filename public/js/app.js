// ---- GLOBAL ÇATI (her JS dosyasının en üstüne koy) ----
window.App = window.App || {
  // sürüm bilgisi bu tur için (elle güncelle)
  version: 'v3.0.0-' + (window.App?.versionTag || ''),
  loaded: {},
  guards: {},
  log: (...args) => console.log('[App]', ...args),
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// app.js dosyasının yaklaşık 11. satırı

function initializeApp() {
    console.log('Adım 1: initializeApp fonksiyonu başladı.'); // <-- BU SATIRI EKLE
    // Firebase güvenlik kontrolü
    if (typeof firebase === 'undefined' || !firebase.initializeApp) {
        console.error('Firebase SDK yüklenmedi ya da sırası yanlış. Lütfen <script src="firebase-*.js"> etiketlerini kontrol et.');
        return;
    }

    try {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    state.firebase.auth = firebase.auth();
    state.firebase.db = firebase.firestore();

    // ✅ UI'nin beklediği kısa yol: alias ekle
    state.firebase.firestore = state.firebase.db;

    state.firebase.functions = firebase.app().functions('europe-west1');
  } catch (e) {
    console.error('Firebase init hatası:', e);
    return;
  }

    // Bu fonksiyonlar bazı sayfalarda/yük sıralarında henüz gelmemiş olabilir.
    if (typeof window.setupGlobalEventListeners === 'function') {
        window.setupGlobalEventListeners();
    } else {
        console.warn('setupGlobalEventListeners henüz yüklenmemiş.');
    }

    if (typeof window.setupAuthEventListeners === 'function') {
        window.setupAuthEventListeners();
    } else {
        console.warn('setupAuthEventListeners henüz yüklenmemiş.');
    }
    
    if (typeof window.showPage !== 'function') {
  window.showPage = function(id) {
    document.querySelectorAll('.page').forEach(el => {
      el.style.display = (el.id === id ? 'block' : 'none');
    });
    try { document.getElementById(id)?.scrollIntoView({ behavior:'auto', block:'start' }); } catch (_) {}
  };
}
// Bu dosyada tanımlı olduğu için güvenle çağırabiliriz (her durumda çalışsın)
initializeAuthListener();
} // <-- initializeApp burada biter (EKLENDİ)



// app.js dosyasının yaklaşık 68. satırı

function initializeAuthListener() {
    console.log('Adım 2: initializeAuthListener fonksiyonu başladı.'); // <-- BU SATIRI EKLE
    state.firebase.auth.onAuthStateChanged(async user => {
        // console.log('Adım 3: Auth durumu değişti, kontrol ediliyor...'); // <-- Silebilirsin
        if (user) {
            // console.log('Sonuç: Kullanıcı GİRİŞ YAPMIŞ durumda.'); // <-- Silebilirsin
            showPage('tracker-page'); // <-- PERDEYİ AÇAN KOMUT BU!
            state.user = user;
            state.userDocRef = state.firebase.db.collection('users').doc(user.uid);
            try {
                const doc = await state.userDocRef.get();
                let userData = doc.data();
                if (!doc.exists) {
                    userData = {
                         email: user.email,
                        role: 'new_user',
                        portfolios: { "Varsayılan": ["BTCUSDT", "ETHUSDT", "SOLUSDT"] },
                        activePortfolio: "Varsayılan",
                        coins_discovery: ["BTCUSDT", "ETHUSDT"],
                        settings: getDefaultSettings(),
                        alarms: []
                    };
                    await state.userDocRef.set(userData, { merge: true });
                }

                loadSettingsAndRole(userData);
                if (!state.pageInitialized) {
                    await initializeTrackerPage(userData);
                }

              try {
  const path = window.location.pathname;
  if (typeof loadAlarmReports === 'function' &&
      (path.endsWith('/sinyal-performans.html') || path.includes('sinyal-performans'))) {
    await loadAlarmReports();
  }
} catch (e) {
  console.warn('[App] Alarm raporları otomatik yüklenemedi:', e);
}
                updateAdminUI();

            } catch (err) {
                console.error("Auth/Firestore Hatası:", err);
                const errorMessageDiv = document.getElementById('error-message');
                if (errorMessageDiv) {
                    errorMessageDiv.textContent = `Bir hata oluştu: ${err.message}`;
                }
                state.firebase.auth.signOut();
            }
        } else {
           console.log('Sonuç: Kullanıcı GİRİŞ YAPMAMIŞ durumda. Login sayfası gösterilecek.'); // <-- BU SATIRI EKLE
            showPage('login-page');
            state.pageInitialized = false;
            state.userDocRef = null;
            if (state.autoRefreshTimer) clearInterval(state.autoRefreshTimer);
            if (state.reportsRefreshTimer) clearInterval(state.reportsRefreshTimer);
            // YENİ: Oturum kapanınca tarayıcıyı da durdur.
            if (state.liveScannerTimer) clearInterval(state.liveScannerTimer);
        }
    });
}

function loadSettingsAndRole(userData) {
    const defaultSettings = getDefaultSettings();
    state.settings = { 
        ...defaultSettings, 
        ...userData.settings,
        chartIndicators: userData.settings?.chartIndicators || {} // ← BU SATIRI EKLEYİN
    };
    state.settings.columns = { ...defaultSettings.columns, ...(userData.settings?.columns || {}) };
    state.settings.colors = { ...defaultSettings.colors, ...(userData.settings?.colors || {}) };
    state.trackedReports = userData.settings?.trackedReportIds || [];
    state.settings.chartStates_v2 = userData.settings?.chartStates_v2 || {};
    state.currentUserRole = userData.role;
    const limits = { admin: { coin: Infinity }, qualified: { coin: 50 }, new_user: { coin: 15 } };
    state.coinLimit = limits[state.currentUserRole]?.coin ?? 15;
    document.getElementById('userEmail').textContent = state.firebase.auth.currentUser.email;
}

// app.js içindeki initializeTrackerPage fonksiyonunun YENİ HALİ
async function initializeTrackerPage(userData) {
    state.pageInitialized = true;

    // --- TÜM SAYFALAR İÇİN ORTAK AYARLAR ---
    state.userPortfolios = userData.portfolios || { "Varsayılan": ["BTCUSDT", "ETHUSDT", "SOLUSDT"] };
    state.activePortfolio = userData.activePortfolio || Object.keys(state.userPortfolios)[0];
    state.discoveryCoins = userData.coins_discovery || ["BTCUSDT", "ETHUSDT"];
    
    applySettingsToUI();
    renderAllPortfolioTabs();
 fetchFearAndGreedIndex().then(renderFearAndGreedWidget);
  
    // --- YENİ YAPI: Ana olay dinleyici başlatıcısını çağır ---
    if (typeof initializeEventListeners === 'function') {
        initializeEventListeners();
    } else {
        console.error("HATA: events.js'teki initializeEventListeners fonksiyonu bulunamadı!");
    }

    // --- SAYFAYA ÖZEL İÇERİĞİ YÜKLE ---
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    if ((currentPage === 'index.html' || currentPage === '')) {
        await fetchAllDataAndRender();
        createCoinManager('crypto-coin-manager-container', state.userPortfolios[state.activePortfolio] || [], 'crypto');
    }
    else if (currentPage === 'strateji.html') {
        createCoinManager('discovery-coin-manager-container', state.discoveryCoins, 'discovery');
    }
    else if (currentPage === 'backtest.html') {
        fetchDnaProfiles('dnaProfilesContainer');
    }
}

// GITHUB/public/js/app.js DOSYASINDAKİ fetchAllDataAndRender FONKSİYONUNUN YENİ HALİ
async function fetchAllDataAndRender() {
    // --- YENİ: "Meşgulüm" kontrolü ---
    if (state.isFetchingData) {
        console.warn("Zaten devam eden bir veri çekme işlemi var. Yenisi iptal edildi.");
        return;
    }
    state.isFetchingData = true; // "Meşgulüm" tabelasını as

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) showLoading(refreshBtn);

    try {
        let currentCoinList = state.userPortfolios[state.activePortfolio] || [];
        // --- YENİ: Listeyi her ihtimale karşı temizleyerek çift kayıtları engelleyelim ---
        currentCoinList = [...new Set(currentCoinList)];
        state.userPortfolios[state.activePortfolio] = currentCoinList;

        const promises = currentCoinList.map(pair => fetchCryptoData(pair, false));
        state.allCryptoData = await Promise.all(promises);
        sortAndRenderTable();
        renderSupportResistance(); // Bu fonksiyonun ui.js içinde olduğundan emin ol
        
        const updateTimeEl = document.getElementById('updateTime');
        if (updateTimeEl) updateTimeEl.textContent = new Date().toLocaleString(state.settings.lang);
    } catch (error) {
        console.error("fetchAllDataAndRender sırasında hata:", error);
        showNotification("Veriler yüklenirken bir hata oluştu.", false);
    } finally {
        // --- YENİ: İşlem bitince veya hata olunca tabelayı kaldır ve butonu düzelt ---
        if (refreshBtn) hideLoading(refreshBtn);
        state.isFetchingData = false; // "Meşgulüm" tabelasını kaldır
    }
}


function sortAndRenderTable() {
    const { key, order } = state.currentSort;
    let sortedData = (order === 'default') ? [...state.allCryptoData] : [...state.allCryptoData].sort((a, b) => {
        let valA, valB;
        if (key.startsWith('col')) { valA = a[key]?.pct; valB = b[key]?.pct; }
        else { valA = a[key]; valB = b[key]; }
        if (a.error) return 1; if (b.error) return -1;
        if (valA === undefined || valA === null || valA === 'N/A') return 1;
        if (valB === undefined || valB === null || valB === 'N/A') return -1;
        if (typeof valA === 'string') return order === 'asc' ? valA.localeCompare(valA) : valB.localeCompare(valA);
        return order === 'asc' ? valA - valB : valB - valA;
    });

    document.querySelectorAll('#crypto-content th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.sortKey === key && order !== 'default') th.classList.add(order);
    });
    updateAllTableRows(sortedData);
}
// app.js dosyasına EKLENECEK YENİ fonksiyon
async function sendTestTelegramMessage() {
    const btn = document.getElementById('sendTelegramTestBtn');
    try {
        const input = document.getElementById('telegramChatIdInput');
        const chatId = (input?.value || '').trim();
        if (!chatId) {
            showNotification('Lütfen geçerli bir Telegram Chat ID girin.', false);
            return;
        }
        showLoading(btn);
        const callSendTest = state.firebase.functions.httpsCallable('sendTestNotification');
        await callSendTest({ chatId: chatId, text: '✅ Tebrikler! Bu bir test mesajıdır.' });
        showNotification('Test mesajı başarıyla gönderildi.', true);
    } catch (error) {
        console.error('Telegram test gönderimi başarısız:', error);
        showNotification(`Hata: ${error.message}`, false);
    } finally {
        hideLoading(btn);
    }
}

function saveSettings() {
    const btn = document.getElementById('saveSettingsBtn');
    showLoading(btn);

    let interval = parseInt(document.getElementById('refreshInterval').value);
    const minInterval = { admin: 10, qualified: 120, new_user: 300 }[state.currentUserRole] || 300;
    if (interval < minInterval) interval = minInterval;

    const visibleColumns = {};
    document.querySelectorAll('#columnVisibilityCheckboxes input[type="checkbox"]').forEach(cb => {
        if (!cb.disabled) {
            visibleColumns[cb.dataset.col] = cb.checked;
        }
    });
    
    const settingsToUpdate = {
        lang: document.getElementById('langSelect').value,
        autoRefresh: document.getElementById('autoRefreshToggle').checked,
        refreshInterval: interval,
        telegramChatId: document.getElementById('telegramChatIdInput').value,
        visibleColumns: visibleColumns,
        columns: {
            1: { name: document.getElementById('col1_name_input').value, days: parseInt(document.getElementById('col1_days_input').value), threshold: parseFloat(document.getElementById('col1_threshold_input').value) },
            2: { name: document.getElementById('col2_name_input').value, days: parseInt(document.getElementById('col2_days_input').value), threshold: parseFloat(document.getElementById('col2_threshold_input').value) },
            3: { name: document.getElementById('col3_name_input').value, days: parseInt(document.getElementById('col3_days_input').value), threshold: parseFloat(document.getElementById('col3_threshold_input').value) }
        },
        colors: { high: document.getElementById('high_color_input').value, low: document.getElementById('low_color_input').value }
    };

    Object.assign(state.settings, settingsToUpdate);

    if (state.userDocRef) {
        state.userDocRef.update({ settings: state.settings })
            .then(() => {
                applySettingsToUI(); // Bu fonksiyon UI'ı güncelleyecek
                closeAllPanels();
                showNotification("Ayarlar başarıyla kaydedildi.", true);
                const toggle = document.getElementById('toggleAutoScanner');
                if (toggle && toggle.checked) {
                    toggleAutoScanner(true);
                }
            })
            .catch((error) => {
                console.error("Ayarları kaydederken hata oluştu:", error);
                showNotification("Hata: Ayarlar kaydedilemedi.", false);
            })
            .finally(() => {
                hideLoading(btn);
            });
    }
}

function toggleAutoRefresh() {
    if (state.autoRefreshTimer) {
        clearInterval(state.autoRefreshTimer);
        state.autoRefreshTimer = null;
    }
    if (state.settings.autoRefresh) {
        const intervalSeconds = state.settings.refreshInterval;
        if (!isNaN(intervalSeconds) && intervalSeconds >= 10) {
            state.autoRefreshTimer = setInterval(fetchAllDataAndRender, intervalSeconds * 1000);
        }
    }
}

function toggleReportsAutoRefresh(forceState) {
    const btn = document.getElementById('autoRefreshReportsToggle');
    if (!btn) return;
    let shouldBeActive = forceState !== undefined ? forceState : !btn.classList.contains('active');

    if (state.reportsRefreshTimer) {
        clearInterval(state.reportsRefreshTimer);
        state.reportsRefreshTimer = null;
    }
    btn.classList.toggle('active', shouldBeActive);

    if (shouldBeActive) {
        const intervalSeconds = state.settings.refreshInterval;
        if (!isNaN(intervalSeconds) && intervalSeconds >= 10) {
            state.reportsRefreshTimer = setInterval(renderAlarmReports, intervalSeconds * 1000);
            if (forceState === undefined) showNotification("Rapor yenileme aktif.", true);
        }
    } else {
        if (forceState === undefined) showNotification("Rapor yenileme durduruldu.", true);
    }
}

// app.js dosyasındaki handleAddCoin fonksiyonunu bununla değiştirin
async function handleAddCoin(listName) {
    // İyileştirme: Input alanını, aktif olan sekme içinden daha spesifik olarak bul.
    const activeTabContent = document.querySelector('.tab-content.active');
    const input = activeTabContent.querySelector(`.new-coin-input[data-list-name="${listName}"]`);
    if (!input) {
        console.error(`Coin input alanı bulunamadı: ${listName}`);
        return;
    }

    let assetList;
    if (listName === 'crypto') assetList = state.userPortfolios[state.activePortfolio] || [];
    else if (listName === 'discovery') assetList = state.discoveryCoins || [];
    else if (listName === 'alarm') assetList = state.tempAlarmCoins || [];
    else return;

    const newAssetSymbols = input.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (newAssetSymbols.length === 0) return;

    if (listName !== 'alarm' && state.coinLimit !== Infinity && (assetList.length + newAssetSymbols.length) > state.coinLimit) {
        showNotification(translations[state.settings.lang].role_info(state.currentUserRole, state.coinLimit, 'coin'), false);
        return;
    }

    const addedCoins = [];
    for (const symbol of newAssetSymbols) {
        const newPair = !symbol.endsWith('USDT') ? `${symbol}USDT` : symbol;
        if (assetList.includes(newPair)) {
            showNotification(translations[state.settings.lang].already_in_list(symbol), false);
            continue;
        }
        try {
            await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${newPair}`);
            assetList.push(newPair);
            addedCoins.push(newPair);
        } catch (error) {
            showNotification(translations[state.settings.lang].invalid_asset(symbol), false);
        }
    }

    if (addedCoins.length > 0) {
        updateCoinList(listName, assetList);
        await saveCoinListToFirestore(listName);
        if (listName === 'crypto') await fetchAllDataAndRender();
    }
    input.value = '';
}

async function handleRemoveCoin(listName, pair) {
    let assetList;
    if (listName === 'crypto') assetList = state.userPortfolios[state.activePortfolio];
    else if (listName === 'discovery') assetList = state.discoveryCoins;
    else if (listName === 'alarm') assetList = state.tempAlarmCoins;
    else return;

    const updatedList = (assetList || []).filter(p => p !== pair);

    if (listName === 'crypto') state.userPortfolios[state.activePortfolio] = updatedList;
    else if (listName === 'discovery') state.discoveryCoins = updatedList;
    else if (listName === 'alarm') state.tempAlarmCoins = updatedList;

    updateCoinList(listName, updatedList);
    await saveCoinListToFirestore(listName);
    if (listName === 'crypto') await fetchAllDataAndRender();
}

async function saveCoinListToFirestore(listName) {
    if (!state.userDocRef) return;
    try {
        if (listName === 'crypto') await state.userDocRef.update({ portfolios: state.userPortfolios });
        else if (listName === 'discovery') await state.userDocRef.update({ coins_discovery: state.discoveryCoins });
    } catch (error) {
        console.error(`Error saving ${listName} list:`, error);
    }
}

async function setActivePortfolio(name) {
    state.activePortfolio = name;
    if (state.userDocRef) { await state.userDocRef.update({ activePortfolio: name }); }
    renderAllPortfolioTabs();
    await fetchAllDataAndRender();
    createCoinManager('crypto-coin-manager-container', state.userPortfolios[state.activePortfolio] || [], 'crypto');
}

async function handlePortfolioSave() {
    const action = document.getElementById('portfolioActionInput').value;
    const newName = document.getElementById('portfolioNameInput').value.trim();
    const originalName = document.getElementById('originalPortfolioNameInput').value;
    const errorDiv = document.getElementById('portfolio-error-message');

    if (!newName) { errorDiv.textContent = 'Liste adı boş olamaz.'; return; }
    if (state.userPortfolios[newName] && newName !== originalName) { errorDiv.textContent = 'Bu isimde bir liste zaten var.'; return; }

    if (action === 'new') {
        state.userPortfolios[newName] = [];
    } else if (action === 'rename') {
        const updatedPortfolios = {};
        for (const key in state.userPortfolios) {
            updatedPortfolios[key === originalName ? newName : key] = state.userPortfolios[key];
        }
        state.userPortfolios = updatedPortfolios;
    }
    await state.userDocRef.update({ portfolios: state.userPortfolios });
    await setActivePortfolio(newName);
    showNotification(action === 'new' ? `Liste "${newName}" oluşturuldu.` : `Liste "${originalName}" -> "${newName}" olarak değiştirildi.`, true);
    closeAllPanels();
}

async function handleDeletePortfolio() {
    if (Object.keys(state.userPortfolios).length <= 1) { showNotification("Son listeyi silemezsiniz!", false); return; }
    if (confirm(`"${state.activePortfolio}" listesini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
        const deletedPortfolio = state.activePortfolio;
        delete state.userPortfolios[state.activePortfolio];
        const newActive = Object.keys(state.userPortfolios)[0];
        await state.userDocRef.update({ portfolios: state.userPortfolios });
        await setActivePortfolio(newActive);
        showNotification(`"${deletedPortfolio}" listesi silindi.`, true);
    }
}

// Fonksiyon artık parametre olarak bir 'widget' alıyor.
// Tek tip imza: pair ile kaydet (ui.js ile aynı davranış)
function saveChartState(pair) {
  try {
    if (!pair || !state.tradingViewWidget) {
      console.warn("saveChartState: pair veya widget yok.");
      return;
    }

    // TradingView'den çalışmalar ve çizimler
    const studiesList = typeof state.tradingViewWidget.getStudiesList === 'function'
      ? state.tradingViewWidget.getStudiesList()
      : [];
    const drawings = typeof state.tradingViewWidget.getDrawings === 'function'
      ? state.tradingViewWidget.getDrawings()
      : [];

    const updateData = {
      [`settings.chartIndicators.${pair}`]: studiesList,
      [`settings.chartDrawings.${pair}`]: drawings
    };

    if (state.userDocRef) {
      state.userDocRef.update(updateData)
        .then(() => {
          // local state’i de güncelle
          state.settings.chartIndicators = state.settings.chartIndicators || {};
          state.settings.chartDrawings   = state.settings.chartDrawings   || {};
          state.settings.chartIndicators[pair] = studiesList;
          state.settings.chartDrawings[pair]   = drawings;
          console.log('Chart state saved for:', pair);
        })
        .catch(err => console.error('Grafik ayarları kaydedilirken hata:', err));
    }
  } catch (err) {
    console.error('saveChartState genel hata:', err);
  }
}

// GITHUB/public/js/app.js DOSYASINA EKLENECEK YENİ FONKSİYONLAR
// Global state'e sortable instance'ını tutmak için bir değişken ekleyelim.
// state.js dosyasında state objesine eklenebilir ama şimdilik burada tanımlayalım.
state.sortableInstance = null;

function toggleSortable() {
    const tableBody = document.getElementById('cryptoPriceTable');
    const dragHandles = document.querySelectorAll('#crypto-content .drag-handle-col');
    const toggleBtn = document.getElementById('toggleSortBtn');

    if (state.sortableInstance) {
        // Sıralamayı Kapat
        state.sortableInstance.destroy();
        state.sortableInstance = null;
        dragHandles.forEach(th => th.classList.add('hidden'));
        toggleBtn.innerHTML = '<i class="fas fa-sort"></i> Sırala';
        showNotification("Sıralama modu kapatıldı.", true);
    } else {
        // Sıralamayı Aç
        dragHandles.forEach(th => th.classList.remove('hidden'));
        toggleBtn.innerHTML = '<i class="fas fa-check"></i> Sıralamayı Kaydet';
        state.sortableInstance = new Sortable(tableBody, {
            handle: '.drag-handle',
            animation: 150,
            onEnd: async function (evt) {
                const newOrder = [...evt.to.rows].map(row => row.dataset.pair);
                state.userPortfolios[state.activePortfolio] = newOrder;
                await saveCoinListToFirestore('crypto');
                // Tabloyu yeni sıraya göre anında render etmeye gerek yok çünkü DOM zaten güncel.
                // Sadece state'i ve veritabanını güncelledik.
            }
        });
        showNotification("Sıralama modu aktif. Coinleri sürükleyip bırakabilirsiniz.", true);
    }
}

function updateAdminUI() {
    const isAdmin = state.currentUserRole === 'admin';
    
    const discoveryTab = document.getElementById('strategy-discovery-tab');
    if (discoveryTab) {
        discoveryTab.style.display = isAdmin ? 'block' : 'none';
    }

    const reportsTab = document.getElementById('alarm-reports-tab');
    if (reportsTab) {
        reportsTab.style.display = isAdmin ? 'block' : 'none';
    }
    const backtestTab = document.getElementById('backtest-tab');
    if (backtestTab) {
        backtestTab.style.display = isAdmin ? 'block' : 'none';
    }
}
// ---- YÜKLEME DENETÇİSİ ----
(() => {
  // Basit showPage yedeği (yoksa)
  if (typeof window.showPage !== 'function') {
    window.showPage = function(id) {
      document.querySelectorAll('.page').forEach(el => el.style.display = (el.id === id ? 'block' : 'none'));
    };
  }

  // Beklenen globaller:
  const expected = [
    ['UI',   () => typeof window.renderSignalAnalysisPreview === 'function'],
    ['API',  () => typeof window.runSignalAnalysisPreview === 'function' || typeof window.getKlines === 'function'],
    ['EVT',  () => typeof window.setupStrategyDiscoveryListeners === 'function']
  ];

  const missing = expected.filter(([name, test]) => !test());
  if (missing.length) {
    console.group('[App] Eksik modüller');
    missing.forEach(([n]) => console.error('Eksik:', n));
    console.groupEnd();
  } else {
    App.log('Tüm modüller yüklendi.');
  }
})();
window.App = window.App || { loaded:{} };
window.App.loaded.EVT = true;
