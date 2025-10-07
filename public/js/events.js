// ---- GLOBAL ÇATI ----
window.App = window.App || { version: 'v3.0.0', loaded: {}, guards: {}, log: (...args) => console.log('[App]', ...args) };

// ---- FALLBACK FONKSİYONLAR ----
if (typeof window.showLoading !== 'function') { window.showLoading = function (button) { if (!button) return; button.dataset.originalHtml = button.innerHTML; button.innerHTML = '<div class="loading"></div>'; button.disabled = true; }; }
if (typeof window.hideLoading !== 'function') { window.hideLoading = function (button) { if (!button) return; if (button.dataset.originalHtml) { button.innerHTML = button.dataset.originalHtml; } button.disabled = false; }; }
if (typeof window.applySettingsToUI !== 'function') { window.applySettingsToUI = function () { window.App?.log?.('applySettingsToUI (fallback) çağrıldı.'); }; }
if (typeof window.createCoinManager !== 'function') { window.createCoinManager = function () { /* no-op */ }; }
if (typeof window.updateAllTableRows !== 'function') { window.updateAllTableRows = function() {}; }
if (typeof window.renderDictionary !== 'function') { window.renderDictionary = function() { /* no-op */ }; }
if (typeof window.renderIndicatorFilters !== 'function') { window.renderIndicatorFilters = function() { /* no-op */ }; }
if (typeof window.renderSupportResistance !== 'function') { window.renderSupportResistance = function() {}; }

// ===================================================================================
// TEMEL OLAY DİNLEYİCİLERİ (HER SAYFADA ÇALIŞIR)
// ===================================================================================

function setupGlobalEventListeners() {
  document.body.addEventListener('click', async (e) => {
    // Panel kapatma
    if (e.target.closest('.close-btn') || e.target.closest('.panel-close') || e.target === document.getElementById('modalOverlay')) {
      const chartPanel = document.getElementById('chartPanel');
      if (chartPanel && chartPanel.classList.contains('show')) {
        const titleEl = document.getElementById('chartPanelTitle');
        const pairFromTitle = titleEl?.textContent?.trim();
        const pair = pairFromTitle ? `${pairFromTitle}USDT` : null;
        if (pair) {
          await saveChartState(pair);
        }
      }
      closeAllPanels();
      return;
    }

    // Ayarlar panelini açma
    if (e.target.closest('#settingsBtn') || e.target.closest('[data-open-panel="settingsPanel"]')) {
      e.preventDefault();
      showPanel('settingsPanel');
      return;
    }

    // Genel panel açıcı
    const opener = e.target.closest('[data-open-panel]');
    if (opener) {
      const panelId = opener.getAttribute('data-open-panel');
      if (panelId) showPanel(panelId);
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

// ===================================================================================
// GENEL AMAÇLI VE SAYFA YÖNLENDİRİCİ DİNLEYİCİLER
// ===================================================================================

function setupTrackerPageEventListeners() {
    const trackerPageEl = document.getElementById('tracker-page');
    if (!trackerPageEl) return;

    setupTabEventListeners(trackerPageEl);
    setupPanelEventListeners(trackerPageEl);
    setupActionEventListeners(trackerPageEl);
    setupCoinManagerEventListeners(trackerPageEl);
    setupReportEventListeners(trackerPageEl);
    setupStrategyDiscoveryListeners(trackerPageEl);
    setupBacktestPageEventListeners();
}

function setupTabEventListeners(parentElement) {
    const currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
    const navLinks = document.querySelectorAll('#main-nav .tab-link');
    
    navLinks.forEach(link => {
        const linkPage = link.dataset.page;
        link.classList.toggle('active', linkPage === currentPage);
    });

    if (currentPage === 'sinyal-performans' && typeof loadAlarmReports === 'function') {
      loadAlarmReports();
    }
}

function setupPanelEventListeners(parentElement) {
  parentElement.addEventListener('click', async (e) => {
    // AYARLARI KAYDET BUTONU (MERKEZİ VE DOĞRU)
    if (e.target.closest('#saveSettingsBtn')) {
      e.preventDefault();
      saveSettings(); // app.js'teki ana fonksiyonu çağırır
      return;
    }

    // TELEGRAM TEST BUTONU (MERKEZİ VE DOĞRU)
    if (e.target.closest('#sendTelegramTestBtn')) {
      e.preventDefault();
      try {
        const input = document.getElementById('telegramChatIdInput');
        const chatId = (input?.value || '').trim();
        if (!chatId) {
          showNotification('Lütfen "Telegram Chat ID" alanına bir sayı girin.', false);
          return;
        }
        const callSendTest = state.firebase.functions.httpsCallable('sendTestNotification');
        await callSendTest({ chatId, text: '✅ Telegram test: Merhaba!' });
        showNotification('Test mesajı gönderildi.', true);
      } catch (error) {
        console.error('Telegram test gönderilemedi:', error);
        showNotification('Telegram test gönderimi başarısız. Konsolu kontrol edin.', false);
      }
      return;
    }

    // PORTFÖY KAYDET BUTONU
    if (e.target.closest('#savePortfolioBtn')) {
      handlePortfolioSave();
      return;
    }

    // AÇILIR/KAPANIR BAŞLIKLAR
    const collapsibleHeader = e.target.closest('.collapsible-header');
    if (collapsibleHeader) {
      const content = collapsibleHeader.nextElementSibling;
      if(content) {
        collapsibleHeader.classList.toggle('open');
        content.classList.toggle('open');
      }
      return;
    }
  });
}

function setupActionEventListeners(parentElement) {
    parentElement.addEventListener('click', async (e) => {
        const target = e.target;

        // Çıkış Yap
        if (target.closest('#logoutBtn')) {
            e.preventDefault();
            try { await state.firebase?.auth?.signOut(); } catch (err) { console.error('Çıkış hatası:', err); }
            return;
        }

        // Portföy Modalı
        if (target.closest('#newPortfolioBtn') || target.closest('#renamePortfolioBtn')) {
            const action = target.closest('#renamePortfolioBtn') ? 'rename' : 'new';
            showPortfolioModal(action);
            return;
        }
        if (target.closest('#deletePortfolioBtn')) {
            handleDeletePortfolio();
            return;
        }
        
        // Tablo Sıralama
        const sortableHeader = target.closest('#crypto-content th.sortable');
        if (sortableHeader) {
            const key = sortableHeader.dataset.sortKey;
            if (state.currentSort.key !== key) {
                state.currentSort.key = key;
                state.currentSort.order = 'asc';
            } else {
                state.currentSort.order = state.currentSort.order === 'asc' ? 'desc' : 'default';
                if (state.currentSort.order === 'default') state.currentSort.key = null;
            }
            sortAndRenderTable();
            return;
        }
    });
}

function setupCoinManagerEventListeners(parentElement) {
    parentElement.addEventListener('click', (e) => {
        const addBtn = e.target.closest('.add-coin-btn');
        if (addBtn) { 
            handleAddCoin(addBtn.dataset.listName); 
            return; 
        }
        const removeBtn = e.target.closest('.remove-coin-tag, .remove-btn');
        if (removeBtn) { 
            handleRemoveCoin(removeBtn.dataset.listName, removeBtn.dataset.pair); 
            return; 
        }
    });
    parentElement.addEventListener('keypress', (e) => {
        const input = e.target.closest('.new-coin-input');
        if (input && e.key === 'Enter') { 
            handleAddCoin(input.dataset.listName); 
        }
    });
}

// ===================================================================================
// SAYFAYA ÖZEL OLAY DİNLEYİCİLERİ
// ===================================================================================

function setupReportEventListeners(parentElement) {
    parentElement.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.closest('#autoRefreshReportsToggle')) { 
            toggleReportsAutoRefresh(); 
            return; 
        }
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

function setupStrategyDiscoveryListeners(parentElement) {
    const updateHintsOnTheFly = async () => {
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
                document.querySelectorAll('#signalDnaParamsGrid input[type="checkbox"]:checked').forEach(cb => { dnaParams[cb.dataset.param] = true; });
                const useAutoDna = document.getElementById('useAutoDna')?.checked;
                let lookbackCandles = parseInt(document.getElementById('signalLookbackCandles').value) || 9;
                const lookaheadModeSelect = document.getElementById('fixedLookaheadPreset')?.value || 'auto';
                const customLookaheadCandles = parseInt(document.getElementById('customLookaheadCandles')?.value) || 0;
                
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

                const successWindowMinutes = Number(lookaheadFinalCandles) * tfToMinutes(timeframe);
                const params = {
                  coins: state.discoveryCoins,
                  timeframe, changePercent, direction, days,
                  lookbackCandles: Number(lookbackCandles),
                  lookaheadCandles: Number(lookaheadFinalCandles),
                  lookaheadMode: finalMode,
                  successWindowMinutes,
                  params: dnaParams,
                  auto: !!useAutoDna
                };
                if (params.auto) { delete params.featureOrder; }
              
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

    updateHintsOnTheFly();
}

function setupBacktestPageEventListeners() {
    let currentProfileId = null; 
  
    document.body.addEventListener('click', async (e) => {
        const backtestBtn = e.target.closest('.run-dna-backtest-btn');
        const rerunBtn = e.target.closest('#rerunBacktestBtn');
        const refreshBtn = e.target.closest('#refreshDnaProfilesBtn');
        const toggleLink = e.target.closest('.toggle-details-link');
        const deleteBtn = e.target.closest('.delete-dna-btn');

        if (deleteBtn) {
            const pid = deleteBtn.dataset.profileId;
            const containerId = deleteBtn.dataset.containerId || 'dnaProfilesContainer';
            await deleteDnaProfile(pid, containerId);
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

// ===================================================================================
// YARDIMCI FONKSİYONLAR VE GLOBAL EXPORT
// ===================================================================================

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

/* === window'a sabitleme (global export) === */
(() => {
    if (typeof window === 'undefined') return;
    try {
        window.setupGlobalEventListeners = setupGlobalEventListeners;
        window.setupAuthEventListeners = setupAuthEventListeners;
        window.setupTrackerPageEventListeners = setupTrackerPageEventListeners;
        window.setupTabEventListeners = setupTabEventListeners;
        window.setupPanelEventListeners = setupPanelEventListeners;
        window.setupActionEventListeners = setupActionEventListeners;
        window.setupReportEventListeners = setupReportEventListeners;
        window.setupCoinManagerEventListeners = setupCoinManagerEventListeners;
        window.setupStrategyDiscoveryListeners = setupStrategyDiscoveryListeners;
        window.setupBacktestPageEventListeners = setupBacktestPageEventListeners;
    } catch (e) {
        console.warn('Global export hatası:', e);
    }
})();
