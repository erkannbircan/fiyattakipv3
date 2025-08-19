function setupGlobalEventListeners() {
    document.body.addEventListener('click', async (e) => {
        if (e.target.closest('.close-btn') || e.target === document.getElementById('modalOverlay')) {
            const chartPanel = document.getElementById('chartPanel');
            if (chartPanel && chartPanel.classList.contains('show')) {
                const widgetToSave = state.tradingViewWidget;
                await saveChartState(widgetToSave);
            }
            closeAllPanels();
        }
    });
}

function setupAuthEventListeners() {
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const errorMessageDiv = document.getElementById('error-message');

    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            if (!email || !password) {
                if (errorMessageDiv) errorMessageDiv.textContent = 'E-posta ve şifre alanları boş bırakılamaz.';
                return;
            }
            showLoading(loginBtn);
            try {
                await state.firebase.auth.signInWithEmailAndPassword(email, password);
                if (errorMessageDiv) errorMessageDiv.textContent = '';
            } catch (error) {
                if (errorMessageDiv) errorMessageDiv.textContent = `Giriş yapılamadı: ${error.message}`;
            } finally {
                hideLoading(loginBtn);
            }
        });
    }

    if (signupBtn) {
        signupBtn.addEventListener('click', async () => {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            if (!email || !password) {
                if (errorMessageDiv) errorMessageDiv.textContent = 'E-posta ve şifre alanları boş bırakılamaz.';
                return;
            }
            showLoading(signupBtn);
            try {
                await state.firebase.auth.createUserWithEmailAndPassword(email, password);
                if (errorMessageDiv) errorMessageDiv.textContent = '';
            } catch (error) {
                if (errorMessageDiv) errorMessageDiv.textContent = `Kayıt olunamadı: ${error.message}`;
            } finally {
                hideLoading(signupBtn);
            }
        });
    }
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
    setupScannerEventListeners(trackerPageEl);
}

function setupTabEventListeners(parentElement) {
    parentElement.querySelector('.tabs')?.addEventListener('click', async (e) => {
        const tabLink = e.target.closest('.tab-link');
        if (!tabLink || tabLink.classList.contains('active')) return;

        // YENİ: Otomatik tarayıcıyı durdurmak için eski sekmeyi kontrol et
        const oldActiveTab = parentElement.querySelector('.tab-link.active');
        if (oldActiveTab && oldActiveTab.dataset.tab === 'live-scanner') {
            toggleAutoScanner(false); // Canlı tarama sekmesinden ayrılıyorsak, zamanlayıcıyı durdur.
            console.log("Canlı tarayıcı sekmesinden ayrıldı, otomatik tarama durduruldu.");
        }

        parentElement.querySelector('.tab-link.active')?.classList.remove('active');
        parentElement.querySelector('.tab-content.active')?.classList.remove('active');
        tabLink.classList.add('active');
        const activeTabContent = document.getElementById(`${tabLink.dataset.tab}-content`);

        if (activeTabContent) {
            activeTabContent.classList.add('active');
            switch (tabLink.dataset.tab) {
                // ... diğer case'ler aynı kalacak ...
                case 'live-scanner':
                    const toggle = document.getElementById('toggleAutoScanner');
                    // YENİ: Sekmeye gelindiğinde, eğer ayar açıksa taramayı başlat.
                    if (toggle && toggle.checked) {
                        toggleAutoScanner(true);
                        console.log("Canlı tarayıcı sekmesine girildi, otomatik tarama başlatıldı.");
                    } else {
                        updateScannerStatusUI('stopped');
                    }
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
        if (e.target.closest('#saveAlarmBtn')) saveAlarm();
        if (e.target.closest('#savePortfolioBtn')) handlePortfolioSave();
        
        const collapsibleHeader = e.target.closest('.collapsible-header');
        if (collapsibleHeader) {
            const content = collapsibleHeader.nextElementSibling;
            if(content) {
                collapsibleHeader.classList.toggle('open');
                content.classList.toggle('open');
            }
        }
    });

    const alarmSettingsPanel = document.getElementById('alarmSettingsPanel');
    if (alarmSettingsPanel) {
        alarmSettingsPanel.addEventListener('change', (e) => {
            if (e.target.matches('[data-condition]')) {
                const isChecked = e.target.checked;
                const parentBox = e.target.closest('.alarm-condition-box');
                if (parentBox) {
                    parentBox.dataset.disabled = String(!isChecked);
                }
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
            if (state.currentSort.key !== key) { state.currentSort.key = key; state.currentSort.order = 'asc'; }
            else { state.currentSort.order = state.currentSort.order === 'asc' ? 'desc' : 'default'; if (state.currentSort.order === 'default') state.currentSort.key = null; }
            sortAndRenderTable(); return;
        }
        const clickablePct = target.closest('.clickable-pct');
        if (clickablePct) {
            const { col, pair } = clickablePct.dataset;
            const assetData = state.allCryptoData.find(c => c.pair === pair);
            if (assetData && !assetData.error) {
                const colData = assetData[`col${col}`];
                if (colData && typeof colData.pct === 'number') {
                    const periodName = state.settings.columns[col].name;
                    const pctChange = colData.pct.toFixed(2);
                    document.getElementById('detailPanelTitle').textContent = `${assetData.pair.replace('USDT', '')} - ${periodName} Değişim Detayı`;
                    document.getElementById('detailPanelContent').innerHTML = translations[state.settings.lang].lowest_price_detail(periodName, formatPrice(colData.lowestPrice), colData.lowestDate, formatPrice(assetData.latestPrice), pctChange);
                    showPanel('detailPanel');
                }
            }
            return;
        }
        if (target.closest('#logoutBtn')) { e.preventDefault(); state.firebase.auth.signOut(); return; }
    });
}

function setupReportEventListeners(parentElement) {
    parentElement.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.closest('#autoRefreshReportsToggle')) { toggleReportsAutoRefresh(); return; }
        if (target.closest('.remove-report-btn')) {
            const reportIdToRemove = target.closest('.remove-report-btn').dataset.reportId;
            state.trackedReports = state.trackedReports.filter(id => id !== reportIdToRemove);
            state.settings.trackedReportIds = state.trackedReports;
            await state.userDocRef.update({ 'settings.trackedReportIds': state.trackedReports });
            await renderAlarmReports();
            return;
        }
    });
    const reportIdInput = document.getElementById('reportIdInput');
    if (reportIdInput) {
        reportIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const reportId = e.target.value.trim();
                if (reportId) addReportToTrack(reportId);
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
        if (removeBtn) { handleRemoveCoin(removeBtn.dataset.listName, removeBtn.dataset.pair); return; }
    });
    parentElement.addEventListener('keypress', (e) => {
        const input = e.target.closest('.new-coin-input');
        if (input && e.key === 'Enter') { handleAddCoin(input.dataset.listName); }
    });
}

function setupAiPageActionListeners(parentElement) {
    parentElement.addEventListener('click', async (e) => {
        const target = e.target;
        const filterButton = target.closest('#strategyPresetFilters button, #cryptoIntervalFilters button');
        if (filterButton && !filterButton.classList.contains('active')) {
            const parent = filterButton.parentElement;
            parent.querySelector('.active')?.classList.remove('active');
            filterButton.classList.add('active');
            return;
        }
        if (target.closest('#updateCryptoAnalysisBtn')) {
            await updateAnalysisSettings();
            return;
        }
    });
}

function setupStrategyDiscoveryListeners(parentElement) {
    parentElement.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.closest('#runSignalAnalysisBtn')) {
            const btn = e.target.closest('#runSignalAnalysisBtn');
            showLoading(btn);
            const dnaParams = {};
            document.querySelectorAll('#signalDnaParamsGrid input:checked').forEach(cb => {
                dnaParams[cb.dataset.param] = true;
            });
            const params = {
                coins: state.discoveryCoins,
                timeframe: document.getElementById('signalAnalysisTimeframe').value,
                changePercent: parseFloat(document.getElementById('signalAnalysisChange').value),
                direction: document.getElementById('signalAnalysisDirection').value,
                days: parseInt(document.getElementById('signalAnalysisPeriod').value),
                lookbackCandles: parseInt(document.getElementById('signalLookbackCandles').value) || 3,
                params: dnaParams,
                isPreview: true
            };
            runSignalAnalysisPreview(params).finally(() => { hideLoading(btn); });
            return;
        }
        const saveBtn = target.closest('.save-dna-btn');
        if (saveBtn) {
            const profileData = JSON.parse(saveBtn.dataset.profile);
            await saveDnaProfile(profileData, saveBtn);
            return;
        }
        if (target.closest('#refreshDnaProfilesBtnDiscovery')) {
            await fetchDnaProfiles('dnaProfilesContainerDiscovery');
            return;
        }
        const deleteBtn = target.closest('.delete-dna-btn');
        if (deleteBtn) {
            const profileId = deleteBtn.dataset.profileId;
            await deleteDnaProfile(profileId);
            return;
        }
        const backtestBtn = target.closest('.run-dna-backtest-btn');
        if (backtestBtn) {
            const profileId = backtestBtn.dataset.profileId;
            // Şimdilik varsayılan olarak 30 günlük periyot seçelim.
            // Gelecekte buraya bir periyot seçim menüsü ekleyebilirsiniz.
            const periodDays = 30;
            await runDnaBacktest(profileId, periodDays);
            return;
        }
    });
} // <-- DÜZELTME: Eksik olan kapanış '}' karakteri buraya eklendi.

function setupPivotPageActionListeners(parentElement) {
    parentElement.addEventListener('click', async (e) => {
        const target = e.target;
        const pivotFilterBtn = target.closest('#cryptoPivotFilters button');
        if (pivotFilterBtn && !pivotFilterBtn.classList.contains('active')) {
            state.settings.cryptoPivotFilter = pivotFilterBtn.dataset.filter;
            await state.userDocRef.update({ 'settings.cryptoPivotFilter': state.settings.cryptoPivotFilter });
            document.querySelector('#cryptoPivotFilters button.active')?.classList.remove('active');
            pivotFilterBtn.classList.add('active');
            renderSupportResistance();
            return;
        }
    });
}

function setupScannerEventListeners(parentElement) {
    const scannerContent = document.getElementById('live-scanner-content');
    if (scannerContent) {
        scannerContent.addEventListener('change', (e) => {
            if (e.target.matches('#toggleAutoScanner')) {
                toggleAutoScanner(e.target.checked);
            }
        });
    }
}

function setupSaveSettingsButtonListener() {
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) {
        if (saveBtn.dataset.listenerAttached) return;
        saveBtn.addEventListener('click', () => { saveSettings(); });
        saveBtn.dataset.listenerAttached = 'true';
    }
}

function setupUpdateAnalysisButtonListener() {
    const updateBtn = document.getElementById('updateCryptoAnalysisBtn');
    if (updateBtn) {
        if (updateBtn.dataset.listenerAttached) return;
        updateBtn.addEventListener('click', () => { updateAnalysisSettings(); });
        updateBtn.dataset.listenerAttached = 'true';
    }
}
