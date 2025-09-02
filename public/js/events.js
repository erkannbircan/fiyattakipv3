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
    // 1) Panel kapat
    if (e.target.closest('.close-btn') || e.target === document.getElementById('modalOverlay')) {
      const chartPanel = document.getElementById('chartPanel');
      if (chartPanel && chartPanel.classList.contains('show')) {
        const widgetToSave = state.tradingViewWidget;
        await saveChartState(widgetToSave);
      }
      closeAllPanels();
      return;
    }

    // 2) Ayarlar aç (dişli buton ya da data-open-panel="settingsPanel")
    if (
      e.target.closest('#settingsBtn') ||                       // varsa id
      e.target.closest('.btn-settings') ||                      // varsa class
      e.target.closest('[data-open-panel="settingsPanel"]')     // data-attribute destek
    ) {
      e.preventDefault();
      showPanel('settingsPanel');
      return;
    }

    // 3) Genel panel açıcı: data-open-panel="panelId"
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
      if (currentPage === 'sinyal-performans') {
  loadAlarmReports();
        if (toggle && toggle.checked) {
            toggleAutoScanner(true);
            console.log("Canlı tarayıcı sayfasına girildi, otomatik tarama başlatıldı.");
        } else {
            updateScannerStatusUI('stopped');
        }
    }
}
}
  

function setupPanelEventListeners(parentElement) {
  // Tüm tıklamalar için TEK delegasyon dinleyicisi
  parentElement.addEventListener('click', (e) => {
    if (e.target.closest('#settingsBtn')) {
      showPanel('settingsPanel');
      return;
    }
    if (e.target.closest('#saveAlarmBtn')) {
      saveAlarm();
      return;
    }
    if (e.target.closest('#savePortfolioBtn')) {
      handlePortfolioSave();
      return;
    }
if (e.target.closest('#saveSettingsBtn')) {
  saveSettingsToFirestore();  // aşağıdaki küçük yardımcıyı ekliyoruz
  return;
}
function saveSettingsToFirestore() {
  if (!state.firebase?.firestore || !state.currentUserId) return;
  const db = state.firebase.firestore;
  const uid = state.currentUserId;

  const settings = {
    lang: document.getElementById('langSelect')?.value || 'tr',
    autoRefresh: !!document.getElementById('autoRefreshToggle')?.checked,
    refreshInterval: Number(document.getElementById('refreshInterval')?.value || 300),
    liveScannerInterval: Number(document.getElementById('liveScannerInterval')?.value || 5),
    telegramChatId: document.getElementById('telegramChatIdInput')?.value || '',
    columns: {
      1: {
        name: document.getElementById('col1_name_input')?.value || '10gün',
        days: Number(document.getElementById('col1_days_input')?.value || 10),
        threshold: Number(document.getElementById('col1_threshold_input')?.value || 5),
      },
      2: {
        name: document.getElementById('col2_name_input')?.value || '60gün',
        days: Number(document.getElementById('col2_days_input')?.value || 60),
        threshold: Number(document.getElementById('col2_threshold_input')?.value || 20),
      },
      3: {
        name: document.getElementById('col3_name_input')?.value || '365gün',
        days: Number(document.getElementById('col3_days_input')?.value || 365),
        threshold: Number(document.getElementById('col3_threshold_input')?.value || 50),
      }
    },
    colors: {
      high: document.getElementById('high_color_input')?.value || '#2bb0e9',
      low:  document.getElementById('low_color_input')?.value  || '#ff5b0f'
    }
  };

  db.collection('users').doc(uid).set({ settings }, { merge: true })
    .then(() => { applySettingsToUI(); showPanel(''); closeAllPanels(); })
    .catch(err => console.error('Ayar kaydet hata:', err));
}

    // Açılır/Kapanır başlıklar
    const collapsibleHeader = e.target.closest('.collapsible-header');
    if (collapsibleHeader) {
      const content = collapsibleHeader.nextElementSibling;
      if (content) {
        collapsibleHeader.classList.toggle('open');
        content.classList.toggle('open');
      }
      return;
    }
  });

  // Ayarlar butonuna ikincil (idempotent) dinleyici — iki kez eklenmesin
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn && !settingsBtn.dataset.listenerAttached) {
    settingsBtn.addEventListener('click', () => showPanel('settingsPanel'));
    settingsBtn.dataset.listenerAttached = 'true';
  }

  // Alarm panelindeki checkbox’lar: kutu kapatma/açma
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

// Sayfanın strateji keşfi alanındaki buton ve filtre dinleyicileri
// Strateji Keşfi butonu/filtreleri
function setupStrategyDiscoveryListeners() {
  const runBtn = document.getElementById('runSignalAnalysisBtn');
  if (!runBtn) return;

  runBtn.addEventListener('click', async () => {
    showLoading(runBtn);
    try {
      const coin  = (document.getElementById('strategySymbol')?.value || '').trim();
      const timeframe = (document.getElementById('strategyTimeframe')?.value || '1h').trim();
      const periodDays = Number(document.getElementById('periodDays')?.value || 30);
      const direction  = (document.getElementById('direction')?.value || 'up').trim();
      const changePercent = Number(document.getElementById('changePercent')?.value || 5);
      const lookbackCandles = Number(document.getElementById('lookbackCandles')?.value || 6);
      const successWindowMinutes = Number(document.getElementById('successWindowMinutes')?.value || 60);
      const lookaheadCandles = Number(document.getElementById('lookaheadCandles')?.value || 16);
      const lookaheadMode = (document.getElementById('lookaheadMode')?.value || 'smart').trim();
      const auto = !!document.getElementById('useAutoDna')?.checked;

      // Checkbox’lardan params
      const dnaParams = { rsi:false, macd:false, adx:false, volume:false, volatility:false, candle:false, velocity:false };
      document.querySelectorAll('#signalDnaParamsGrid input[type="checkbox"]').forEach(cb => {
        const k = cb.getAttribute('data-param');
        if (k) dnaParams[k] = !!cb.checked;
      });

      // Sadece auto=false ise featureOrder üret
      let featureOrder = [];
      if (!auto) {
        const map = {
          rsi: ['rsi_avg','rsi_slope','rsi_final','rsi_velocity_pct'],
          macd: ['macd_hist_avg','macd_hist_slope','macd_hist_final','macd_hist_velocity_pct'],
          adx: ['adx_avg','adx_slope','adx_final'],
          volume: ['volume_mult_avg','volume_mult_slope','volume_mult_final'],
          volatility: ['atr_pct_avg','atr_pct_slope','atr_pct_final','bb_width_avg','bb_width_slope','bb_width_final','rv_pct_avg','rv_pct_slope','rv_pct_final'],
          candle: ['candle_body_pct','candle_upper_shadow_pct','candle_lower_shadow_pct','candle_bullish'],
          velocity: []
        };
        Object.keys(dnaParams).forEach(k => { if (dnaParams[k]) featureOrder.push(...(map[k]||[])); });
      }

      // 🔴 Zorunlu alanlar backend’e her zaman gitsin
      const payload = {
        coin, timeframe, periodDays, direction,
        changePercent, lookbackCandles,
        successWindowMinutes, lookaheadCandles, lookaheadMode,
        params: dnaParams, auto,
        ...(auto ? {} : { featureOrder })
      };

      await runSignalAnalysisPreview(payload);
    } catch (err) {
      console.error('Analiz başlatılamadı:', err);
    } finally {
      hideLoading(runBtn); // buton metni geri gelsin
    }
  });
}
// bu fonksiyonu sayfa init’inde zaten çağırıyorsun:
setupStrategyDiscoveryListeners();



function setupActionEventListeners() {
    // Check if the page is fully loaded before attaching listeners
    if (document.readyState !== 'complete') {
        window.addEventListener('load', setupActionEventListeners);
        return;
    }
    const eventsTarget = document.getElementById('eventsTarget');
    if (!eventsTarget) {
        console.warn('eventsTarget elementi bulunamadi.');
        return;
    }
    
    eventsTarget.addEventListener('click', (e) => {
        const target = e.target;
        
        // --- Tablo Değişim Yüzdesi Tıklama Olayı (clickable-pct) ---
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

        // --- Kripto Tablosu Başlık Sıralama Olayı (sortable) ---
        const sortableHeader = target.closest('#crypto-content th.sortable');
        if (sortableHeader) {
            const key = sortableHeader.dataset.sortKey;
            if (state.currentSort.key !== key) {
                state.currentSort.key = key;
                state.currentSort.order = 'asc';
            } else {
                state.currentSort.order = state.currentSort.order === 'asc' ? 'desc' : 'default';
                if (state.currentSort.order === 'default') {
                    state.currentSort.key = null;
                }
            }
            sortAndRenderTable();
            return;
        }
        
        // --- Portföy Tablosu Başlık Sıralama Olayı (sortable) ---
        const portfolioSortableHeader = target.closest('#portfolio-content th.sortable');
        if (portfolioSortableHeader) {
            const key = portfolioSortableHeader.dataset.sortKey;
            if (state.currentPortfolioSort.key !== key) {
                state.currentPortfolioSort.key = key;
                state.currentPortfolioSort.order = 'asc';
            } else {
                state.currentPortfolioSort.order = state.currentPortfolioSort.order === 'asc' ? 'desc' : 'default';
                if (state.currentPortfolioSort.order === 'default') {
                    state.currentPortfolioSort.key = null;
                }
            }
            renderPortfolio();
            return;
        }

        // --- Giriş Yap/Çıkış Yap Butonu Olayı (loginBtn) ---
        const loginBtn = target.closest('#loginBtn');
        if (loginBtn) {
            e.preventDefault();
            const action = loginBtn.dataset.action;
            if (action === 'login') {
                showPanel('loginPanel');
            } else if (action === 'logout') {
                auth.signOut();
            }
            return;
        }

        // --- Portföy Görüntüleme Butonu (portfolioBtn) ---
        const portfolioBtn = target.closest('#portfolioBtn');
        if (portfolioBtn) {
            showPanel('portfolioModal');
            return;
        }

        // --- Alarm Ayarları Butonu (alarmsBtn) ---
        const alarmsBtn = target.closest('#alarmsBtn');
        if (alarmsBtn) {
            showPanel('alarmSettingsPanel');
            return;
        }

        // --- Geri Butonu (backBtn) ---
        const backBtn = target.closest('.back-btn');
        if (backBtn) {
            const panelId = backBtn.dataset.targetPanel;
            hidePanel(panelId);
            return;
        }
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

             const useAutoDna = document.getElementById('useAutoDna')?.checked;

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
    const limit = Math.min(500, Math.max(150, Math.ceil((days || 30) * (1440 / tfToMinutes(timeframe)))));
    const klines = await getKlines(samplePair, timeframe, limit);
    if (!klines || klines.length < 60) return null;

    // 1) ATR% (oynaklık ölçüsü)
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
    const atr = average(trs.slice(-N));
    const lastC = closes[closes.length - 1] || 0;
    const atrPct = lastC>0 ? (atr/lastC)*100 : 0;

    // 2) Lookback (geçmiş mum) – oynaklığa göre
    const lookback = Math.round(clamp((-1.8 * atrPct + 9), 1, 9));

    // 3) Lookahead oto-seçimi – {8,10,12,14,16} mum adaylarını küçük bir “MFE ortalama” testiyle kıyasla
    const candidates = [8, 10, 12, 14, 16];
    const mfeAvg = (win) => {
      let sum = 0, cnt = 0;
      for (let i = 50; i < klines.length - (win + 1); i++) {
        const entry = Number(klines[i][4]);
        if (!Number.isFinite(entry) || entry <= 0) continue;
        const slice = klines.slice(i + 1, i + 1 + win);
        const highs = slice.map(k => Number(k[2]));
        const lows  = slice.map(k => Number(k[3]));
        const up = ((Math.max(...highs) - entry) / entry) * 100; // yön bağımsız "potansiyel yukarı"
        if (Number.isFinite(up)) { sum += up; cnt++; }
      }
      return cnt ? (sum / cnt) : -Infinity;
    };
    let best = 12, bestVal = -Infinity;
    for (const w of candidates) {
      const v = mfeAvg(w);
      if (v > bestVal) { bestVal = v; best = w; }
    }
    const maxOneDay = Math.ceil(1440 / tfToMinutes(timeframe));
    const lookahead = clamp(best, 2, maxOneDay);

    return { atrPct: Number(atrPct.toFixed(2)), lookback, lookahead, samplePair };
  } catch (e) {
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
