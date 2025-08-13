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

    // Önceki denemelerden kalan bozuk chartStates'e dokunmamak için yeni bir yol kullanıyoruz.
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
    state.userAlarms = userData.alarms || [];

    renderIndicatorFilters();
    renderDictionary();
    applySettingsToUI();
    renderAllPortfolioTabs();

    await fetchAllDataAndRender();
    fetchAiDataAndRender();
    renderAlarmReports();

    setupTrackerPageEventListeners();
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

    // Sadece güncellenecek ayarları bir obje olarak alıyoruz.
    // chartStates veya diğer hassas verilere dokunmuyoruz.
    const settingsToUpdate = {
        lang: document.getElementById('langSelect').value,
        autoRefresh: document.getElementById('autoRefreshToggle').checked,
        refreshInterval: interval,
        telegramPhone: document.getElementById('telegramPhoneInput').value,
        columns: {
            1: { name: document.getElementById('col1_name_input').value, days: parseInt(document.getElementById('col1_days_input').value), threshold: parseFloat(document.getElementById('col1_threshold_input').value) },
            2: { name: document.getElementById('col2_name_input').value, days: parseInt(document.getElementById('col2_days_input').value), threshold: parseFloat(document.getElementById('col2_threshold_input').value) },
            3: { name: document.getElementById('col3_name_input').value, days: parseInt(document.getElementById('col3_days_input').value), threshold: parseFloat(document.getElementById('col3_threshold_input').value) }
        },
        colors: { high: document.getElementById('high_color_input').value, low: document.getElementById('low_color_input').value }
    };

    // state.settings objesini yeni ayarlarla güncelliyoruz.
    Object.assign(state.settings, settingsToUpdate);

    if (state.userDocRef) {
        // Veritabanında SADECE 'settings' alanını güncelliyoruz.
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

async function handleAddCoin(listName) {
    const input = document.querySelector(`.new-coin-input[data-list-name="${listName}"]`);
    if (!input) return;

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
            // Bu API çağrısı sadece varlık kontrolü için, bu yüzden axios kullanımı devam edebilir.
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

function saveChartState() {
    if (state.tradingViewWidget && typeof state.tradingViewWidget.save === 'function') {
        const currentPair = document.getElementById('chartPanelTitle').textContent + 'USDT';
        state.tradingViewWidget.save(async (chartState) => {
            const chartStateString = JSON.stringify(chartState);
            const updatePath = `settings.chartStates_v2.${currentPair}`;
            state.settings.chartStates_v2[currentPair] = chartStateString;
            if (state.userDocRef) {
                try {
                    await state.userDocRef.update({ [updatePath]: chartStateString });
                    showNotification("Grafik ayarları kaydedildi!", true);
                } catch (error) {
                    console.error("Grafik durumu kaydedilirken hata:", error);
                    showNotification("Grafik ayarları kaydedilemedi.", false);
                }
            }
        });
    }
}

async function saveAlarm() {
    const btn = document.getElementById('saveAlarmBtn');
    showLoading(btn);

    const alarmId = document.getElementById('alarmIdInput').value;
    const alarmName = document.getElementById('alarmNameInput').value;
    if (!alarmName) {
        showNotification("Alarm adı boş bırakılamaz.", false);
        hideLoading(btn);
        return;
    }

    const safeParseInt = (id, defaultValue = 0) => parseInt(document.getElementById(id).value) || defaultValue;
    const safeParseFloat = (id, defaultValue = 0) => parseFloat(document.getElementById(id).value) || defaultValue;

    const newAlarm = {
        id: alarmId || `alarm_${new Date().getTime()}`,
        name: alarmName,
        coins: state.tempAlarmCoins,
        isActive: alarmId ? (state.userAlarms.find(a => a.id === alarmId)?.isActive ?? true) : true,
        timeframe: document.getElementById('alarmTimeframe').value,
        trendFilterEnabled: document.getElementById('alarmTrendFilterEnabled').checked,
        adxThreshold: safeParseInt('alarmADXThreshold', 25),
        conditions: {
            volume: { enabled: document.getElementById('alarmVolumeCondition').checked, period: safeParseInt('alarmVolumePeriod', 20), multiplier: safeParseFloat('alarmVolumeMultiplier', 2), amount: safeParseFloat('alarmVolumeAmount', 0) },
            macd: { enabled: document.getElementById('alarmMacdCondition').checked, signalType: document.getElementById('alarmMacdSignalType').value },
            macdHistogram: { enabled: document.getElementById('alarmMacdHistogramCondition').checked, operator: document.getElementById('alarmMacdHistogramOperator').value, value: safeParseFloat('alarmMacdHistogramValue', 0) },
            rsi: { enabled: document.getElementById('alarmRsiCondition').checked, operator: document.getElementById('alarmRsiOperator').value, value: safeParseFloat('alarmRsiValue', 30) }
        }
    };

    const dnaRecDiv = document.querySelector('#alarmSettingsPanel .dna-recommendation');
    if (dnaRecDiv && dnaRecDiv.dataset.dnaAnalysis) {
        newAlarm.dna_analysis = JSON.parse(dnaRecDiv.dataset.dnaAnalysis);
    }

    if (alarmId) {
        state.userAlarms = state.userAlarms.map(a => a.id === alarmId ? newAlarm : a);
    } else {
        state.userAlarms.push(newAlarm);
    }

    try {
        await state.userDocRef.update({ alarms: state.userAlarms });
        showNotification("Alarm başarıyla kaydedildi.", true);
        renderAlarms();
        closeAllPanels();
    } catch (error) {
        showNotification("Alarm kaydedilemedi.", false);
    } finally {
        hideLoading(btn);
    }
}

async function addReportToTrack(reportId) {
    if (!reportId || state.trackedReports.includes(reportId)) return;
    try {
        const reportDoc = await state.userDocRef.collection('alarm_reports').doc(reportId).get();
        if (!reportDoc.exists) {
            showNotification("Bu ID'ye sahip bir rapor bulunamadı.", false);
            return;
        }
        state.trackedReports.push(reportId);
        state.settings.trackedReportIds = state.trackedReports;
        await state.userDocRef.update({ 'settings.trackedReportIds': state.trackedReports });
        showNotification("Rapor takibe eklendi.", true);
        await renderAlarmReports();
    } catch (error) {
        showNotification("Rapor eklenirken hata oluştu.", false)
    }
}

async function updateAnalysisSettings() {
    const btn = document.getElementById('updateCryptoAnalysisBtn');
    showLoading(btn);

    const activeInterval = document.querySelector('#cryptoIntervalFilters button.active');
    if (activeInterval) state.settings.cryptoAnalysisInterval = activeInterval.dataset.interval;

    const activePreset = document.querySelector('#strategyPresetFilters button.active');
    if (activePreset) {
        const selectedPreset = activePreset.dataset.preset;
        const newIndicators = {};
        if (selectedPreset === 'custom') {
            document.querySelectorAll('#crypto-indicator-filters-grid input:checked').forEach(cb => newIndicators[cb.dataset.indicator] = true);
        } else if (STRATEGY_PRESETS[selectedPreset]) {
            Object.assign(newIndicators, STRATEGY_PRESETS[selectedPreset].indicators);
        }
        state.settings.cryptoAnalysisIndicators = newIndicators;
    }

    try {
        await state.userDocRef.update({
            'settings.cryptoAnalysisIndicators': state.settings.cryptoAnalysisIndicators,
            'settings.cryptoAnalysisInterval': state.settings.cryptoAnalysisInterval,
            coins_ai: state.cryptoAiPairs
        });
        await fetchAiDataAndRender();
        showNotification("Analiz ayarları güncellendi.", true);
    } catch (e) {
        showNotification("Ayarlar güncellenemedi.", false);
    } finally {
        hideLoading(btn);
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
