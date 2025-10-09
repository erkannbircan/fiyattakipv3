// ---- GLOBAL ÇATI (her JS dosyasının en üstüne koy) ----
window.App = window.App || {
  version: 'v3.0.0-' + (window.App?.versionTag || ''),
  loaded: {},
  guards: {},
  log: (...args) => console.log('[App]', ...args),
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Firebase güvenlik kontrolü
    if (typeof firebase === 'undefined' || !firebase.initializeApp) {
        console.error('Firebase SDK yüklenmedi ya da sırası yanlış. Lütfen <script src="firebase-*.js"> etiketlerini kontrol et.');
        return;
    }

    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        state.firebase.auth = firebase.auth();
        state.firebase.db = firebase.firestore();
        state.firebase.firestore = state.firebase.db; // alias
        state.firebase.functions = firebase.app().functions('europe-west1');
    } catch (e) {
        console.error('Firebase init hatası:', e);
        return;
    }

    // index.html'deki dosya sırası doğru olduğu için, bu fonksiyonların var olduğunu varsayarak doğrudan çağırıyoruz.
    setupAuthEventListeners();
    initializeAuthListener(); // Bu, login kontrolünü başlatır. Diğer her şey login olunca tetiklenir.
}

function getDefaultSettings() {
    return {
        lang: 'tr',
        autoRefresh: true,
        refreshInterval: 300,
        visibleColumns: {
            latestPrice: true,
            col1: true,
            col2: true,
            col3: true,
            rsi: false,
            macd: false,
        },
        columns: {
            1: { name: '1G', days: 1, threshold: 5 },
            2: { name: '7G', days: 7, threshold: 10 },
            3: { name: '30G', days: 30, threshold: 20 },
        },
        colors: { high: '#26de81', low: '#26a69a' },
        chartState: {}
    };
}

function initializeAuthListener() {
    state.firebase.auth.onAuthStateChanged(async user => {
        if (user) {
            showPage('tracker-page');
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
                    };
                    await state.userDocRef.set(userData, { merge: true });
                }

                loadSettingsAndRole(userData);
                if (!state.pageInitialized) {
                    await initializeTrackerPage(userData);
                }
                updateAdminUI();

            } catch (err) {
                console.error("Auth/Firestore Hatası:", err);
                state.firebase.auth.signOut();
            }
        } else {
            showPage('login-page');
            state.pageInitialized = false;
            state.user = null;
            state.userDocRef = null;
            if (state.autoRefreshTimer) clearInterval(state.autoRefreshTimer);
            if (state.reportsRefreshTimer) clearInterval(state.reportsRefreshTimer);
        }
    });
}

function loadSettingsAndRole(userData) {
    const defaultSettings = getDefaultSettings();
    state.settings = { 
        ...defaultSettings, 
        ...userData.settings,
        columns: { ...defaultSettings.columns, ...(userData.settings?.columns || {}) },
        colors: { ...defaultSettings.colors, ...(userData.settings?.colors || {}) },
        chartState: userData.settings?.chartState || {}
    };
  state.settings.indicatorTimeframe = userData.settings?.indicatorTimeframe || '1d';
    state.currentUserRole = userData.role;
    const limits = { admin: { coin: Infinity }, qualified: { coin: 50 }, new_user: { coin: 15 } };
    state.coinLimit = limits[state.currentUserRole]?.coin ?? 15;
    document.getElementById('userEmail').textContent = state.firebase.auth.currentUser.email;
}

async function initializeTrackerPage(userData) {
    state.pageInitialized = true;
    state.userPortfolios = userData.portfolios || { "Varsayılan": ["BTCUSDT", "ETHUSDT", "SOLUSDT"] };
    state.activePortfolio = userData.activePortfolio || Object.keys(state.userPortfolios)[0];
    state.discoveryCoins = userData.coins_discovery || ["BTCUSDT", "ETHUSDT"];
    
    applySettingsToUI();
    renderAllPortfolioTabs();
    
    if (typeof fetchFearAndGreedIndex === 'function') {
        fetchFearAndGreedIndex().then(renderFearAndGreedWidget);
    }
  
    initializeEventListeners();

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    if (currentPage === 'index.html' || currentPage === '') {
        await fetchAllDataAndRender();
        createCoinManager('crypto-coin-manager-container', state.userPortfolios[state.activePortfolio] || [], 'crypto');
    }
    else if (currentPage === 'strateji.html') {
        createCoinManager('discovery-coin-manager-container', state.discoveryCoins, 'discovery');
    }
    else if (currentPage === 'backtest.html') {
        if (typeof fetchDnaProfiles === 'function') fetchDnaProfiles('dnaProfilesContainer');
    }
}

async function fetchAllDataAndRender() {
    if (state.isFetchingData) {
        console.warn("Zaten devam eden bir veri çekme işlemi var. Yenisi iptal edildi.");
        return;
    }
    state.isFetchingData = true;

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) showLoading(refreshBtn);

    try {
        let currentCoinList = state.userPortfolios[state.activePortfolio] || [];
        currentCoinList = [...new Set(currentCoinList)];
        state.userPortfolios[state.activePortfolio] = currentCoinList;

        const promises = currentCoinList.map(pair => fetchCryptoData(pair));
        state.allCryptoData = await Promise.all(promises);
        sortAndRenderTable();
        
        const updateTimeEl = document.getElementById('updateTime');
        if (updateTimeEl) updateTimeEl.textContent = new Date().toLocaleString(state.settings.lang);
    } catch (error) {
        console.error("fetchAllDataAndRender sırasında hata:", error);
        showNotification("Veriler yüklenirken bir hata oluştu.", false);
    } finally {
        if (refreshBtn) hideLoading(refreshBtn);
        state.isFetchingData = false;
    }
}

function sortAndRenderTable() {
    const { key, order } = state.currentSort;
    let sortedData = [...state.allCryptoData];
    if (order !== 'default' && key) {
        sortedData.sort((a, b) => {
            let valA, valB;
            if (key.startsWith('col')) { valA = a[key]?.pct; }
            else if (key === 'rsi') { valA = a.rsi; }
            else if (key === 'macd') { valA = a.macd?.histogram; }
            else { valA = a[key]; }

            if (key.startsWith('col')) { valB = b[key]?.pct; }
            else if (key === 'rsi') { valB = b.rsi; }
            else if (key === 'macd') { valB = b.macd?.histogram; }
            else { valB = b[key]; }

            if (a.error) return 1; if (b.error) return -1;
            if (valA === undefined || valA === null || valA === 'N/A') return 1;
            if (valB === undefined || valB === null || valB === 'N/A') return -1;
            if (typeof valA === 'string') return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            return order === 'asc' ? valA - valB : valB - valA;
        });
    }

    document.querySelectorAll('#crypto-content th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.sortKey === key && order !== 'default') th.classList.add(order);
    });
    updateAllTableRows(sortedData);
}

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
        if (!cb.disabled) { visibleColumns[cb.dataset.col] = cb.checked; }
    });
    
    const settingsToUpdate = {
        lang: document.getElementById('langSelect').value,
        autoRefresh: document.getElementById('autoRefreshToggle').checked,
        refreshInterval: interval,
        telegramChatId: document.getElementById('telegramChatIdInput').value,
      indicatorTimeframe: document.getElementById('indicatorTimeframeSelect').value, 
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
                applySettingsToUI();
                closeAllPanels();
                showNotification("Ayarlar başarıyla kaydedildi.", true);
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

async function handleAddCoin(listName) {
    const activeTabContent = document.querySelector('.tab-content.active');
    const input = activeTabContent.querySelector(`.new-coin-input[data-list-name="${listName}"]`);
    if (!input) { console.error(`Coin input alanı bulunamadı: ${listName}`); return; }
    let assetList = state.userPortfolios[state.activePortfolio] || [];
    const newAssetSymbols = input.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (newAssetSymbols.length === 0) return;
    const addedCoins = [];
    for (const symbol of newAssetSymbols) {
        const newPair = !symbol.endsWith('USDT') ? `${symbol}USDT` : symbol;
        if (assetList.includes(newPair)) continue;
        assetList.push(newPair);
        addedCoins.push(newPair);
    }
    if (addedCoins.length > 0) {
        updateCoinList(listName, assetList);
        await saveCoinListToFirestore(listName);
        if (listName === 'crypto') await fetchAllDataAndRender();
    }
    input.value = '';
}

async function handleRemoveCoin(listName, pair) {
    let assetList = state.userPortfolios[state.activePortfolio];
    const updatedList = (assetList || []).filter(p => p !== pair);
    state.userPortfolios[state.activePortfolio] = updatedList;
    updateCoinList(listName, updatedList);
    await saveCoinListToFirestore(listName);
    if (listName === 'crypto') await fetchAllDataAndRender();
}

async function saveCoinListToFirestore(listName) {
    if (!state.userDocRef) return;
    try {
        if (listName === 'crypto') await state.userDocRef.update({ portfolios: state.userPortfolios });
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
    const ok = await App.confirm({title: 'Listeyi Sil', message: `"${state.activePortfolio}" listesini silmek istediğinizden emin misiniz?`, confirmText: 'Sil', confirmStyle: 'danger'});
    if(ok){
        const deletedPortfolio = state.activePortfolio;
        delete state.userPortfolios[state.activePortfolio];
        const newActive = Object.keys(state.userPortfolios)[0];
        await state.userDocRef.update({ portfolios: state.userPortfolios });
        await setActivePortfolio(newActive);
        showNotification(`"${deletedPortfolio}" listesi silindi.`, true);
    }
}

async function saveChartState(pair) {
    return new Promise((resolve, reject) => {
        if (state.tradingViewWidget && typeof state.tradingViewWidget.save === 'function') {
            state.tradingViewWidget.save(async function(savedData) {
                try {
                    // --- ÇÖZÜM BURADA ---
                    // Adım 1: TradingView'den gelen karmaşık veriyi "temiz" ve "basit" hale getir.
                    const plainSavedData = JSON.parse(JSON.stringify(savedData));

                    // Adım 2: Firebase'e bu temiz veriyi gönder.
                    const updatePayload = { [`settings.chartState.${pair}`]: plainSavedData };
                    
                    if (state.userDocRef) {
                        await state.userDocRef.update(updatePayload);
                        
                        if (!state.settings.chartState) state.settings.chartState = {};
                        // Lokal state'i de temiz veriyle güncelle.
                        state.settings.chartState[pair] = plainSavedData;
                        
                        console.log(`Grafik durumu ${pair} için başarıyla kaydedildi.`);
                        resolve(); // İşlem başarılı.
                    } else {
                        reject(new Error("Kullanıcı referansı bulunamadı."));
                    }
                } catch (error) {
                    // Hata genellikle burada, Firebase veriyi reddettiğinde oluşur.
                    console.error("Grafik ayarları kaydedilirken hata:", error);
                    reject(error); // Hata olursa Promise'i reddet.
                }
            });
        } else {
            reject(new Error("TradingView widget bulunamadı veya save fonksiyonu yok."));
        }
    });
}

state.sortableInstance = null;
function toggleSortable() {
    const tableBody = document.getElementById('cryptoPriceTable');
    const dragHandles = document.querySelectorAll('#crypto-content .drag-handle-col');
    const toggleBtn = document.getElementById('toggleSortBtn');

    if (state.sortableInstance) {
        state.sortableInstance.destroy();
        state.sortableInstance = null;
        dragHandles.forEach(th => th.classList.add('hidden'));
        toggleBtn.innerHTML = '<i class="fas fa-sort"></i> Sırala';
        showNotification("Sıralama modu kapatıldı.", true);
    } else {
        dragHandles.forEach(th => th.classList.remove('hidden'));
        toggleBtn.innerHTML = '<i class="fas fa-check"></i> Sıralamayı Kaydet';
        state.sortableInstance = new Sortable(tableBody, {
            handle: '.drag-handle',
            animation: 150,
            onEnd: async function (evt) {
                const newOrder = [...evt.to.rows].map(row => row.dataset.pair);
                state.userPortfolios[state.activePortfolio] = newOrder;
                await saveCoinListToFirestore('crypto');
            }
        });
        showNotification("Sıralama modu aktif. Coinleri sürükleyip bırakabilirsiniz.", true);
    }
}

function updateAdminUI() {
    const isAdmin = state.currentUserRole === 'admin';
    const discoveryTab = document.getElementById('strategy-discovery-tab');
    if (discoveryTab) discoveryTab.style.display = isAdmin ? 'block' : 'none';
    const reportsTab = document.getElementById('alarm-reports-tab');
    if (reportsTab) reportsTab.style.display = isAdmin ? 'block' : 'none';
    const backtestTab = document.getElementById('backtest-tab');
    if (backtestTab) backtestTab.style.display = isAdmin ? 'block' : 'none';
}
