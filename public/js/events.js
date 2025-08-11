function setupGlobalEventListeners() {
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('.close-btn') || e.target === document.getElementById('modalOverlay')) {
            closeAllPanels();
        }
    });
}

function setupAuthEventListeners() {
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const errorMessageDiv = document.getElementById('error-message');

    if(loginBtn) {
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

    if(signupBtn) {
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
    setupAlarmEventListeners(trackerPageEl);
    setupScannerEventListeners(trackerPageEl);
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
                    createCoinManager('crypto-coin-manager-container', state.userPortfolios[state.activePortfolio] || [], 'crypto');
                    break;
                case 'crypto-ai':
                    createCoinManager('ai-coin-manager-container', state.cryptoAiPairs, 'ai');
                    await fetchAiDataAndRender();
                    break;
                case 'crypto-pivot':
                    renderSupportResistance();
                    break;
                case 'strategy-discovery':
                    createCoinManager('discovery-coin-manager-container', state.discoveryCoins, 'discovery');
                    break;
                case 'live-scanner':
                    document.getElementById('scannerResultsTable').innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">Tarama başlatılmadı.</td></tr>`;
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
        if (e.target.closest('#testAlarmBtn')) sendTestTelegramMessage();
        
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
                    document.getElementById('detailPanelTitle').textContent = `${assetData.pair.replace('USDT','')} - ${periodName} Değişim Detayı`;
                    document.getElementById('detailPanelContent').innerHTML = translations[state.settings.lang].lowest_price_detail(periodName, formatPrice(colData.lowestPrice), colData.lowestDate, formatPrice(assetData.latestPrice), pctChange);
                    showPanel('detailPanel');
                }
            }
            return;
        }

        if (target.closest('#logoutBtn')) { e.preventDefault(); state.firebase.auth.signOut(); return;}
    });
}

function setupAlarmEventListeners(parentElement) {
    parentElement.addEventListener('click', async (e) => {
        const target = e.target;
         const alarmCard = target.closest('.alarm-card');
        if(alarmCard) {
            const alarmId = alarmCard.dataset.alarmId;
            const alarm = state.userAlarms.find(a => a.id === alarmId);
            if(!alarm) return;
            if(target.closest('.edit-alarm-btn')) openAlarmPanel(alarm);
            if(target.closest('.delete-alarm-btn')) { if(confirm("Bu alarmı silmek istediğinizden emin misiniz?")) { state.userAlarms = state.userAlarms.filter(a => a.id !== alarmId); await state.userDocRef.update({ alarms: state.userAlarms }); renderAlarms(); showNotification("Alarm silindi.", true); } }
            if(target.closest('.backtest-alarm-btn')) runBacktest(alarmId);
            if(target.closest('.check-alarm-status-btn')) showAlarmStatus(alarmId);
            if (target.matches('.alarm-status-toggle')) { alarm.isActive = target.checked; await state.userDocRef.update({ alarms: state.userAlarms }); showNotification(`Alarm ${alarm.isActive ? 'aktif' : 'pasif'} edildi.`, true); }
            return;
        }
        if (target.closest('#createNewAlarmBtn')) { if (!state.settings.telegramPhone) { showNotification("Lütfen Ayarlar'dan Telegram Chat ID'nizi kaydedin.", false); return; } openAlarmPanel(null); return;}
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
        
        // Ana analiz butonunun görevini değiştiriyoruz.
        if (target.closest('#runSignalAnalysisBtn')) {
            await runSignalAnalysisPreview(); // HATA DÜZELTİLDİ: Artık doğru fonksiyonu ('önizleme') çağırıyor.
            return;
        }
        
        // Dinamik olarak oluşturulan 'Kaydet' butonu için olay dinleyici
        const saveBtn = target.closest('.save-dna-btn');
        if (saveBtn) {
            const params = JSON.parse(saveBtn.dataset.params);
            const coin = target.closest('.backtest-card').dataset.coin;
            params.coins = [coin]; // Sadece bu coin için kaydetme işlemi yap
            await saveDnaProfile(params);
            return;
        }

        // Bu buton henüz eklenmedi ama geleceğe hazırlık için duruyor.
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
    parentElement.addEventListener('click', (e) => {
        if (e.target.closest('#startScannerBtn')) {
            startScanner();
        }
    });
}

async function sendTestTelegramMessage() {
    const btn = document.getElementById('testAlarmBtn');
    if (!state.settings.telegramPhone) {
        showNotification("Lütfen Ayarlar'dan Telegram Chat ID'nizi kaydedin.", false);
        return;
    }
    showLoading(btn);
    try {
        const sendTestNotification = state.firebase.functions.httpsCallable('sendTestNotification');
        await sendTestNotification({ chatId: state.settings.telegramPhone });
        showNotification("Test bildirimi başarıyla gönderildi!", true);
    } catch (error) {
        console.error("Telegram test hatası:", error);
        showNotification("Test bildirimi gönderilemedi. Chat ID'nizi kontrol edin.", false);
    } finally {
        hideLoading(btn);
    }
}
