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
  parentElement.addEventListener('click', async (e) => {
    const target = e.target;

    // 1) STRATEJİYİ ANALİZ ET
    if (target.closest('#runSignalAnalysisBtn')) {
      const btn = target.closest('#runSignalAnalysisBtn');
      showLoading(btn);

      const timeframe = document.getElementById('signalAnalysisTimeframe').value;
      const days = parseInt(document.getElementById('signalAnalysisPeriod').value);
      const changePercent = parseFloat(document.getElementById('signalAnalysisChange').value);
      const direction = document.getElementById('signalAnalysisDirection').value;
      const useSmartLookback = document.getElementById('useSmartLookback').checked;

      // 1) DNA parametreleri
      const dnaParams = {};
      document.querySelectorAll('#signalDnaParamsGrid input[type="checkbox"]:checked').forEach(cb => {
        dnaParams[cb.dataset.param] = true;
      });

      // 2) Lookback (akıllıysa hesapla)
      let lookbackCandles = parseInt(document.getElementById('signalLookbackCandles').value) || 3;
      // 3) Lookahead seçimleri
      const fixedPreset = document.getElementById('fixedLookaheadPreset').value; // auto/1h/4h/1d
      const customLookaheadCandles = parseInt(document.getElementById('customLookaheadCandles').value) || 0;

      computeSmartDiscoveryHints({ timeframe, days })
        .then(smart => {
          if (useSmartLookback && smart?.lookback) {
            lookbackCandles = smart.lookback;
            document.getElementById('signalLookbackCandles').value = lookbackCandles;
          }
          // lookahead: öncelik -> custom > preset > smart
          let lookaheadCandles = 0;
          if (customLookaheadCandles > 0) {
            lookaheadCandles = customLookaheadCandles;
          } else if (fixedPreset !== 'auto') {
            lookaheadCandles = presetToCandles(fixedPreset, timeframe);
          } else if (smart?.lookahead) {
            lookaheadCandles = smart.lookahead;
          }
          // rozetleri güncelle
          updateSmartBadges(smart);

          const params = {
            coins: state.discoveryCoins,
            timeframe,
            changePercent,
            direction,
            days,
            lookbackCandles,
            lookaheadCandles,
            lookaheadMode: (customLookaheadCandles > 0 ? 'custom' : (fixedPreset !== 'auto' ? fixedPreset : 'smart')),
            params: dnaParams,
            isPreview: true
          };

          console.log('Sunucuya gönderilen analiz parametreleri:', params);

          // Görünürlük
          document.getElementById('discoverySettingsPanel').style.display = 'none';
          document.getElementById('discoveryResultsPanel').style.display = 'block';

          if (typeof runSignalAnalysisPreview !== 'function') {
            console.error('runSignalAnalysisPreview bulunamadı.');
            showNotification('Analiz fonksiyonu yüklenemedi. Lütfen sayfayı tazeleyin.', false);
            // geri al
            document.getElementById('discoverySettingsPanel').style.display = 'block';
            document.getElementById('discoveryResultsPanel').style.display = 'none';
            return Promise.resolve(); // zinciri bozmamak için
          }

          return runSignalAnalysisPreview(params);
        })
        .catch(err => {
          console.error('Analiz hatası:', err);
          showNotification('Analiz sırasında hata oluştu.', false);
          document.getElementById('discoverySettingsPanel').style.display = 'block';
          document.getElementById('discoveryResultsPanel').style.display = 'none';
        })
        .finally(() => { hideLoading(btn); });

      return; // ✅ bu if bloğu burada KAPANIYOR
    } // <-- ✅ runSignalAnalysisBtn if'i burada bitti

    // 2) AYARLARA GERİ DÖN
    if (target.closest('#backToSettingsBtn')) {
      document.getElementById('discoverySettingsPanel').style.display = 'block';
      document.getElementById('discoveryResultsPanel').style.display = 'none';
      return;
    }

    // 3) DNA PROFİL KAYDET
    const saveBtn = target.closest('.save-dna-btn');
    if (saveBtn) {
      const profileData = JSON.parse(saveBtn.dataset.profile);
      await saveDnaProfile(profileData, saveBtn);
      return;
    }

    // 4) DNA PROFİLLERİ YENİLE
    if (target.closest('#refreshDnaProfilesBtnDiscovery')) {
      await fetchDnaProfiles('dnaProfilesContainerDiscovery');
      return;
    }

    // 5) DNA PROFİL SİL
    const deleteBtn = e.target.closest('.delete-dna-btn');
    if (deleteBtn) {
      const profileId = deleteBtn.dataset.profileId;
      const containerId = deleteBtn.closest('.collapsible-content').id;
      await deleteDnaProfile(profileId, containerId);
      return;
    }
  }); // <-- addEventListener burada doğru şekilde kapanıyor
} // <-- setupStrategyDiscoveryListeners fonksiyonu burada doğru şekilde kapanıyor


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
        const rerunBtn = e.target.closest('#rerunBacktestBtn');
        const refreshBtn = e.target.closest('#refreshDnaProfilesBtn');
        const toggleLink = e.target.closest('.toggle-details-link');
        
        if (backtestBtn) {
            currentProfileId = backtestBtn.dataset.profileId;
            runTest();
        }

        if (rerunBtn && currentProfileId) {
            runTest();
        }

        if (refreshBtn) {
            fetchDnaProfiles('dnaProfilesContainer');
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
        let lookback = Math.round(clamp( (-0.7*atrPct + 10), 2, 12 ));
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
    const lb = document.getElementById('smartLookbackBadge');
    const la = document.getElementById('smartLookaheadBadge');
    if (smart && lb) lb.textContent = `Öneri: ${smart.lookback} mum (ATR% ${smart.atrPct})`;
    if (smart && la) la.textContent = `Öneri: ${smart.lookahead} mum`;
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
