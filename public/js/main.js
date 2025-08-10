let currentUserRole = null, coinLimit = 10, settings = {}, pageInitialized = false;
let autoRefreshTimer = null, reportsRefreshTimer = null;
let allCryptoData = [], userAlarms = [], trackedReports = [];
let currentSort = { key: null, order: 'default' };
let userPortfolios = {};
let activePortfolio = 'Varsayılan';
let cryptoAiPairs = [];
let discoveryCoins = [];
let userDocRef = null;
let sortableInstance = null;
let currentRecommendationFilter = 'all';
let tempAlarmCoins = [];
let tradingViewWidget = null;
let auth, db, functions;

document.addEventListener('DOMContentLoaded', () => {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    functions = firebase.app().functions('europe-west1');

    setupGlobalEventListeners();
    setupAuthEventListeners();
    initializeAuthListener();
});

function loadSettingsAndRole(userData) {
    const defaultSettings = getDefaultSettings();
    settings = { ...defaultSettings, ...userData.settings };
    settings.columns = { ...defaultSettings.columns, ...(userData.settings?.columns || {}) };
    settings.colors = { ...defaultSettings.colors, ...(userData.settings?.colors || {}) };
    settings.cryptoAnalysisIndicators = { ...defaultSettings.cryptoAnalysisIndicators, ...(userData.settings?.cryptoAnalysisIndicators || {}) };
    settings.chartStates = userData.settings?.chartStates || {};
    trackedReports = userData.settings?.trackedReportIds || [];

    currentUserRole = userData.role;
    const limits = { admin: {coin: Infinity}, qualified: {coin: 50}, new_user: {coin: 15} };
    coinLimit = limits[currentUserRole]?.coin ?? 15;
    document.getElementById('userEmail').textContent = auth.currentUser.email;
}

async function initializeTrackerPage(userData) {
    pageInitialized = true;
    
    userPortfolios = userData.portfolios || { "Varsayılan": ["BTCUSDT", "ETHUSDT", "SOLUSDT"] };
    activePortfolio = userData.activePortfolio || Object.keys(userPortfolios)[0];
    cryptoAiPairs = userData.coins_ai || ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
    discoveryCoins = userData.coins_discovery || ["BTCUSDT", "ETHUSDT"];
    userAlarms = userData.alarms || [];
    
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
    
    const currentCoinList = userPortfolios[activePortfolio] || [];
    allCryptoData = await Promise.all(currentCoinList.map(pair => fetchCryptoData(pair, false)));
    
    sortAndRenderTable();
    renderSupportResistance();
    if (refreshBtn) hideLoading(refreshBtn);
    const updateTimeEl = document.getElementById('updateTime');
    if(updateTimeEl) updateTimeEl.textContent = new Date().toLocaleString(settings.lang);
}

async function fetchAiDataAndRender() {
    const container = document.getElementById('crypto-indicator-cards-container');
    if(!container) return;
    container.innerHTML = '<div class="loading" style="margin: 20px auto; display:block;"></div>';
    
    const aiData = await Promise.all((cryptoAiPairs || []).map(pair => fetchCryptoData(pair, true)));
    
    renderIndicatorCards('crypto', aiData);
}

function sortAndRenderTable() {
    const { key, order } = currentSort;
    let sortedData = (order === 'default') ? [...allCryptoData] : [...allCryptoData].sort((a, b) => {
        let valA, valB;
        if (key.startsWith('col')) { valA = a[key]?.pct; valB = b[key]?.pct; } 
        else { valA = a[key]; valB = b[key]; }
        if (a.error) return 1; if (b.error) return -1;
        if (valA === undefined || valA === null || valA === 'N/A') return 1;
        if (valB === undefined || valB === null || valB === 'N/A') return -1;
        if (typeof valA === 'string') return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
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
    const minInterval = { admin: 10, qualified: 120, new_user: 300 }[currentUserRole] || 300;
    if (interval < minInterval) interval = minInterval;

    settings.lang = document.getElementById('langSelect').value;
    settings.autoRefresh = document.getElementById('autoRefreshToggle').checked;
    settings.refreshInterval = interval;
    settings.telegramPhone = document.getElementById('telegramPhoneInput').value;
    settings.columns = { 1: { name: document.getElementById('col1_name_input').value, days: parseInt(document.getElementById('col1_days_input').value), threshold: parseFloat(document.getElementById('col1_threshold_input').value) }, 2: { name: document.getElementById('col2_name_input').value, days: parseInt(document.getElementById('col2_days_input').value), threshold: parseFloat(document.getElementById('col2_threshold_input').value) }, 3: { name: document.getElementById('col3_name_input').value, days: parseInt(document.getElementById('col3_days_input').value), threshold: parseFloat(document.getElementById('col3_threshold_input').value) } };
    settings.colors = { high: document.getElementById('high_color_input').value, low: document.getElementById('low_color_input').value };
    
    if (userDocRef) {
        userDocRef.update({ settings }).then(() => {
            applySettingsToUI();
            closeAllPanels();
            showNotification(translations[settings.lang].settings_saved, true);
            fetchAllDataAndRender();
        }).catch(error => {
            showNotification("Ayarları kaydederken hata oluştu.", false);
        }).finally(() => hideLoading(btn));
    }
}

function toggleAutoRefresh() {
    if(autoRefreshTimer) clearInterval(autoRefreshTimer);
    if(settings.autoRefresh) {
        autoRefreshTimer = setInterval(fetchAllDataAndRender, settings.refreshInterval * 1000);
    }
}

function toggleReportsAutoRefresh(forceState) {
    const btn = document.getElementById('autoRefreshReportsToggle');
    let shouldBeActive = forceState !== undefined ? forceState : !btn.classList.contains('active');
    
    if (reportsRefreshTimer) clearInterval(reportsRefreshTimer);
    btn.classList.toggle('active', shouldBeActive);

    if(shouldBeActive) {
        reportsRefreshTimer = setInterval(renderAlarmReports, settings.refreshInterval * 1000);
        if(forceState === undefined) showNotification("Rapor yenileme aktif.", true);
    } else {
         if(forceState === undefined) showNotification("Rapor yenileme durduruldu.", true);
    }
}

async function handleAddCoin(listName) {
    const input = document.querySelector(`.new-coin-input[data-list-name="${listName}"]`);
    if (!input) return;

    let assetList;
    if (listName === 'crypto') assetList = userPortfolios[activePortfolio] || [];
    else if (listName === 'ai') assetList = cryptoAiPairs || [];
    else if (listName === 'discovery') assetList = discoveryCoins || [];
    else if (listName === 'alarm') assetList = tempAlarmCoins || [];
    else return;

    const newAssetSymbols = input.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (newAssetSymbols.length === 0) return;

    if (listName !== 'alarm' && coinLimit !== Infinity && (assetList.length + newAssetSymbols.length) > coinLimit) {
        showNotification(translations[settings.lang].role_info(currentUserRole, coinLimit, 'coin'), false);
        return;
    }

    const addedCoins = [];
    for (const symbol of newAssetSymbols) {
        const newPair = !symbol.endsWith('USDT') ? `${symbol}USDT` : symbol;
        if (assetList.includes(newPair)) {
            showNotification(translations[settings.lang].already_in_list(symbol), false);
            continue;
        }
        try {
            await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${newPair}`);
            assetList.push(newPair);
            addedCoins.push(newPair);
        } catch (error) {
            showNotification(translations[settings.lang].invalid_asset(symbol), false);
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
    if (listName === 'crypto') assetList = userPortfolios[activePortfolio];
    else if (listName === 'ai') assetList = cryptoAiPairs;
    else if (listName === 'discovery') assetList = discoveryCoins;
    else if (listName === 'alarm') assetList = tempAlarmCoins;
    else return;

    const updatedList = (assetList || []).filter(p => p !== pair);
    
    if (listName === 'crypto') userPortfolios[activePortfolio] = updatedList;
    else if (listName === 'ai') cryptoAiPairs = updatedList;
    else if (listName === 'discovery') discoveryCoins = updatedList;
    else if (listName === 'alarm') tempAlarmCoins = updatedList;

    updateCoinList(listName, updatedList);
    await saveCoinListToFirestore(listName);
    if (listName === 'crypto') await fetchAllDataAndRender();
    if (listName === 'ai') await fetchAiDataAndRender();
}

async function saveCoinListToFirestore(listName) {
    if (!userDocRef) return;
    try {
        if (listName === 'crypto') await userDocRef.update({ portfolios: userPortfolios });
        else if (listName === 'ai') await userDocRef.update({ coins_ai: cryptoAiPairs });
        else if (listName === 'discovery') await userDocRef.update({ coins_discovery: discoveryCoins });
    } catch (error) {
        console.error(`Error saving ${listName} list:`, error);
    }
}

async function setActivePortfolio(name) {
    activePortfolio = name;
    if(userDocRef) { await userDocRef.update({ activePortfolio: name }); }
    renderAllPortfolioTabs();
    await fetchAllDataAndRender();
    createCoinManager('crypto-coin-manager-container', userPortfolios[activePortfolio] || [], 'crypto');
}

async function handlePortfolioSave() {
    const action = document.getElementById('portfolioActionInput').value;
    const newName = document.getElementById('portfolioNameInput').value.trim();
    const originalName = document.getElementById('originalPortfolioNameInput').value;
    const errorDiv = document.getElementById('portfolio-error-message');

    if (!newName) { errorDiv.textContent = 'Liste adı boş olamaz.'; return; }
    if (userPortfolios[newName] && newName !== originalName) { errorDiv.textContent = 'Bu isimde bir liste zaten var.'; return; }

    if (action === 'new') {
        userPortfolios[newName] = [];
    } else if (action === 'rename') {
        const updatedPortfolios = {};
        for (const key in userPortfolios) {
            updatedPortfolios[key === originalName ? newName : key] = userPortfolios[key];
        }
        userPortfolios = updatedPortfolios;
    }
    await userDocRef.update({ portfolios: userPortfolios });
    await setActivePortfolio(newName);
    showNotification(action === 'new' ? `Liste "${newName}" oluşturuldu.` : `Liste "${originalName}" -> "${newName}" olarak değiştirildi.`, true);
    closeAllPanels();
}

async function handleDeletePortfolio() {
    if (Object.keys(userPortfolios).length <= 1) { showNotification("Son listeyi silemezsiniz!", false); return; }
    if (confirm(`"${activePortfolio}" listesini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
        const deletedPortfolio = activePortfolio;
        delete userPortfolios[activePortfolio];
        const newActive = Object.keys(userPortfolios)[0];
        await userDocRef.update({ portfolios: userPortfolios });
        await setActivePortfolio(newActive);
        showNotification(`"${deletedPortfolio}" listesi silindi.`, true);
    }
}

function saveChartState() {
    if (tradingViewWidget && typeof tradingViewWidget.save === 'function') {
        const currentPair = document.getElementById('chartPanelTitle').textContent + 'USDT';
        tradingViewWidget.save(async (state) => {
            if (settings.chartStates[currentPair] !== state) {
                settings.chartStates[currentPair] = state;
                if (userDocRef) {
                    try {
                        await userDocRef.update({ 'settings.chartStates': settings.chartStates });
                        showNotification("Grafik ayarları kaydedildi!", true);
                    } catch (error) {
                        showNotification("Grafik ayarları kaydedilemedi.", false);
                    }
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
    if (!alarmName) { showNotification("Alarm adı boş bırakılamaz.", false); hideLoading(btn); return; }

    const newAlarm = {
        id: alarmId || `alarm_${new Date().getTime()}`, name: alarmName, coins: tempAlarmCoins,
        isActive: alarmId ? (userAlarms.find(a => a.id === alarmId)?.isActive ?? true) : true,
        timeframe: document.getElementById('alarmTimeframe').value,
        trendFilterEnabled: document.getElementById('alarmTrendFilterEnabled').checked,
        adxThreshold: parseInt(document.getElementById('alarmADXThreshold').value),
        conditions: {
            volume: { enabled: document.getElementById('alarmVolumeCondition').checked, period: parseInt(document.getElementById('alarmVolumePeriod').value), multiplier: parseFloat(document.getElementById('alarmVolumeMultiplier').value), amount: parseFloat(document.getElementById('alarmVolumeAmount').value) || 0 },
            macd: { enabled: document.getElementById('alarmMacdCondition').checked, signalType: document.getElementById('alarmMacdSignalType').value },
            macdHistogram: { enabled: document.getElementById('alarmMacdHistogramCondition').checked, operator: document.getElementById('alarmMacdHistogramOperator').value, value: parseFloat(document.getElementById('alarmMacdHistogramValue').value) },
            rsi: { enabled: document.getElementById('alarmRsiCondition').checked, operator: document.getElementById('alarmRsiOperator').value, value: parseFloat(document.getElementById('alarmRsiValue').value) }
        }
    };
    
    const dnaRecDiv = document.querySelector('#alarmSettingsPanel .dna-recommendation');
    if (dnaRecDiv && dnaRecDiv.dataset.dnaAnalysis) {
        newAlarm.dna_analysis = JSON.parse(dnaRecDiv.dataset.dnaAnalysis);
    }

    if (alarmId) {
        userAlarms = userAlarms.map(a => a.id === alarmId ? newAlarm : a);
    } else {
        userAlarms.push(newAlarm);
    }

    try {
        await userDocRef.update({ alarms: userAlarms });
        showNotification("Alarm başarıyla kaydedildi.", true);
        renderAlarms(); closeAllPanels();
    } catch (error) {
        showNotification("Alarm kaydedilemedi.", false);
    } finally {
        hideLoading(btn);
    }
}

async function addReportToTrack(reportId) {
    if (!reportId || trackedReports.includes(reportId)) return;
    
    try {
        const reportDoc = await userDocRef.collection('alarm_reports').doc(reportId).get();
        if(!reportDoc.exists) {
            showNotification("Bu ID'ye sahip bir rapor bulunamadı.", false);
            return;
        }
        trackedReports.push(reportId);
        settings.trackedReportIds = trackedReports;
        await userDocRef.update({ 'settings.trackedReportIds': trackedReports });
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
    if(activeInterval) settings.cryptoAnalysisInterval = activeInterval.dataset.interval;
    
    const activePreset = document.querySelector('#strategyPresetFilters button.active');
    if(activePreset) {
        const selectedPreset = activePreset.dataset.preset;
        const newIndicators = {};
        if (selectedPreset === 'custom') {
            document.querySelectorAll('#crypto-indicator-filters-grid input:checked').forEach(cb => newIndicators[cb.dataset.indicator] = true);
        } else if (STRATEGY_PRESETS[selectedPreset]) {
            Object.assign(newIndicators, STRATEGY_PRESETS[selectedPreset].indicators);
        }
        settings.cryptoAnalysisIndicators = newIndicators;
    }

    try {
        await userDocRef.update({ 
            'settings.cryptoAnalysisIndicators': settings.cryptoAnalysisIndicators,
            'settings.cryptoAnalysisInterval': settings.cryptoAnalysisInterval,
            coins_ai: cryptoAiPairs 
        });
        await fetchAiDataAndRender();
        showNotification("Analiz ayarları güncellendi.", true);
    } catch(e) {
        showNotification("Ayarlar güncellenemedi.", false);
    } finally {
        hideLoading(btn);
    }
}

function setupGlobalEventListeners() {
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('.close-btn') || e.target === document.getElementById('modalOverlay')) {
            closeAllPanels();
        }
    });
}

function setupTrackerPageEventListeners() {
    const trackerPageEl = document.getElementById('tracker-page');
    if (!trackerPageEl) return;

    setupTabEventListeners(trackerPageEl);
    setupPanelEventListeners(trackerPageEl);
    setupActionEventListeners(trackerPageEl);
    setupCoinManagerEventListeners(trackerPageEl);
    setupReportEventListeners(trackerPageEl);
    setupStrategyDiscoveryListeners(trackerPageEl);
    setupAiPageActionListeners(trackerPageEl);
    setupPivotPageActionListeners(trackerPageEl);
    setupAlarmEventListeners(trackerPageEl);
}

function setupTabEventListeners(parentElement) {
    parentElement.querySelector('.tabs')?.addEventListener('click', async (e) => {
        const tabLink = e.target.closest('.tab-link');
        if (!tabLink || tabLink.classList.contains('active')) return;

        parentElement.querySelector('.tab-link.active')?.classList.remove('active');
        parentElement.querySelector('.tab-content.active')?.classList.remove('active');
        tabLink.classList.add('active');
        const activeTabContent = document.getElementById(`${tabLink.dataset.tab}-content`);
        if (activeTabContent) {
            activeTabContent.classList.add('active');
            switch (tabLink.dataset.tab) {
                case 'crypto':
                    createCoinManager('crypto-coin-manager-container', userPortfolios[activePortfolio] || [], 'crypto');
                    break;
                case 'crypto-ai':
                    createCoinManager('ai-coin-manager-container', cryptoAiPairs, 'ai');
                    await fetchAiDataAndRender();
                    break;
                case 'crypto-pivot':
                    renderSupportResistance();
                    break;
                case 'strategy-discovery':
                    createCoinManager('discovery-coin-manager-container', discoveryCoins, 'discovery');
                    break;
                case 'alarms':
                    renderAlarms();
                    break;
                case 'alarm-reports':
                    renderAlarmReports();
                    break;
            }
        }
    });
}


function setupPanelEventListeners(parentElement) {
    parentElement.addEventListener('click', (e) => {
        if (e.target.closest('#settingsBtn')) showPanel('settingsPanel');
        if (e.target.closest('#saveSettingsBtn')) saveSettings();
        if (e.target.closest('#saveChartBtn')) saveChartState();
        if (e.target.closest('#saveAlarmBtn')) saveAlarm();
        if (e.target.closest('#savePortfolioBtn')) handlePortfolioSave();
        
        const collapsibleHeader = e.target.closest('.collapsible-header');
        if (collapsibleHeader) {
            const content = collapsibleHeader.nextElementSibling;
            collapsibleHeader.classList.toggle('open');
            content.classList.toggle('open');
        }
    });

    const alarmSettingsPanel = document.getElementById('alarmSettingsPanel');
    if (alarmSettingsPanel) {
        alarmSettingsPanel.addEventListener('change', (e) => {
            if (e.target.matches('[data-condition]')) {
                const isChecked = e.target.checked;
                const parentBox = e.target.closest('.alarm-condition-box');
                if (parentBox) parentBox.dataset.disabled = !isChecked;
            }
        });
    }
}

function setupActionEventListeners(parentElement) {
    parentElement.addEventListener('click', async (e) => {
        const target = e.target;
        const portfolioTab = target.closest('.portfolio-tab');
        if (portfolioTab && !portfolioTab.classList.contains('active')) { 
            const containerId = portfolioTab.parentElement.id;
            const portfolioName = portfolioTab.dataset.portfolioName;
            document.querySelectorAll(`#${containerId} .portfolio-tab`).forEach(t => t.classList.remove('active'));
            portfolioTab.classList.add('active');
            if (containerId === 'portfolioTabs') await setActivePortfolio(portfolioName);
            if (containerId === 'pivotPortfolioTabs') renderSupportResistance();
            return;
        }
        if (target.closest('#newPortfolioBtn')) { showPortfolioModal('new'); return; }
        if (target.closest('#renamePortfolioBtn')) { showPortfolioModal('rename'); return; }
        if (target.closest('#deletePortfolioBtn')) { await handleDeletePortfolio(); return; }
        if (target.closest('#refreshBtn')) { await fetchAllDataAndRender(); return; }
        const assetCell = target.closest('.asset-cell');
        if (assetCell) { showChart(assetCell.dataset.pair); return; }
        const sortableHeader = target.closest('#crypto-content th.sortable');
        if (sortableHeader) {
             const key = sortableHeader.dataset.sortKey;
             if (currentSort.key !== key) { currentSort.key = key; currentSort.order = 'asc'; }
             else { currentSort.order = currentSort.order === 'asc' ? 'desc' : 'default'; if (currentSort.order === 'default') currentSort.key = null; }
             sortAndRenderTable(); return;
        }
        
        const clickablePct = target.closest('.clickable-pct');
        if (clickablePct) {
            const { col, pair } = clickablePct.dataset;
            const assetData = allCryptoData.find(c => c.pair === pair);
            if (assetData && !assetData.error) {
                const colData = assetData[`col${col}`];
                if (colData && typeof colData.pct === 'number') {
                    const periodName = settings.columns[col].name;
                    const pctChange = colData.pct.toFixed(2);
                    document.getElementById('detailPanelTitle').textContent = `${assetData.pair.replace('USDT','')} - ${periodName} Değişim Detayı`;
                    document.getElementById('detailPanelContent').innerHTML = translations[settings.lang].lowest_price_detail(periodName, formatPrice(colData.lowestPrice), colData.lowestDate, formatPrice(assetData.latestPrice), pctChange);
                    showPanel('detailPanel');
                }
            }
            return;
        }

        if (target.closest('#logoutBtn')) { e.preventDefault(); auth.signOut(); return;}
    });
}

function setupAlarmEventListeners(parentElement) {
    parentElement.addEventListener('click', async (e) => {
        const target = e.target;
         const alarmCard = target.closest('.alarm-card');
        if(alarmCard) {
            const alarmId = alarmCard.dataset.alarmId;
            const alarm = userAlarms.find(a => a.id === alarmId);
            if(!alarm) return;
            if(target.closest('.edit-alarm-btn')) openAlarmPanel(alarm);
            if(target.closest('.delete-alarm-btn')) { if(confirm("Bu alarmı silmek istediğinizden emin misiniz?")) { userAlarms = userAlarms.filter(a => a.id !== alarmId); await userDocRef.update({ alarms: userAlarms }); renderAlarms(); showNotification("Alarm silindi.", true); } }
            if(target.closest('.backtest-alarm-btn')) runBacktest(alarmId);
            if(target.closest('.check-alarm-status-btn')) showAlarmStatus(alarmId);
            if (target.matches('.alarm-status-toggle')) { alarm.isActive = target.checked; await userDocRef.update({ alarms: userAlarms }); showNotification(`Alarm ${alarm.isActive ? 'aktif' : 'pasif'} edildi.`, true); }
            return;
        }
        if (target.closest('#createNewAlarmBtn')) { if (!settings.telegramPhone) { showNotification("Lütfen Ayarlar'dan Telegram Chat ID'nizi kaydedin.", false); return; } openAlarmPanel(null); return;}
    });
}

function setupReportEventListeners(parentElement) {
     parentElement.addEventListener('click', async (e) => {
        const target = e.target;
         if (target.closest('#autoRefreshReportsToggle')) { toggleReportsAutoRefresh(); return; }
        if (target.closest('.remove-report-btn')) {
            const reportIdToRemove = target.closest('.remove-report-btn').dataset.reportId;
            trackedReports = trackedReports.filter(id => id !== reportIdToRemove);
            settings.trackedReportIds = trackedReports;
            await userDocRef.update({ 'settings.trackedReportIds': trackedReports });
            await renderAlarmReports();
            return;
        }
     });
    
    const reportIdInput = document.getElementById('reportIdInput');
    if(reportIdInput) {
        reportIdInput.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') {
                const reportId = e.target.value.trim();
                if(reportId) addReportToTrack(reportId);
                e.target.value = '';
            }
        });
    }
}

function setupCoinManagerEventListeners(parentElement) {
    parentElement.addEventListener('click', (e) => {
        const addBtn = e.target.closest('.add-coin-btn');
        if (addBtn) { handleAddCoin(addBtn.dataset.listName); return; }
        
        const removeBtn = e.target.closest('.remove-coin-tag, .remove-btn');
        if(removeBtn) { handleRemoveCoin(removeBtn.dataset.listName, removeBtn.dataset.pair); return; }
    });
    parentElement.addEventListener('keypress', (e) => {
        const input = e.target.closest('.new-coin-input');
        if (input && e.key === 'Enter') { handleAddCoin(input.dataset.listName); }
    });
}

function setupStrategyDiscoveryListeners(parentElement) {
    parentElement.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.closest('#runSignalAnalysisBtn')) { await runSignalAnalysis(); return; }
        if (target.closest('.use-dna-in-alarm-btn')) { 
            const btn = target.closest('.use-dna-in-alarm-btn');
            const dnaData = JSON.parse(btn.dataset.dna);
            openAlarmPanel(null, dnaData);
            return;
        }
    });
}

function setupAiPageActionListeners(parentElement) {
    parentElement.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.closest('#updateCryptoAnalysisBtn')) { await updateAnalysisSettings(); return; }
    });
}

function setupPivotPageActionListeners(parentElement) {
     parentElement.addEventListener('click', async (e) => {
        const target = e.target;
        const pivotFilterBtn = target.closest('#cryptoPivotFilters button');
        if(pivotFilterBtn && !pivotFilterBtn.classList.contains('active')) {
            settings.cryptoPivotFilter = pivotFilterBtn.dataset.filter;
            await userDocRef.update({ 'settings.cryptoPivotFilter': settings.cryptoPivotFilter });
            document.querySelector('#cryptoPivotFilters button.active')?.classList.remove('active');
            pivotFilterBtn.classList.add('active');
            renderSupportResistance();
            return;
        }
     });
}
