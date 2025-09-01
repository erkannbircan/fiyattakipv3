// ---- GLOBAL ÇATI (her JS dosyasının en üstüne koy) ----
window.App = window.App || {
  // sürüm bilgisi bu tur için (elle güncelle)
  version: 'v3.0.0-' + (window.App?.versionTag || ''),
  loaded: {},
  guards: {},
  log: (...args) => console.log('[App]', ...args),
};

// --- Fallback: showLoading/hideLoading ui.js yüklenmeden çağrılırsa hata vermesin ---
if (typeof window.showLoading !== 'function') {
  window.showLoading = function (button) {
    if (!button) return;
    button.dataset.originalHtml = button.innerHTML;
    button.innerHTML = '<div class="loading"></div>';
    button.disabled = true;
  };
}
if (typeof window.hideLoading !== 'function') {
  window.hideLoading = function (button) {
    if (!button) return;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
    }
    button.disabled = false;
  };
}

// --- Fallback: applySettingsToUI tanımlı değilse çakılmasın ---
if (typeof window.applySettingsToUI !== 'function') {
  window.applySettingsToUI = function (settings) {
    // Gerçek fonksiyon ui.js içinde olabilir; yüklenmediyse site çakılmasın
    window.App?.log?.('applySettingsToUI (fallback): ayarlar şimdilik uygulanmadı');
  };
}
if (typeof window.renderAllPortfolioTabs !== 'function') {
  window.renderAllPortfolioTabs = function () { /* no-op */ };
}
if (typeof window.createCoinManager !== 'function') {
  window.createCoinManager = function () { /* no-op */ };
}


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

// Bu fonksiyon artık sayfalar arası geçişle ilgili değil,
// sadece belirli sayfalara özel işlemleri (tarayıcıyı başlatma gibi) tetiklemek için var.
function setupTabEventListeners(parentElement) {
    // Navigasyon linklerinin "active" durumunu güncelleyelim.
    const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
    const navLinks = document.querySelectorAll('#main-nav .tab-link');
    
    navLinks.forEach(link => {
        // "index" anasayfa olduğu için özel bir kontrol yapıyoruz.
        const linkPage = link.dataset.page;
        if (linkPage === 'index' && (currentPage === '' || currentPage === 'index')) {
            link.classList.add('active');
        } else if (linkPage !== 'index' && currentPage === linkPage) {
            link.classList.add('active');
        }
    });

    // Sayfaya özel işlemleri burada kontrol edebiliriz.
    // Örnek: Eğer "tarama.html" sayfasındaysak ve ayar açıksa tarayıcıyı başlat.
    if (currentPage === 'tarama' || (currentPage === '' && window.location.pathname.endsWith('/tarama.html'))) {
        const toggle = document.getElementById('toggleAutoScanner');
        if (toggle && toggle.checked) {
            toggleAutoScanner(true);
            console.log("Canlı tarayıcı sayfasına girildi, otomatik tarama başlatıldı.");
        } else {
            updateScannerStatusUI('stopped');
        }
    }
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
  const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn && !settingsBtn.dataset.listenerAttached) {
        settingsBtn.addEventListener('click', () => showPanel('settingsPanel'));
        settingsBtn.dataset.listenerAttached = 'true';
    }

    parentElement.addEventListener('click', (e) => {
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
}

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
      const clickablePct = target.closest('.clickable-pct');
        if (clickablePct) {
            const { col, pair } = clickablePct.dataset;
            const assetData = state.allCryptoData.find(c => c.pair === pair);
            
            const detailTitle = document.getElementById('detailPanelTitle');
            const detailContent = document.getElementById('detailPanelContent');
            
            if (!detailTitle || !detailContent) {
                console.error('Detail panel elements not found!');
                return;
            }

            if (assetData && !assetData.error) {
                const colData = assetData[`col${col}`];
                if (colData && typeof colData.pct === 'number') {
                    const periodName = state.settings.columns[col].name;
                    const pctChange = colData.pct.toFixed(2);
                    
                    detailTitle.textContent = `${assetData.pair.replace('USDT', '')} - ${periodName} Değişim Detayı`;
                    detailContent.innerHTML = `
                        <div class="detail-item">
                            <span>Değişim:</span>
                            <span class="${colData.pct >= 0 ? 'positive' : 'negative'}">${pctChange}%</span>
                        </div>
                        <div class="detail-item">
                            <span>Gün Sayısı:</span>
                            <span>${state.settings.columns[col].days} gün</span>
                        </div>
                        <div class="detail-item">
                            <span>Eşik Değeri:</span>
                            <span>${state.settings.columns[col].threshold}%</span>
                        </div>
                        <div class="detail-item">
                            <span>Hesaplanma Zamanı:</span>
                            <span>${new Date().toLocaleString('tr-TR')}</span>
                        </div>
                    `;
                    showPanel('detailPanel');
                }
            }
            return;
        }
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

        // --- YENİ EKLENEN BLOK ---
        if (target.closest('#analyzeAllCryptoBtn')) {
            // Analiz edilecek veriyi state'den alıyoruz (sadece ilk 5 tanesi, çok uzun sürmemesi için)
            const dataForAnalysis = state.allCryptoData.slice(0, 5);
            if (dataForAnalysis.length > 0) {
                await analyzeWithGemini(dataForAnalysis);
            } else {
                showNotification("Analiz edilecek veri bulunamadı.", false);
            }
            return;
        }
        // --- BİTİŞ ---
    });
}

function setupStrategyDiscoveryListeners(parentElement) {
  
    // --- YENİ: Ayar değişikliklerini dinleyen fonksiyon ---
     const updateHintsOnTheFly = async () => {
        const timeframe = document.getElementById('signalAnalysisTimeframe')?.value;
        const days = parseInt(document.getElementById('signalAnalysisPeriod')?.value);
        // Sadece 'auto' seçiliyken lookahead önerisini göstermek için
        const fixedLookaheadPreset = document.getElementById('fixedLookaheadPreset')?.value;

        if (timeframe && days) {
            const smart = await computeSmartDiscoveryHints({ timeframe, days });
            // Lookahead önerisini sadece "Akıllı" seçeneği aktifse göstermek için koşul ekliyoruz
            updateSmartBadges(smart); 
            
            // Eğer lookahead için 'Akıllı' seçilmişse ve öneri varsa, bunu input'a da yazalım (eğer akıllı checkbox işaretliyse)
            const useSmartLookback = document.getElementById('useSmartLookback')?.checked;
            if (useSmartLookback && smart?.lookback) {
                document.getElementById('signalLookbackCandles').value = smart.lookback;
            }
            if (fixedLookaheadPreset === 'auto' && smart?.lookahead) {
                // Burada bir input'a değer yazmadığımız için sadece göstereceğiz.
            }

        } else {
            // Eğer gerekli parametreler yoksa önerileri temizle
            updateSmartBadges(null);
        }
    };

    // --- YENİ: Ayar kutularına dinleyici ekliyoruz ---
    const timeframeSelect = document.getElementById('signalAnalysisTimeframe');
    const periodSelect = document.getElementById('signalAnalysisPeriod');
    
    if (timeframeSelect) timeframeSelect.addEventListener('change', updateHintsOnTheFly);
    if (periodSelect) periodSelect.addEventListener('change', updateHintsOnTheFly);

    // --- Mevcut tıklama dinleyiciniz ---
    parentElement.addEventListener('click', async (e) => {
        const target = e.target;

        if (target.matches('.show-all-opportunities-btn')) {
            const coinSymbol = target.dataset.coin;
            document.querySelectorAll(`.opportunity-row.hidden[data-coin="${coinSymbol}"]`).forEach(row => {
                row.classList.remove('hidden');
            });
            target.style.display = 'none';
            return;
        }

        if (target.closest('#runSignalAnalysisBtn')) {
            const btn = target.closest('#runSignalAnalysisBtn');
            showLoading(btn);

            const rc = document.getElementById('signalAnalysisResultContainer');
            if (rc) rc.innerHTML = `<div class="spinner-container"><div class="spinner"></div><p>Analiz sonuçları hazırlanıyor...</p></div>`;
            document.getElementById('discoveryResultsPanel')?.scrollIntoView({ behavior:'smooth', block:'start' });

            try {
                const timeframe = document.getElementById('signalAnalysisTimeframe').value;
                const days = parseInt(document.getElementById('signalAnalysisPeriod').value);
                const changePercent = parseFloat(document.getElementById('signalAnalysisChange').value);
                const direction = document.getElementById('signalAnalysisDirection').value;
                const useSmartLookback = document.getElementById('useSmartLookback')?.checked;

                const dnaParams = {};
                document.querySelectorAll('#signalDnaParamsGrid input[type="checkbox"]:checked')
                  .forEach(cb => { dnaParams[cb.dataset.param] = true; });

                let lookbackCandles = parseInt(document.getElementById('signalLookbackCandles').value) || 9;
                const lookaheadModeSelect = document.getElementById('fixedLookaheadPreset')?.value || 'auto';
                const customLookaheadCandles = parseInt(document.getElementById('customLookaheadCandles')?.value) || 0;
                
                // Analiz butonuna basıldığında da en güncel öneriyi hesaplıyoruz.
                const smart = await computeSmartDiscoveryHints({ timeframe, days });
                updateSmartBadges(smart);

                if (useSmartLookback && smart?.lookback) {
                  lookbackCandles = smart.lookback;
                  const el = document.getElementById('signalLookbackCandles');
                  if (el) el.value = lookbackCandles;
                }

                let lookaheadFinalCandles = 0;
                let finalMode = 'smart';

                if (customLookaheadCandles > 0) {
                    lookaheadFinalCandles = customLookaheadCandles;
                    finalMode = 'custom';
                } else if (lookaheadModeSelect !== 'auto') {
                    lookaheadFinalCandles = presetToCandles(lookaheadModeSelect, timeframe);
                    finalMode = lookaheadModeSelect;
                } else if (smart?.lookahead) {
                    lookaheadFinalCandles = smart.lookahead;
                }

              onst useAutoDna = document.getElementById('useAutoDna')?.checked;
                const params = {
                  coins: state.discoveryCoins,
                  timeframe, changePercent, direction, days,
                  lookbackCandles: Number(lookbackCandles),
                  lookaheadCandles: Number(lookaheadFinalCandles),
                  lookaheadMode: finalMode,
                  params: dnaParams,
                  auto: !!useAutoDna,     
                };

                if (typeof runSignalAnalysisPreviewRemote === 'function') {
                    await runSignalAnalysisPreviewRemote(params);
                } else {
                    if (rc) rc.innerHTML = `<div class="error-msg">Analiz fonksiyonu yüklenemedi.</div>`;
                }

            } catch (err) {
                console.error('Analiz hatası:', err);
                const rc = document.getElementById('signalAnalysisResultContainer');
                if (rc) rc.innerHTML = `<div class="error-msg">Analiz sırasında hata oluştu.</div>`;
            } finally {
                hideLoading(btn);
            }
            return;
        }

       const saveBtn = target.closest('.save-dna-btn');
if (saveBtn) {
  const profileData = JSON.parse(saveBtn.dataset.profile || '{}');

  // name yoksa burada üret (api.js yine kontrol ediyor ama iki tarafta da güvence)
  if (profileData && !profileData.name) {
    const ts  = Date.now();
    const sym = profileData.coin || 'COIN';
    const tf  = profileData.timeframe || 'TF';
    const lb  = profileData.lookbackCandles ?? 'LB';
    const dir = (profileData.direction === 'down' ? '-' : '+') + (profileData.changePercent ?? 0) + '%';
    const sig = Array.isArray(profileData.featureOrder) ? profileData.featureOrder.join('').slice(0,12) : 'DNA';
    profileData.name = `${sym}__${dir}__${tf}__${lb}LB__${sig}__${ts}`;
  }

  await saveDnaProfile(profileData, saveBtn);
  return;
        }
    });

  // Sayfa ilk yüklendiğinde akıllı önerileri hesapla ve göster
  updateHintsOnTheFly();
}


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
// events.js dosyasının sonuna bu yeni fonksiyonu ekleyin

function setupBacktestPageEventListeners() {
    let currentProfileId = null; // Test edilen profili hafızada tutmak için

    // Olayları sadece body'ye bir kere bağlıyoruz, bu daha verimli.
  
    document.body.addEventListener('click', async (e) => {
  const backtestBtn = e.target.closest('.run-dna-backtest-btn');
  const rerunBtn    = e.target.closest('#rerunBacktestBtn');
  const refreshBtn  = e.target.closest('#refreshDnaProfilesBtn');
  const toggleLink  = e.target.closest('.toggle-details-link');
  const deleteBtn   = e.target.closest('.delete-dna-btn');
      if (typeof window.applySettingsToUI !== 'function') {
  window.applySettingsToUI = function() { /* no-op */ };
}

if (typeof window.renderPortfolioTabs !== 'function') {
  window.renderPortfolioTabs = function() { /* no-op */ };
}

// YENİ: app.js içinde çağrılan renderAllPortfolioTabs yoksa, tekli olanı çalıştır
if (typeof window.renderAllPortfolioTabs !== 'function') {
  window.renderAllPortfolioTabs = function() {
    if (typeof window.renderPortfolioTabs === 'function') {
      window.renderPortfolioTabs(); // en azından temel sekmeleri çiz
    }
  };
}

  if (deleteBtn) {
    const pid = deleteBtn.dataset.profileId;
    const containerId = deleteBtn.dataset.containerId || 'dnaProfilesContainer';
    await deleteDnaProfile(pid, containerId);
    return; // <-- kritik
  }

  if (backtestBtn) {
    currentProfileId = backtestBtn.dataset.profileId;
    runTest();
    return;
  }

  if (rerunBtn && currentProfileId) {
    runTest();
    return;
  }

  if (refreshBtn) {
    fetchDnaProfiles('dnaProfilesContainer');
    return;
  }

  if (toggleLink) {
    e.preventDefault();
    const detailsContent = toggleLink.parentElement.nextElementSibling;
    if (detailsContent && detailsContent.classList.contains('dna-card-details-content')) {
      detailsContent.classList.toggle('open');
            }
        }
  
    });
    
    function runTest() {
        if (!currentProfileId) return;

        const backtestSection = document.getElementById('backtest-results-section');
        if (!backtestSection) return;

        backtestSection.style.display = 'block';
        document.getElementById('backtestProfileName').textContent = `Profil: ${currentProfileId}`;
        backtestSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        const scoreThreshold = parseInt(document.getElementById('backtestThreshold').value) || 80;
        const debugMode = document.getElementById('backtestDebugMode').checked;
        
        runDnaBacktest(currentProfileId, 30, scoreThreshold, debugMode);
    }
}
// Timeframe → dakika
function tfToMinutes(tf) {
    const map = { '15m': 15, '1h': 60, '4h': 240, '1d': 1440 };
    return map[tf] || 60;
}
// Preset → mum sayısı
function presetToCandles(preset, timeframe) {
    const m = tfToMinutes(timeframe);
    if (preset === '1h') return Math.ceil(60 / m);
    if (preset === '4h') return Math.ceil(240 / m);
    if (preset === '1d') return Math.ceil(1440 / m);
    return 0;
}

// Akıllı öneri: ATR% tabanlı, coin listesinden ilk geçerli coin ile hesap
async function computeSmartDiscoveryHints({ timeframe, days }) {
    try {
        const samplePair = (state.discoveryCoins && state.discoveryCoins[0]) || 'BTCUSDT';
        const limit = Math.min(500, Math.max(100, Math.ceil((days || 30) * (1440 / tfToMinutes(timeframe)) )));
        const klines = await getKlines(samplePair, timeframe, limit);
        if (!klines || klines.length < 30) return null;

        // ATR% ~ basit yaklaşım
        const closes = klines.map(k => Number(k[4]));
        let trs = [];
        for (let i=1;i<klines.length;i++){
            const high = Number(klines[i][2]);
            const low  = Number(klines[i][3]);
            const pc   = Number(klines[i-1][4]);
            const tr = Math.max(high - low, Math.abs(high - pc), Math.abs(low - pc));
            trs.push(tr);
        }
        const N = 14;
        const atr = average(trs.slice(-N));
        const lastC = closes[closes.length - 1] || 0;
        const atrPct = lastC>0 ? (atr/lastC)*100 : 0;

        // Heuristik:
        // oynaklık ↑ → lookback ↓ ; oynaklık ↓ → lookback ↑
        // sınırlar: 2..12
        let lookback = Math.round(clamp( (-1.8 * atrPct + 9), 1, 9 )); // Min 1, Max 9
        // lookahead: düşük oynaklıkta daha uzun
        // sınırlar: 2..Math.ceil(1 gün)
        const maxOneDay = Math.ceil(1440 / tfToMinutes(timeframe));
        let lookahead = Math.round(clamp( (0.6* (10/Math.max(atrPct,0.5)) + 3), 2, maxOneDay ));

        return { atrPct: Number(atrPct.toFixed(2)), lookback, lookahead, samplePair };
    } catch(e){
        console.warn('computeSmartDiscoveryHints hata:', e);
        return null;
    }

    function average(arr){ return arr.reduce((a,b)=>a+b,0)/Math.max(1,arr.length); }
    function clamp(x,min,max){ return Math.max(min, Math.min(max, x)); }
}

function updateSmartBadges(smart){
  // DNA Mumu (Geçmiş) önerisini gösterme
  const lookbackHintText = document.getElementById('lookbackHintText');
  if (lookbackHintText) {
    if (smart && smart.lookback) {
      lookbackHintText.textContent = `(Öneri: ${smart.lookback} mum)`;
      lookbackHintText.title = `ATR Volatilitesi: ${smart.atrPct}%`; // Tooltip ekleyelim
    } else {
      lookbackHintText.textContent = '';
      lookbackHintText.title = '';
    }
  }

  // Gelecek Penceresi (Hedef) önerisini gösterme
  const lookaheadSelect = document.getElementById('fixedLookaheadPreset');
  const autoOption = lookaheadSelect ? lookaheadSelect.querySelector('option[value="auto"]') : null;
  const lookaheadHintText = document.getElementById('lookaheadHintText'); // Yeni span

  if (autoOption && lookaheadHintText) {
    if (smart && smart.lookahead && lookaheadSelect.value === 'auto') {
      lookaheadHintText.textContent = `(Öneri: ${smart.lookahead} mum)`;
    } else {
      lookaheadHintText.textContent = '';
    }
  }
}

/* === window'a sabitleme (global export) === */
(() => {
  if (typeof window === 'undefined') return;
  try {
    if (typeof setupGlobalEventListeners === 'function')
      window.setupGlobalEventListeners = window.setupGlobalEventListeners || setupGlobalEventListeners;
    if (typeof setupAuthEventListeners === 'function')
      window.setupAuthEventListeners = window.setupAuthEventListeners || setupAuthEventListeners;
    if (typeof setupTrackerPageEventListeners === 'function')
      window.setupTrackerPageEventListeners = window.setupTrackerPageEventListeners || setupTrackerPageEventListeners;
    if (typeof setupTabEventListeners === 'function')
      window.setupTabEventListeners = window.setupTabEventListeners || setupTabEventListeners;
    if (typeof setupPanelEventListeners === 'function')
      window.setupPanelEventListeners = window.setupPanelEventListeners || setupPanelEventListeners;
    if (typeof setupActionEventListeners === 'function')
      window.setupActionEventListeners = window.setupActionEventListeners || setupActionEventListeners;
    if (typeof setupReportEventListeners === 'function')
      window.setupReportEventListeners = window.setupReportEventListeners || setupReportEventListeners;
    if (typeof setupCoinManagerEventListeners === 'function')
      window.setupCoinManagerEventListeners = window.setupCoinManagerEventListeners || setupCoinManagerEventListeners;
    if (typeof setupAiPageActionListeners === 'function')
      window.setupAiPageActionListeners = window.setupAiPageActionListeners || setupAiPageActionListeners;
    if (typeof setupStrategyDiscoveryListeners === 'function')
      window.setupStrategyDiscoveryListeners = window.setupStrategyDiscoveryListeners || setupStrategyDiscoveryListeners;
    if (typeof setupPivotPageActionListeners === 'function')
      window.setupPivotPageActionListeners = window.setupPivotPageActionListeners || setupPivotPageActionListeners;
    if (typeof setupScannerEventListeners === 'function')
      window.setupScannerEventListeners = window.setupScannerEventListeners || setupScannerEventListeners;
    if (typeof setupSaveSettingsButtonListener === 'function')
      window.setupSaveSettingsButtonListener = window.setupSaveSettingsButtonListener || setupSaveSettingsButtonListener;
    if (typeof setupUpdateAnalysisButtonListener === 'function')
      window.setupUpdateAnalysisButtonListener = window.setupUpdateAnalysisButtonListener || setupUpdateAnalysisButtonListener;
    if (typeof setupBacktestPageEventListeners === 'function')
      window.setupBacktestPageEventListeners = window.setupBacktestPageEventListeners || setupBacktestPageEventListeners;
  } catch (e) {
    console.warn('Global export hatası:', e);
  }
})();
