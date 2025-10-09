// ---- GLOBAL ÇATI ----
window.App = window.App || { version: 'v3.0.0', loaded: {}, guards: {}, log: (...args) => console.log('[App]', ...args) };

// ===================================================================================
// BÖLÜM 1: GİRİŞ SAYFASI İÇİN OLAY DİNLEYİCİLERİ
// ===================================================================================
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
            if (typeof showLoading === 'function') showLoading(loginBtn);
            try {
                await state.firebase.auth.signInWithEmailAndPassword(email, password);
                if (errorMessageDiv) errorMessageDiv.textContent = '';
            } catch (error) {
                if (errorMessageDiv) errorMessageDiv.textContent = `Giriş yapılamadı: ${error.message}`;
            } finally {
                if (typeof hideLoading === 'function') hideLoading(loginBtn);
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
            if (typeof showLoading === 'function') showLoading(signupBtn);
            try {
                await state.firebase.auth.createUserWithEmailAndPassword(email, password);
                if (errorMessageDiv) errorMessageDiv.textContent = '';
            } catch (error) {
                if (errorMessageDiv) errorMessageDiv.textContent = `Kayıt olunamadı: ${error.message}`;
            } finally {
                if (typeof hideLoading === 'function') hideLoading(signupBtn);
            }
        });
    }
}

// ===================================================================================
// BÖLÜM 2: ANA UYGULAMA İÇİN OLAY DİNLEYİCİLERİ
// ===================================================================================

function initializeEventListeners() {
    setupSharedEventListeners();
    setupPageSpecificEventListeners();
}

function setupGlobalEventListeners() {
    // Bu fonksiyon app.js tarafından çağrılır ve gelecekteki genel olaylar için bir yer tutucudur.
    console.log("Global event listeners setup.");
}

function setupSharedEventListeners() {
   document.body.addEventListener('click', async (e) => {
        if (e.target.closest('#refreshBtn')) { if (typeof fetchAllDataAndRender === 'function') fetchAllDataAndRender(); }
        if (e.target.closest('#settingsBtn')) { if (typeof togglePanel === 'function') togglePanel('settingsPanel'); }
        if (e.target.closest('.panel .close-btn') || e.target.id === 'modalOverlay') { if (typeof closeAllPanels === 'function') closeAllPanels(); }
        if (e.target.closest('#logoutBtn')) { state.firebase?.auth?.signOut(); }
        // --- DEĞİŞİKLİK BURADA ---
        if (e.target.closest('#saveChartStateBtn')) {
            if (state.activeChartPair && typeof saveChartState === 'function') {
                try {
                    // saveChartState'in bitmesini bekle (await)
                    await saveChartState(state.activeChartPair);
                    // Sadece işlem başarılı olursa bildirimi göster
                    showNotification('Grafik durumu başarıyla kaydedildi.', true);
                } catch (error) {
                    showNotification(`Grafik kaydedilemedi: ${error.message}`, false);
                }
            }
        }
        if (e.target.closest('#newPortfolioBtn')) { if (typeof showPortfolioModal === 'function') showPortfolioModal('new'); }
        if (e.target.closest('#renamePortfolioBtn')) { if (typeof showPortfolioModal === 'function') showPortfolioModal('rename'); }
        if (e.target.closest('#deletePortfolioBtn')) { if (typeof handleDeletePortfolio === 'function') handleDeletePortfolio(); }
        if (e.target.closest('#savePortfolioBtn')) { if (typeof handlePortfolioSave === 'function') handlePortfolioSave(); }
        
        const collapsibleHeader = e.target.closest('.collapsible-header');
        if (collapsibleHeader) {
            const content = collapsibleHeader.nextElementSibling;
            if (content) {
                collapsibleHeader.classList.toggle('open');
                content.classList.toggle('open');
            }
        }
    });

    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsPanel) {
        settingsPanel.querySelector('#saveSettingsBtn')?.addEventListener('click', saveSettings);
        settingsPanel.querySelector('#sendTelegramTestBtn')?.addEventListener('click', sendTestTelegramMessage);
    }
    
    const portfolioTabs = document.getElementById('portfolioTabs');
    if(portfolioTabs){
        portfolioTabs.addEventListener('click', (e) => {
            const tab = e.target.closest('.portfolio-tab');
            if (tab && !tab.classList.contains('active')) {
                if (typeof setActivePortfolio === 'function') setActivePortfolio(tab.dataset.name);
            }
        });
    }
}

function setupPageSpecificEventListeners() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    if (currentPage === 'index.html' || currentPage === '') {
        setupCryptoPageListeners();
    } else if (currentPage === 'strateji.html') {
        setupStrategyDiscoveryListeners(document.body);
    } else if (currentPage === 'backtest.html') {
        setupBacktestPageEventListeners();
    } else if (currentPage === 'sinyal-performans.html') {
        setupReportEventListeners(document.body);
    }
}

function setupCryptoPageListeners() {
    const parentElement = document.getElementById('tracker-page');
    if (!parentElement) return;

    parentElement.addEventListener('click', (e) => {
        const pctCell = e.target.closest('.clickable-pct');
        if (pctCell) {
            if (typeof showPriceDetailPopup === 'function') showPriceDetailPopup(pctCell.dataset.pair, pctCell.dataset.col);
            return;
        }
        const assetCell = e.target.closest('.asset-cell');
        if (assetCell) {
            state.activeChartPair = assetCell.dataset.pair;
            if (typeof showChart === 'function') showChart(state.activeChartPair);
            return;
        }
        if (e.target.closest('#toggleSortBtn')) {
            if (typeof toggleSortable === 'function') toggleSortable();
            return;
        }
        const addBtn = e.target.closest('.add-coin-btn');
        if (addBtn) {
            if (typeof handleAddCoin === 'function') handleAddCoin(addBtn.dataset.listName);
        }
        const removeBtn = e.target.closest('.remove-coin-tag, .remove-btn');
        if (removeBtn) {
            if (typeof handleRemoveCoin === 'function') handleRemoveCoin(removeBtn.dataset.listName, removeBtn.dataset.pair);
        }
    });

    parentElement.addEventListener('keypress', (e) => {
        if (e.target.closest('.new-coin-input') && e.key === 'Enter') {
            if (typeof handleAddCoin === 'function') handleAddCoin(e.target.dataset.listName);
        }
    });

    const cryptoContent = parentElement.querySelector('#crypto-content');
    if (cryptoContent) {
        cryptoContent.addEventListener('click', (e) => {
            const sortableHeader = e.target.closest('th.sortable');
            if (sortableHeader) {
                const key = sortableHeader.dataset.sortKey;
                if (state.currentSort.key !== key) {
                    state.currentSort.key = key;
                    state.currentSort.order = 'asc';
                } else {
                    state.currentSort.order = state.currentSort.order === 'asc' ? 'desc' : 'default';
                }
                if (state.currentSort.order === 'default') state.currentSort.key = null;
                if (typeof sortAndRenderTable === 'function') sortAndRenderTable();
            }
        });
    }
}

function setupReportEventListeners(parentElement) {
    parentElement.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.closest('#autoRefreshReportsToggle')) { 
            if (typeof toggleReportsAutoRefresh === 'function') toggleReportsAutoRefresh(); 
            return; 
        }
        if (target.closest('.remove-report-btn')) {
            const reportIdToRemove = target.closest('.remove-report-btn').dataset.reportId;
            state.trackedReports = state.trackedReports.filter(id => id !== reportIdToRemove);
            state.settings.trackedReportIds = state.trackedReports;
            await state.userDocRef.update({ 'settings.trackedReportIds': state.trackedReports });
            if(typeof renderAlarmReports === 'function') await renderAlarmReports();
            return;
        }
    });
    const reportIdInput = document.getElementById('reportIdInput');
    if (reportIdInput) {
        reportIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const reportId = e.target.value.trim();
                if (reportId && typeof addReportToTrack === 'function') addReportToTrack(reportId);
                e.target.value = '';
            }
        });
    }
}

function setupStrategyDiscoveryListeners(parentElement) {
    const updateHintsOnTheFly = async () => {
        if (typeof computeSmartDiscoveryHints !== 'function' || typeof updateSmartBadges !== 'function') return;
        const timeframe = document.getElementById('signalAnalysisTimeframe')?.value;
        const days = parseInt(document.getElementById('signalAnalysisPeriod')?.value);
        if (timeframe && days) {
            const smart = await computeSmartDiscoveryHints({ timeframe, days });
            updateSmartBadges(smart); 
            const useSmartLookback = document.getElementById('useSmartLookback')?.checked;
            if (useSmartLookback && smart?.lookback) {
                document.getElementById('signalLookbackCandles').value = smart.lookback;
            }
        } else {
            updateSmartBadges(null);
        }
    };

    const timeframeSelect = document.getElementById('signalAnalysisTimeframe');
    const periodSelect = document.getElementById('signalAnalysisPeriod');
    if (timeframeSelect) timeframeSelect.addEventListener('change', updateHintsOnTheFly);
    if (periodSelect) periodSelect.addEventListener('change', updateHintsOnTheFly);

    parentElement.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.matches('.show-all-opportunities-btn')) {
            const coinSymbol = target.dataset.coin;
            document.querySelectorAll(`.opportunity-row.hidden[data-coin="${coinSymbol}"]`).forEach(row => { row.classList.remove('hidden'); });
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
                const dnaParams = {};
                document.querySelectorAll('#signalDnaParamsGrid input[type="checkbox"]:checked').forEach(cb => { dnaParams[cb.dataset.param] = true; });
                const useAutoDna = document.getElementById('useAutoDna')?.checked;
                let lookbackCandles = parseInt(document.getElementById('signalLookbackCandles').value) || 9;
                
                const params = {
                  coins: state.discoveryCoins,
                  timeframe, changePercent, direction, days,
                  lookbackCandles: Number(lookbackCandles),
                  params: dnaParams,
                  auto: !!useAutoDna
                };
              
                if (typeof runSignalAnalysisPreviewRemote === 'function') {
                    await runSignalAnalysisPreviewRemote(params);
                }
            } catch (err) {
                console.error('Analiz hatası:', err);
            } finally {
                hideLoading(btn);
            }
            return;
        }
       const saveBtn = target.closest('.save-dna-btn');
        if (saveBtn) {
          const profileData = JSON.parse(saveBtn.dataset.profile || '{}');
          if (typeof saveDnaProfile === 'function') await saveDnaProfile(profileData, saveBtn);
          return;
        }
    });
    updateHintsOnTheFly();
}

function setupBacktestPageEventListeners() {
    let currentProfileId = null; 
    
    document.body.addEventListener('click', async (e) => {
        const backtestBtn = e.target.closest('.run-dna-backtest-btn');
        const rerunBtn = e.target.closest('#rerunBacktestBtn');
        const refreshBtn = e.target.closest('#refreshDnaProfilesBtn');
        const deleteBtn = e.target.closest('.delete-dna-btn');

        if (deleteBtn) {
            const pid = deleteBtn.dataset.profileId;
            const containerId = deleteBtn.dataset.containerId || 'dnaProfilesContainer';
            if(typeof deleteDnaProfile === 'function') await deleteDnaProfile(pid, containerId);
            return;
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
            if(typeof fetchDnaProfiles === 'function') fetchDnaProfiles('dnaProfilesContainer');
            return;
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
        if(typeof runDnaBacktest === 'function') runDnaBacktest(currentProfileId, 30, scoreThreshold, debugMode);
    }
}

function tfToMinutes(tf) {
    const map = { '15m': 15, '1h': 60, '4h': 240, '1d': 1440 };
    return map[tf] || 60;
}

function presetToCandles(preset, timeframe) {
    const m = tfToMinutes(timeframe);
    if (preset === '1h') return Math.ceil(60 / m);
    if (preset === '4h') return Math.ceil(240 / m);
    if (preset === '1d') return Math.ceil(1440 / m);
    return 0;
}

async function computeSmartDiscoveryHints({ timeframe, days }) {
  try {
    const samplePair = (state.discoveryCoins && state.discoveryCoins[0]) || 'BTCUSDT';
    const limit = Math.min(500, Math.max(150, Math.ceil((days || 30) * (1440 / tfToMinutes(timeframe)))));
    if(typeof getKlines !== 'function') return null;
    const klines = await getKlines(samplePair, timeframe, limit);
    if (!klines || klines.length < 60) return null;

    const closes = klines.map(k => Number(k[4]));
    const trs = [];
    for (let i=1;i<klines.length;i++){
      const high = Number(klines[i][2]);
      const low  = Number(klines[i][3]);
      const pc   = Number(klines[i-1][4]);
      const tr = Math.max(high - low, Math.abs(high - pc), Math.abs(low - pc));
      trs.push(tr);
    }
    const N = 14;
    const atr = trs.slice(-N).reduce((a, b) => a + b, 0) / Math.max(1, N);
    const lastC = closes[closes.length - 1] || 0;
    const atrPct = lastC > 0 ? (atr / lastC) * 100 : 0;
    const lookback = Math.round(Math.max(1, Math.min(9, (-1.8 * atrPct + 9))));

    const candidates = [8, 10, 12, 14, 16];
    let best = 12, bestVal = -Infinity;
    for (const w of candidates) {
      let sum = 0, cnt = 0;
      for (let i = 50; i < klines.length - (w + 1); i++) {
        const entry = Number(klines[i][4]);
        if (!Number.isFinite(entry) || entry <= 0) continue;
        const slice = klines.slice(i + 1, i + 1 + w);
        const highs = slice.map(k => Number(k[2]));
        const up = ((Math.max(...highs) - entry) / entry) * 100;
        if (Number.isFinite(up)) { sum += up; cnt++; }
      }
      const v = cnt ? (sum / cnt) : -Infinity;
      if (v > bestVal) { bestVal = v; best = w; }
    }
    const maxOneDay = Math.ceil(1440 / tfToMinutes(timeframe));
    const lookahead = Math.max(2, Math.min(maxOneDay, best));

    return { atrPct: Number(atrPct.toFixed(2)), lookback, lookahead, samplePair };
  } catch (e) {
    console.warn('computeSmartDiscoveryHints hata:', e);
    return null;
  }
}

function updateSmartBadges(smart){
  const lookbackHintText = document.getElementById('lookbackHintText');
  if (lookbackHintText) {
    if (smart && smart.lookback) {
      lookbackHintText.textContent = `(Öneri: ${smart.lookback} mum)`;
      lookbackHintText.title = `ATR Volatilitesi: ${smart.atrPct}%`;
    } else {
      lookbackHintText.textContent = '';
      lookbackHintText.title = '';
    }
  }

  const lookaheadSelect = document.getElementById('fixedLookaheadPreset');
  const lookaheadHintText = document.getElementById('lookaheadHintText');
  if (lookaheadSelect && lookaheadHintText) {
    if (smart && smart.lookahead && lookaheadSelect.value === 'auto') {
      lookaheadHintText.textContent = `(Öneri: ${smart.lookahead} mum)`;
    } else {
      lookaheadHintText.textContent = '';
    }
  }
}
