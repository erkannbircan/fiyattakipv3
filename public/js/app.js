document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    firebase.initializeApp(firebaseConfig);
    state.firebase.auth = firebase.auth();
    state.firebase.db = firebase.firestore();
    state.firebase.functions = firebase.app().functions('europe-west1');

    setupGlobalEventListeners();
    setupAuthEventListeners();
    initializeAuthListener();
}

function initializeAuthListener() {
    state.firebase.auth.onAuthStateChanged(async user => {
        if (user) {
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
                        coins_ai: ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
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

                showPage('tracker-page');
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
    state.settings = { ...defaultSettings, ...userData.settings };
    state.settings.columns = { ...defaultSettings.columns, ...(userData.settings?.columns || {}) };
    state.settings.colors = { ...defaultSettings.colors, ...(userData.settings?.colors || {}) };
    state.settings.cryptoAnalysisIndicators = { ...defaultSettings.cryptoAnalysisIndicators, ...(userData.settings?.cryptoAnalysisIndicators || {}) };
    state.trackedReports = userData.settings?.trackedReportIds || [];
    // YENİ: Canlı tarayıcı ayarlarını yükle
    state.settings.liveScannerInterval = userData.settings?.liveScannerInterval || 5; // Varsayılan 5 dakika

    state.settings.chartStates_v2 = userData.settings?.chartStates_v2 || {};
    state.currentUserRole = userData.role;
    const limits = { admin: { coin: Infinity }, qualified: { coin: 50 }, new_user: { coin: 15 } };
    state.coinLimit = limits[state.currentUserRole]?.coin ?? 15;
    document.getElementById('userEmail').textContent = state.firebase.auth.currentUser.email;
}

async function initializeTrackerPage(userData) {
    state.pageInitialized = true;

    state.userPortfolios = userData.portfolios || { "Varsayılan": ["BTCUSDT", "ETHUSDT", "SOLUSDT"] };
    state.activePortfolio = userData.activePortfolio || Object.keys(state.userPortfolios)[0];
    state.cryptoAiPairs = userData.coins_ai || ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
    state.discoveryCoins = userData.coins_discovery || ["BTCUSDT", "ETHUSDT"];

    renderIndicatorFilters();
    renderDictionary();
    applySettingsToUI();
    renderAllPortfolioTabs();

    await fetchAllDataAndRender();
    fetchAiDataAndRender();
    renderAlarmReports();

    setupTrackerPageEventListeners();
    setupUpdateAnalysisButtonListener();

    // YENİ: Sayfa yüklendiğinde tarayıcıyı başlat (eğer açıksa)
    const toggle = document.getElementById('toggleAutoScanner');
    if (toggle && toggle.checked) {
        toggleAutoScanner(true);
    }
}

async function fetchAllDataAndRender() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) showLoading(refreshBtn);
    const currentCoinList = state.userPortfolios[state.activePortfolio] || [];
    const promises = currentCoinList.map(pair => fetchCryptoData(pair, false));
    state.allCryptoData = await Promise.all(promises);
    sortAndRenderTable();
    renderSupportResistance();
    if (refreshBtn) hideLoading(refreshBtn);
    const updateTimeEl = document.getElementById('updateTime');
    if (updateTimeEl) updateTimeEl.textContent = new Date().toLocaleString(state.settings.lang);
}

async function fetchAiDataAndRender() {
    const container = document.getElementById('crypto-indicator-cards-container');
    if (!container) return;
    container.innerHTML = '<div class="loading" style="margin: 20px auto; display:block;"></div>';
    const promises = (state.cryptoAiPairs || []).map(pair => fetchCryptoData(pair, true));
    const aiData = await Promise.all(promises);
    renderIndicatorCards('crypto', aiData);
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

function saveSettings() {
    const btn = document.getElementById('saveSettingsBtn');
    showLoading(btn);

    let interval = parseInt(document.getElementById('refreshInterval').value);
    const minInterval = { admin: 10, qualified: 120, new_user: 300 }[state.currentUserRole] || 300;
    if (interval < minInterval) interval = minInterval;
    
    // YENİ: Canlı tarayıcı ayarını oku ve doğrula
    let scannerInterval = parseInt(document.getElementById('liveScannerInterval').value);
    if (isNaN(scannerInterval) || scannerInterval < 5) {
        scannerInterval = 5; // Minimum 5 dakika
    }

    const settingsToUpdate = {
        lang: document.getElementById('langSelect').value,
        autoRefresh: document.getElementById('autoRefreshToggle').checked,
        refreshInterval: interval,
        telegramPhone: document.getElementById('telegramPhoneInput').value,
        liveScannerInterval: scannerInterval, // YENİ
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
                // YENİ: Ayarlar kaydedildikten sonra tarayıcıyı yeni aralıkla yeniden başlat
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
    else if (listName === 'ai') assetList = state.cryptoAiPairs || [];
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
        if (listName === 'ai') await fetchAiDataAndRender();
    }
    input.value = '';
}

// app.js dosyasındaki handleRemoveCoin fonksiyonunu bununla değiştirin
async function handleRemoveCoin(listName, pair) {
    let assetList;
    if (listName === 'crypto') assetList = state.userPortfolios[state.activePortfolio];
    else if (listName === 'ai') assetList = state.cryptoAiPairs;
    else if (listName === 'discovery') assetList = state.discoveryCoins;
    else if (listName === 'alarm') assetList = state.tempAlarmCoins;
    else return;

    const updatedList = (assetList || []).filter(p => p !== pair);

    if (listName === 'crypto') state.userPortfolios[state.activePortfolio] = updatedList;
    else if (listName === 'ai') state.cryptoAiPairs = updatedList;
    else if (listName === 'discovery') state.discoveryCoins = updatedList;
    else if (listName === 'alarm') state.tempAlarmCoins = updatedList;

    // İyileştirme: UI güncellemesi de aktif sekmeyi hedeflesin
    updateCoinList(listName, updatedList);
    await saveCoinListToFirestore(listName);
    if (listName === 'crypto') await fetchAllDataAndRender();
    if (listName === 'ai') await fetchAiDataAndRender();
}

async function handleRemoveCoin(listName, pair) {
    let assetList;
    if (listName === 'crypto') assetList = state.userPortfolios[state.activePortfolio];
    else if (listName === 'ai') assetList = state.cryptoAiPairs;
    else if (listName === 'discovery') assetList = state.discoveryCoins;
    else if (listName === 'alarm') assetList = state.tempAlarmCoins;
    else return;

    const updatedList = (assetList || []).filter(p => p !== pair);

    if (listName === 'crypto') state.userPortfolios[state.activePortfolio] = updatedList;
    else if (listName === 'ai') state.cryptoAiPairs = updatedList;
    else if (listName === 'discovery') state.discoveryCoins = updatedList;
    else if (listName === 'alarm') state.tempAlarmCoins = updatedList;

    updateCoinList(listName, updatedList);
    await saveCoinListToFirestore(listName);
    if (listName === 'crypto') await fetchAllDataAndRender();
    if (listName === 'ai') await fetchAiDataAndRender();
}

async function saveCoinListToFirestore(listName) {
    if (!state.userDocRef) return;
    try {
        if (listName === 'crypto') await state.userDocRef.update({ portfolios: state.userPortfolios });
        else if (listName === 'ai') await state.userDocRef.update({ coins_ai: state.cryptoAiPairs });
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
async function saveChartState(widget) {
    console.log("Kaydetme fonksiyonu (saveChartState) çağrıldı.");

    if (!widget || typeof widget.getStudiesList !== 'function') {
        console.warn("Kaydetme mümkün değil: Geçerli bir TradingView widget'ı sağlanmadı.");
        return; // Fonksiyondan erken çık.
    }

    const currentPair = document.getElementById('chartPanelTitle').textContent + 'USDT';
    const studiesList = widget.getStudiesList();
    const updatePath = `settings.chartIndicators.${currentPair}`;
    
    if (!state.userDocRef) {
        console.error("Kaydetme başarısız: Kullanıcı oturumu (userDocRef) bulunamadı.");
        return;
    }

    try {
        console.log(`Firebase'e kaydediliyor: ${currentPair}`, studiesList);
        await state.userDocRef.update({ [updatePath]: studiesList });
        
        console.log("Firebase kaydı BAŞARILI.");
        if (!state.settings.chartIndicators) {
            state.settings.chartIndicators = {};
        }
        state.settings.chartIndicators[currentPair] = studiesList;
    } catch (error) {
        console.error("Firebase kaydı sırasında HATA oluştu!", error);
    }
}

async function updateAnalysisSettings() {
    console.log("--- Analiz Ayarlarını Güncelleme Başladı ---");
    const btn = document.getElementById('updateCryptoAnalysisBtn');
    showLoading(btn);

    const activeInterval = document.querySelector('#cryptoIntervalFilters button.active');
    if (activeInterval) {
        state.settings.cryptoAnalysisInterval = activeInterval.dataset.interval;
        console.log("Seçilen Zaman Aralığı:", state.settings.cryptoAnalysisInterval);
    } else {
        console.warn("Aktif bir zaman aralığı bulunamadı.");
    }

    const STRATEGY_PRESETS = {
        momentum: { name: "Momentum", indicators: { rsi: true, macd: true } },
        trend: { name: "Trend Takip", indicators: { ema: true, macd: true } },
    };

    const activePresetButton = document.querySelector('#strategyPresetFilters button.active');
    const newIndicators = {};

    if (activePresetButton) {
        const selectedPreset = activePresetButton.dataset.preset;
        console.log("Seçilen Strateji Filtresi:", selectedPreset);

        if (selectedPreset === 'custom') {
            console.log("'Özel' filtresi aktif. Onay kutuları okunuyor...");
            const checkboxes = document.querySelectorAll('#crypto-indicator-filters-grid input[type="checkbox"]');
            console.log(`Toplam ${checkboxes.length} adet onay kutusu bulundu.`);
            
            checkboxes.forEach(cb => {
                if (cb.checked) {
                    newIndicators[cb.dataset.indicator] = true;
                    console.log(`- ${cb.dataset.indicator} seçildi.`);
                }
            });

            if (Object.keys(newIndicators).length === 0) {
                 console.warn("'Özel' filtresi seçili ancak hiçbir indikatör işaretlenmemiş.");
            }

        } else if (STRATEGY_PRESETS[selectedPreset]) {
            Object.assign(newIndicators, STRATEGY_PRESETS[selectedPreset].indicators);
            console.log(`'${selectedPreset}' preseti için indikatörler yüklendi:`, newIndicators);
        }
        state.settings.cryptoAnalysisIndicators = newIndicators;
        
    } else {
        console.error("Hiçbir strateji filtresi aktif olarak bulunamadı!");
    }

    console.log("Analiz için kullanılacak son indikatör listesi:", state.settings.cryptoAnalysisIndicators);
    
    try {
        console.log("Ayarlar Firebase'e kaydediliyor...");
        await state.userDocRef.update({
            'settings.cryptoAnalysisIndicators': state.settings.cryptoAnalysisIndicators,
            'settings.cryptoAnalysisInterval': state.settings.cryptoAnalysisInterval,
            'coins_ai': state.cryptoAiPairs
        });
        console.log("Firebase'e kayıt başarılı. Yeni veriler çekiliyor...");
        
        await fetchAiDataAndRender();
        
        showNotification("Analiz ayarları güncellendi.", true);
    } catch (e) {
        console.error("Analiz ayarları güncellenirken hata:", e);
        showNotification("Ayarlar güncellenemedi.", false);
    } finally {
        hideLoading(btn);
        console.log("--- Analiz Ayarlarını Güncelleme Bitti ---");
    }
}

function updateAdminUI() {
    const isAdmin = state.currentUserRole === 'admin';
    document.getElementById('analyzeAllCryptoBtn').style.display = isAdmin ? 'flex' : 'none';
    document.getElementById('live-scanner-tab').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('alarms-tab').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('strategy-discovery-tab').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('alarm-reports-tab').style.display = isAdmin ? 'block' : 'none';
}
