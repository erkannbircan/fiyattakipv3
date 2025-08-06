
    document.addEventListener('DOMContentLoaded', () => {
        const firebaseConfig = {
            apiKey: "AIzaSyA3flTu3Jz9E1D1U_DympYE7B4I4FDxj88",
            authDomain: "fiyattakipv3.firebaseapp.com",
            projectId: "fiyattakipv3",
            storageBucket: "fiyattakipv3.firebasestorage.app",
            messagingSenderId: "440839843277",
            appId: "1:440839843277:web:2c9c15e4a103e8b2f2e884"
        };
        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.firestore();
        const functions = firebase.app().functions('europe-west1');

        // --- GLOBAL STATE ---
        const STRATEGY_PRESETS = {
            momentum: { rsi: true, stochRsi: true, macd: true, volume: true },
            trend: { ema: true, sma: true, ichimoku: true, macd: true },
            volatility: { bollinger: true, atr: true, volume: true },
            all: { rsi: true, macd: true, ema: true, bollinger: true, fibonacci: true },
            custom: {}
        };
        let currentUserRole = null, coinLimit = 10, settings = {}, autoRefreshTimer = null, pageInitialized = false;
        let allCryptoData = [], userAlarms = [];
        let currentSort = { key: null, order: 'default' };
        let userPortfolios = {}; 
        let activePortfolio = 'Varsayılan';
        let cryptoAiPairs = [];
        let userDocRef = null;
        let sortableInstance = null;
        let sortableInstanceAi = null;
        let currentRecommendationFilter = 'all';
        let tempAlarmCoins = [];
        const notification = document.getElementById("notification"), modalOverlay = document.getElementById('modalOverlay');
        const appLoader = document.getElementById('app-loader');
        const loginPage = document.getElementById('login-page');
        const trackerPage = document.getElementById('tracker-page');
        const AVAILABLE_INDICATORS = { ema: "EMA", sma: "SMA", rsi: "RSI", macd: "MACD", bollinger: "Bollinger Bands", stochRsi: "Stochastic RSI", volume: "Hacim (24s)", atr: "ATR", ichimoku: "Ichimoku Cloud", fibonacci: "Fibonacci" };
        
        const translations = { 
            tr: { 
                login_prompt: "Devam etmek için giriş yapın veya yeni hesap oluşturun.", email: "E-posta", password: "Şifre", login: "Giriş Yap", signup: "Kayıt Ol", logout: "Çıkış Yap", app_title: "Fiyat Takipçisi", add: "Ekle", refresh: "Yenile", settings: "Ayarlar", coin: "Coin", price: "Fiyat", delete: "Sil", last_update: "Son güncelleme", color_rules: "Renk Kuralları", general_settings: "Genel Ayarlar", language: "Dil", auto_refresh: "Otomatik Yenileme", refresh_interval: "Yenileme Aralığı (sn)", column_settings: "Kolon Ayarları", positive_threshold: "Pozitif Eşik (%)", color_settings: "Renk Ayarları", high_positive_color: "Yüksek Pozitif Renk", low_positive_color: "Düşük Pozitif Renk", save_settings: "Ayarları Kaydet", saved: "Kaydedildi!", settings_saved: "Ayarlar başarıyla kaydedildi.", analysis_updated: "Analiz başarıyla güncellendi.", limit_exceeded: "Limit aşıldı!", 
                role_info: (role, limit, type) => `Rolünüz (${role}) en fazla ${limit} ${type} eklemeye izin veriyor.`, 
                invalid_asset: (asset) => `Geçersiz varlık: ${asset}`, 
                already_in_list: (asset) => `${asset} zaten listede.`, 
                lowest_price_detail: (period, lowestPrice, lowestDate, currentPrice, pctChange) => `
                    <div style="line-height: 1.8; font-size: 0.95rem;">
                        <p style="border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 10px;"><strong>${period} periyodundaki analiz:</strong></p>
                        <p>Bu dönemdeki en düşük fiyat: <strong style="color: var(--accent-yellow);">${lowestPrice}</strong><br><small>(Tarih: ${lowestDate})</small></p>
                        <p>Mevcut Fiyat: <strong style="color: var(--accent-blue);">${currentPrice}</strong></p>
                        <hr style="border-color: var(--border-color); margin: 15px 0;">
                        <p>Hesaplanan Değişim: <strong style="font-size: 1.2rem; color: ${pctChange > 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">${pctChange}%</strong></p>
                    </div>
                `,
                no_data: "Veri yok" 
            }, 
            en: {} 
        };

        function getDefaultSettings() {
            return {
                lang: 'tr', autoRefresh: false, refreshInterval: 300,
                telegramPhone: '',
                columns: { 1: { name: '1G', days: 1, threshold: 2 }, 2: { name: '7G', days: 7, threshold: 5 }, 3: { name: '30G', days: 30, threshold: 10 } },
                colors: { high: '#26a69a', low: '#f59e0b' },
                cryptoPivotFilter: 'all',
                cryptoAnalysisInterval: '4h',
                cryptoAnalysisIndicators: { ema: true, rsi: true, macd: true, bollinger: true, volume: false, sma: false, stochRsi: false, atr: false, ichimoku: false, fibonacci: false }
            };
        }

        function translatePage(lang) { document.querySelectorAll('[data-lang]').forEach(el => { const key = el.getAttribute('data-lang'); if (translations[lang]?.[key] && typeof translations[lang][key] === 'string') el.textContent = translations[lang][key]; }); }
        
        function showPage(pageId) {
            appLoader.style.display = 'none';
            loginPage.style.display = 'none';
            trackerPage.style.display = 'none';
            if (pageId) {
                const page = document.getElementById(pageId);
                if(page) page.style.display = 'flex';
            }
        }

        function showPanel(panelId) { document.getElementById(panelId).classList.add('show'); modalOverlay.classList.add('show'); document.body.classList.add('modal-open'); }
        function closeAllPanels() { document.querySelectorAll('.panel.show').forEach(p => p.classList.remove('show')); modalOverlay.classList.remove('show'); document.body.classList.remove('modal-open'); }
        function showNotification(message, isSuccess = true) { notification.textContent = message; notification.style.backgroundColor = isSuccess ? 'var(--accent-green)' : 'var(--accent-red)'; notification.classList.add('show'); setTimeout(() => notification.classList.remove('show'), 3000); }

        function showLoading(button) { button.dataset.originalHtml = button.innerHTML; button.innerHTML = '<div class="loading"></div>'; button.disabled = true; }
        function hideLoading(button) { if (button.dataset.originalHtml) { button.innerHTML = button.dataset.originalHtml; } button.disabled = false; }

        function loadSettings(userData) {
            const defaultSettings = getDefaultSettings();
            settings = { ...defaultSettings, ...userData.settings };
            settings.columns = { ...defaultSettings.columns, ...(userData.settings?.columns || {}) };
            settings.colors = { ...defaultSettings.colors, ...(userData.settings?.colors || {}) };
            settings.cryptoAnalysisIndicators = { ...defaultSettings.cryptoAnalysisIndicators, ...(userData.settings?.cryptoAnalysisIndicators || {}) };
        }

        function setRoleAndLimits(role) {
            currentUserRole = role;
            const limits = { admin: {coin: Infinity}, qualified: {coin: 20}, new_user: {coin: 10} };
            coinLimit = limits[currentUserRole]?.coin ?? 10;
            document.getElementById('userEmail').textContent = auth.currentUser.email;
        }

        function updateAdminUI() {
            const isAdmin = currentUserRole === 'admin';
            document.getElementById('analyzeAllCryptoBtn').style.display = isAdmin ? 'flex' : 'none';
            document.getElementById('alarms-tab').style.display = isAdmin ? 'block' : 'none';
        }

        auth.onAuthStateChanged(async user => {
            if (user) {
                userDocRef = db.collection('users').doc(user.uid);
                try {
                    const doc = await userDocRef.get();
                    let userData = doc.data();
                    if (!doc.exists) {
                        userData = { 
                            email: user.email, 
                            role: 'new_user', 
                            portfolios: { "Varsayılan": ["BTCUSDT", "ETHUSDT", "SOLUSDT"] },
                            activePortfolio: "Varsayılan",
                            coins_ai: ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
                            settings: getDefaultSettings(), 
                            alarms: [] 
                        };
                        await userDocRef.set(userData);
                    }
                    
                    setRoleAndLimits(userData.role);
                    userAlarms = userData.alarms || [];

                    if (!pageInitialized) {
                        await initializeTrackerPage(userData);
                    }
                    showPage('tracker-page');
                    updateAdminUI();

                } catch (err) {
                    console.error("Auth/Firestore Error:", err);
                    if (err.code === 'permission-denied') { document.getElementById("error-message").textContent = "Firestore yetki hatası. Lütfen veritabanı kurallarınızı kontrol edin."; }
                    auth.signOut();
                }
            } else {
                showPage('login-page');
                pageInitialized = false;
                userDocRef = null;
                if(autoRefreshTimer) clearInterval(autoRefreshTimer);
            }
        });
        
        async function initializeTrackerPage(userData) {
            pageInitialized = true;
            
            loadSettings(userData);
            
            if (userData.portfolios && Object.keys(userData.portfolios).length > 0) {
                userPortfolios = userData.portfolios;
                activePortfolio = userData.activePortfolio || Object.keys(userPortfolios)[0];
            } else {
                userPortfolios = { "Varsayılan": ["BTCUSDT", "ETHUSDT", "SOLUSDT"] };
                activePortfolio = "Varsayılan";
            }
            cryptoAiPairs = userData.coins_ai || ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];

            const formatPrice = (price) => {
                const num = parseFloat(price);
                if (isNaN(num)) return 'N/A';
                if (num < 0.001) return num.toFixed(8);
                if (num < 1) return num.toFixed(6);
                if (num < 10) return num.toFixed(4);
                return num.toFixed(2);
            };
            const formatVolume = (volume) => { const num = parseFloat(volume); if (isNaN(num)) return 'N/A'; if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`; if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`; if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`; return num.toFixed(0); };

            function applySettings() {
                document.getElementById('langSelect').value = settings.lang;
                document.getElementById('autoRefreshToggle').checked = settings.autoRefresh;
                document.getElementById('refreshInterval').value = settings.refreshInterval;
                document.getElementById('refreshInterval').min = { admin: 10, qualified: 120, new_user: 300 }[currentUserRole] || 300;
                document.getElementById('telegramPhoneInput').value = settings.telegramPhone || '';

                for (let i = 1; i <= 3; i++) {
                    if(settings.columns[i]) {
                        document.getElementById(`col${i}_name_input`).value = settings.columns[i].name;
                        document.getElementById(`col${i}_days_input`).value = settings.columns[i].days;
                        document.getElementById(`col${i}_threshold_input`).value = settings.columns[i].threshold;
                        document.getElementById(`col${i}_header_crypto`).innerHTML = `${settings.columns[i].name}<span class="sort-indicator"></span>`;
                    }
                }
                document.getElementById('high_color_input').value = settings.colors.high;
                document.getElementById('low_color_input').value = settings.colors.low;
                document.getElementById('high_color_preview').style.backgroundColor = settings.colors.high;
                document.getElementById('low_color_preview').style.backgroundColor = settings.colors.low;

                document.querySelectorAll(`#cryptoPivotFilters button.active, #cryptoIntervalFilters button.active`).forEach(b => b.classList.remove('active'));
                document.querySelector(`#cryptoPivotFilters button[data-filter="${settings.cryptoPivotFilter}"]`)?.classList.add('active');
                document.querySelector(`#cryptoIntervalFilters button[data-interval="${settings.cryptoAnalysisInterval}"]`)?.classList.add('active');

                Object.keys(AVAILABLE_INDICATORS).forEach(key => {
                    const checkbox = document.querySelector(`#crypto-indicator-filters-grid input[data-indicator="${key}"]`);
                    if (checkbox) checkbox.checked = !!settings.cryptoAnalysisIndicators[key];
                });
                translatePage(settings.lang);
                toggleAutoRefresh();
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
                    userDocRef.update({ settings: settings }).then(() => {
                        applySettings();
                        closeAllPanels();
                        showNotification(translations[settings.lang].settings_saved, true);
                        fetchAllDataAndRender();
                    }).catch(error => {
                        console.error("Firebase ayar kaydetme hatası:", error);
                        showNotification("Ayarları kaydederken hata oluştu.", false);
                    }).finally(() => {
                        hideLoading(btn);
                    });
                }
            }

            function updateAnalysisSettings(type) {
                const btn = document.getElementById('updateCryptoAnalysisBtn');
                showLoading(btn);
                
                settings.cryptoAnalysisInterval = document.querySelector('#cryptoIntervalFilters button.active').dataset.interval;

                settings[`${type}AnalysisIndicators`] = {};
                document.querySelectorAll(`#${type}-indicator-filters-grid input[type="checkbox"]`).forEach(checkbox => {
                    settings[`${type}AnalysisIndicators`][checkbox.dataset.indicator] = checkbox.checked;
                });
                if (userDocRef) {
                    userDocRef.update({ 
                        'settings.cryptoAnalysisIndicators': settings.cryptoAnalysisIndicators,
                        'settings.cryptoAnalysisInterval': settings.cryptoAnalysisInterval
                    }).then(() => {
                        showNotification(translations[settings.lang].analysis_updated, true);
                        fetchAllDataAndRender(); 
                    }).catch(error => {
                        console.error("Firebase analiz ayarı kaydetme hatası:", error);
                        showNotification("Analiz ayarları güncellenirken bir hata oluştu.", false);
                    }).finally(() => {
                        hideLoading(btn);
                    });
                }
            }
            
            function toggleAutoRefresh() { if(autoRefreshTimer) clearInterval(autoRefreshTimer); if(settings.autoRefresh) autoRefreshTimer = setInterval(fetchAllDataAndRender, settings.refreshInterval * 1000); }

            const calculateSMA = (data, period) => { if (data.length < period) return null; return data.slice(-period).reduce((s, v) => s + parseFloat(v), 0) / period; };
            const calculateEMA = (data, period) => { if (data.length < period) return null; const k = 2 / (period + 1); let ema = calculateSMA(data.slice(0, period), period); for (let i = period; i < data.length; i++) { ema = (parseFloat(data[i]) * k) + (ema * (1 - k)); } return ema; };
            const calculateStdDev = (data, period) => { let mean = data.reduce((s, v) => s + parseFloat(v), 0) / period; return Math.sqrt(data.reduce((s, v) => s + Math.pow(parseFloat(v) - mean, 2), 0) / period); };
            const calculateBollingerBands = (data, period = 20, stdDev = 2) => { if (data.length < period) return null; const middle = calculateEMA(data, period); const deviation = calculateStdDev(data.slice(-period), period); return { upper: middle + (deviation * stdDev), middle: middle, lower: middle - (deviation * stdDev) }; };
            const calculateRSI = (data, period = 14) => { if (data.length <= period) return null; let gains = 0, losses = 0; for (let i = 1; i <= period; i++) { const diff = parseFloat(data[i]) - parseFloat(data[i - 1]); if (diff >= 0) { gains += diff; } else { losses -= diff; } } let avgGain = gains / period, avgLoss = losses / period; for (let i = period + 1; i < data.length; i++) { const diff = parseFloat(data[i]) - parseFloat(data[i-1]); if (diff >= 0) { avgGain = (avgGain * (period - 1) + diff) / period; avgLoss = (avgLoss * (period - 1)) / period; } else { avgLoss = (avgLoss * (period - 1) - diff) / period; avgGain = (avgGain * (period - 1)) / period; } } if (avgLoss === 0) return 100; const rs = avgGain / avgLoss; return 100 - (100 / (1 + rs)); };
            const calculateStochasticRSI = (data, period = 14) => { if (data.length < period * 2) return null; const rsiValues = []; for(let i = period; i < data.length; i++) { const rsi = calculateRSI(data.slice(0, i + 1), period); if (rsi !== null) rsiValues.push(rsi); } if (rsiValues.length < period) return null; const currentRSI = rsiValues[rsiValues.length - 1]; const rsiSlice = rsiValues.slice(-period); const lowestRSI = Math.min(...rsiSlice); const highestRSI = Math.max(...rsiSlice); if (highestRSI === lowestRSI) return {k: 100}; return { k: ((currentRSI - lowestRSI) / (highestRSI - lowestRSI)) * 100 }; };
            const calculateATR = (klines, period = 14) => { if (klines.length < period + 1) return null; let trs = []; for (let i = 1; i < klines.length; i++) { const high = parseFloat(klines[i][2]), low = parseFloat(klines[i][3]), prevClose = parseFloat(klines[i-1][4]); trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))); } if (trs.length < period) return null; return trs.slice(-period).reduce((s, v) => s + v, 0) / period; };
            const calculateMACD = (data, fast = 12, slow = 26, signal = 9) => { if (data.length < slow) return null; const macdLineData = []; for (let i = slow - 1; i < data.length; i++) { const fastEma = calculateEMA(data.slice(0, i + 1), fast); const slowEma = calculateEMA(data.slice(0, i + 1), slow); if (fastEma !== null && slowEma !== null) macdLineData.push(fastEma - slowEma); } if (macdLineData.length < signal) return null; const signalLine = calculateEMA(macdLineData, signal); const macdLine = macdLineData[macdLineData.length - 1]; return { macd: macdLine, signal: signalLine, histogram: macdLine - signalLine }; };
            const calculateIchimokuCloud = (klines) => { if (klines.length < 52) return null; const slice = klines.slice(-52); const high9 = Math.max(...slice.slice(-9).map(k => parseFloat(k[2]))); const low9 = Math.min(...slice.slice(-9).map(k => parseFloat(k[3]))); const tenkanSen = (high9 + low9) / 2; const high26 = Math.max(...slice.slice(-26).map(k => parseFloat(k[2]))); const low26 = Math.min(...slice.slice(-26).map(k => parseFloat(k[3]))); const kijunSen = (high26 + low26) / 2; const senkouSpanA = (tenkanSen + kijunSen) / 2; const high52 = Math.max(...slice.map(k => parseFloat(k[2]))); const low52 = Math.min(...slice.map(k => parseFloat(k[3]))); const senkouSpanB = (high52 + low52) / 2; return { tenkanSen, kijunSen, senkouSpanA, senkouSpanB }; };
            const calculateFibonacciRetracement = (klines, period = 100) => { if (klines.length < period) return null; const slice = klines.slice(-period); const high = Math.max(...slice.map(k => parseFloat(k[2]))); const low = Math.min(...slice.map(k => parseFloat(k[3]))); const diff = high - low; return { level_236: high - diff * 0.236, level_382: high - diff * 0.382, level_500: high - diff * 0.5, level_618: high - diff * 0.618, }; };

            async function fetchCryptoData(pair) {
                try {
                    const timeout = 5000;
                    const [analysisKlinesResponse, dailyKlinesResponse, tickerResponse] = await Promise.all([
                        axios.get(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${settings.cryptoAnalysisInterval}&limit=400`, { timeout }),
                        axios.get(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1d&limit=1000`, { timeout }),
                        axios.get(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`, { timeout })
                    ]);
                    const analysisKlines = analysisKlinesResponse.data, dailyKlines = dailyKlinesResponse.data, tickerData = tickerResponse.data;
                    if (!analysisKlines || analysisKlines.length < 52 || !dailyKlines || dailyKlines.length < 2) throw new Error("Yetersiz geçmiş veri.");

                    const latestPrice = parseFloat(tickerData.lastPrice);
                    const analysisClosePrices = analysisKlines.map(d => d[4]);
                    const calculatePct = (col) => {
                        const days = settings.columns[col].days;
                        if (dailyKlines.length < days + 1) return { pct: 'N/A' };
                        const periodData = dailyKlines.slice(-(days + 1), -1);
                        let lowestPrice = Infinity, lowestDate = null;
                        periodData.forEach(d => { const low = parseFloat(d[3]); if (low < lowestPrice) { lowestPrice = low; lowestDate = new Date(d[0]); } });
                        if (lowestPrice === Infinity) return { pct: 'N/A' };
                        return { pct: ((latestPrice - lowestPrice) / lowestPrice * 100), lowestPrice, lowestDate: lowestDate.toLocaleDateString(settings.lang) };
                    };
                    const yesterday = dailyKlines[dailyKlines.length - 2];
                    const high = parseFloat(yesterday[2]), low = parseFloat(yesterday[3]), close = parseFloat(yesterday[4]);
                    const pivot = (high + low + close) / 3;

                    return {
                        pair, latestPrice, error: false, type: 'crypto', currency: 'USDT',
                        col1: calculatePct(1), col2: calculatePct(2), col3: calculatePct(3),
                        sr: { r2: pivot + (high - low), r1: (2 * pivot) - low, pivot: pivot, s1: (2 * pivot) - high, s2: pivot - (high - low) },
                        indicators: { sma: calculateSMA(analysisClosePrices, 50), ema: calculateEMA(analysisClosePrices, 50), rsi: calculateRSI(analysisClosePrices, 14), macd: calculateMACD(analysisClosePrices), bollinger: calculateBollingerBands(analysisClosePrices), stochRsi: calculateStochasticRSI(analysisClosePrices, 14), volume: parseFloat(tickerData.quoteVolume), atr: calculateATR(analysisKlines, 14), ichimoku: calculateIchimokuCloud(analysisKlines), fibonacci: calculateFibonacciRetracement(analysisKlines) }
                    };
                } catch (error) {
                    console.error(`${pair} verisi çekilirken hata oluştu:`, error);
                    return { pair, error: true, type: 'crypto' };
                }
            }

            async function fetchAllDataAndRender() {
                const refreshBtn = document.getElementById('refreshBtn');
                showLoading(refreshBtn);
                
                const currentCoinList = userPortfolios[activePortfolio] || [];
                allCryptoData = [];
                renderLoadingSkeletons('crypto', currentCoinList, document.getElementById('cryptoPriceTable'));
                allCryptoData = await Promise.all(currentCoinList.map(fetchCryptoData));

                allCryptoData.forEach(asset => {
                    if(!asset.error) {
                        const { recommendation, color, summary, category } = getRecommendation(asset, settings.cryptoAnalysisIndicators);
                        asset.recommendation = recommendation;
                        asset.recommendationColor = color;
                        asset.recommendationSummary = summary;
                        asset.recommendationCategory = category;
                    }
                });

                sortAndRenderTable();
                renderSupportResistance('crypto', allCryptoData);
                hideLoading(refreshBtn);
                updateTime.textContent = new Date().toLocaleString(settings.lang);
            }

            function renderLoadingSkeletons(type, pairs, tableBody) {
                tableBody.innerHTML = '';
                pairs.forEach(pair => {
                    const row = document.createElement("tr");
                    row.dataset.pair = pair;
                    if (type === 'crypto') {
                        row.innerHTML = `<td class="drag-handle-col hidden"><i class="fas fa-grip-lines drag-handle"></i></td><td class="asset-cell" data-pair="${pair}" data-type="${type}">${pair.replace("USDT", "")}</td><td colspan="5" style="text-align:center;"><div class="loading"></div></td>`;
                    } else { // crypto-ai
                        row.innerHTML = `<td class="drag-handle-col hidden"><i class="fas fa-grip-lines drag-handle"></i></td><td class="asset-cell" data-pair="${pair}" data-type="${type}">${pair.replace("USDT", "")}</td><td colspan="4" style="text-align:center;"><div class="loading"></div></td>`;
                    }
                    tableBody.appendChild(row);
                });
            }

            function sortAndRenderTable() {
                const { key, order } = currentSort;
                let sortedData = (order === 'default') ? [...allCryptoData] : [...allCryptoData].sort((a, b) => {
                    let valA, valB;
                    if (key.startsWith('col')) {
                        valA = a[key]?.pct;
                        valB = b[key]?.pct;
                    } else {
                        valA = a[key];
                        valB = b[key];
                    }

                    if (a.error) return 1; if (b.error) return -1;
                    if (valA === undefined || valA === null || valA === 'N/A') return 1;
                    if (valB === undefined || valB === null || valB === 'N/A') return -1;

                    if (typeof valA === 'string') {
                        return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                    } else {
                        return order === 'asc' ? valA - valB : valB - valA;
                    }
                });

                document.querySelectorAll('#crypto-content th.sortable').forEach(th => {
                    th.classList.remove('asc', 'desc');
                    if (th.dataset.sortKey === key && order !== 'default') {
                        th.classList.add(order);
                    }
                });
                updateAllTableRows('crypto', sortedData);
            }

            function updateAllTableRows(type, data) {
                const tableBody = document.getElementById(`${type}PriceTable`);
                tableBody.innerHTML = '';
                const isSorting = !document.querySelector('#crypto-content .drag-handle-col.hidden');
                
                const formatPct = (pct) => {
                    if(typeof pct === 'number') {
                        return `${pct.toFixed(2)}%`;
                    }
                    return 'N/A';
                };

                const getCellStyle = (colData, threshold) => {
                    const pct = colData?.pct;
                    let classes = '';
                    let style = '';
                    if (typeof pct !== 'number') return { classes: '', style: '' };
                    if (pct < 0) {
                        classes = 'negative';
                    } else if (pct >= threshold) {
                        classes = 'positive-high';
                        style = `style="color: ${settings.colors.high};"`;
                    } else {
                        classes = 'positive-low';
                        style = `style="color: ${settings.colors.low};"`;
                    }
                    return { classes, style };
                };

                data.forEach(result => {
                    const row = document.createElement("tr");
                    row.dataset.pair = result.pair;
                    let rowHTML;

                    if (result.error) {
                        rowHTML = `<td class="drag-handle-col ${isSorting ? '' : 'hidden'}"><i class="fas fa-grip-lines drag-handle"></i></td><td class="asset-cell">${result.pair.replace("USDT", "")}</td><td colspan="5" style="text-align:center; color: var(--accent-red);">Veri alınamadı</td>`;
                    } else {
                        const cellStyle1 = getCellStyle(result.col1, settings.columns[1].threshold);
                        const cellStyle2 = getCellStyle(result.col2, settings.columns[2].threshold);
                        const cellStyle3 = getCellStyle(result.col3, settings.columns[3].threshold);

                        rowHTML = `
                            <td class="drag-handle-col ${isSorting ? '' : 'hidden'}"><i class="fas fa-grip-lines drag-handle"></i></td>
                            <td class="asset-cell" data-pair="${result.pair}" data-type="${type}">${result.pair.replace("USDT", "")}</td>
                            <td>${formatPrice(result.latestPrice)}</td>
                            <td class="${cellStyle1.classes} clickable-pct" ${cellStyle1.style} data-col="1" data-pair="${result.pair}" data-type="${type}">${formatPct(result.col1.pct)}</td>
                            <td class="${cellStyle2.classes} clickable-pct" ${cellStyle2.style} data-col="2" data-pair="${result.pair}" data-type="${type}">${formatPct(result.col2.pct)}</td>
                            <td class="${cellStyle3.classes} clickable-pct" ${cellStyle3.style} data-col="3" data-pair="${result.pair}" data-type="${type}">${formatPct(result.col3.pct)}</td>
                        `;
                    }
                    rowHTML += `<td><button class="action-btn remove-btn" data-pair="${result.pair}" data-type="${type}"><i class="fas fa-times"></i></button></td>`;
                    row.innerHTML = rowHTML;
                    tableBody.appendChild(row);
                });
            }

            function renderSupportResistance(type, data) {
                const container = document.getElementById('crypto-pivot-container');
                container.innerHTML = '';
                document.getElementById('pivot-dictionary-container').innerHTML = `
                    <div class="pivot-dictionary">
                        <p><span>P:</span> Pivot Noktası (Referans)</p>
                        <p><span>R1, R2:</span> Direnç Seviyeleri (Yükseliş Hedefleri)</p>
                        <p><span>S1, S2:</span> Destek Seviyeleri (Düşüş Durakları)</p>
                    </div>`;

                const filter = settings[`${type}PivotFilter`];
                data.filter(asset => !asset.error && asset.sr).forEach(asset => {
                    if ((filter === 'above' && asset.latestPrice < asset.sr.pivot) || (filter === 'below' && asset.latestPrice > asset.sr.pivot)) return;

                    const { s2, s1, pivot, r1, r2 } = asset.sr;
                    const min = s2, max = r2;
                    if (max <= min) return;
                    const range = max - min;
                    const getPosition = (value) => Math.max(0, Math.min(100, ((value - min) / range) * 100));

                    const card = document.createElement('div');
                    card.className = 'pivot-bar-card';
                    card.innerHTML = `
                        <h4 class="pivot-bar-header">${asset.pair.replace("USDT", "")} - Günlük Pivot Seviyeleri</h4>
                        <div class="pivot-bar-container">
                            <div class="pivot-bar">
                                <div class="pivot-marker" style="left: ${getPosition(s2)}%;"></div>
                                <div class="pivot-marker" style="left: ${getPosition(s1)}%;"></div>
                                <div class="pivot-marker" style="left: ${getPosition(pivot)}%;"></div>
                                <div class="pivot-marker" style="left: ${getPosition(r1)}%;"></div>
                                <div class="pivot-marker" style="left: ${getPosition(r2)}%;"></div>
                            </div>
                            <div class="current-price-indicator" style="left: ${getPosition(asset.latestPrice)}%;" data-price="${formatPrice(asset.latestPrice)}"></div>
                        </div>
                        <div class="pivot-values">
                            <span>S2: ${formatPrice(s2)}</span>
                            <span>S1: ${formatPrice(s1)}</span>
                            <span>P: ${formatPrice(pivot)}</span>
                            <span>R1: ${formatPrice(r1)}</span>
                            <span>R2: ${formatPrice(r2)}</span>
                        </div>
                    `;
                    container.appendChild(card);
                });
            }

            function renderIndicatorFilters() {
                const grid = document.getElementById('crypto-indicator-filters-grid');
                if(grid) grid.innerHTML = Object.keys(AVAILABLE_INDICATORS).map(key => `<label class="filter-item"><input type="checkbox" data-indicator="${key}">${AVAILABLE_INDICATORS[key]}</label>`).join('');
            }

            function renderDictionary() {
                const content = document.getElementById('dictionaryContent');
                if(content) content.innerHTML = `<div class="dictionary-item"><h5>RSI (Göreceli Güç Endeksi)</h5><p>Fiyat hareketlerinin hızını ve değişimini ölçerek bir varlığın aşırı alım veya aşırı satım koşullarında olup olmadığını değerlendirir. 0 ile 100 arasında bir değer alır.</p><p class="example"><b>Örnek:</b> RSI değeri 70'in üzerine çıktığında, varlığın aşırı değerlendiği ve bir düzeltme (düşüş) yaşanabileceği düşünülür (Sat sinyali). 30'un altına indiğinde ise aşırı satıldığı ve bir tepki yükselişi gelebileceği düşünülür (Al sinyali).</p></div><div class="dictionary-item"><h5>MACD (Hareketli Ortalama Yakınsama/Iraksama)</h5><p>İki farklı üssel hareketli ortalama (genellikle 12 ve 26 günlük) arasındaki ilişkiyi gösteren bir trend takip ve momentum göstergesidir. MACD çizgisi, sinyal çizgisini yukarı kestiğinde al, aşağı kestiğinde sat sinyali olarak yorumlanır.</p><p class="example"><b>Örnek:</b> Mavi MACD çizgisi, turuncu sinyal çizgisini alttan yukarı doğru keserse, bu yükseliş momentumunun arttığını gösterir ve bir 'Al' fırsatı olabilir. Histogramın (çubukların) sıfır çizgisinin üzerine çıkması bu sinyali güçlendirir.</p></div><div class="dictionary-item"><h5>Hareketli Ortalamalar (EMA/SMA)</h5><p>Belirli bir periyottaki fiyatların ortalamasını alarak trend yönünü yumuşatır ve belirginleştirir. EMA (Üssel) son fiyatlara daha fazla ağırlık verirken, SMA (Basit) tüm fiyatlara eşit ağırlık verir. Kısa vadeli ortalamanın (örn. 20 EMA) uzun vadeli ortalamayı (örn. 50 EMA) yukarı kesmesi 'Golden Cross' (Al sinyali), aşağı kesmesi 'Death Cross' (Sat sinyali) olarak bilinir.</p><p class="example"><b>Örnek:</b> Fiyat grafiği 50 günlük EMA'nın üzerinde seyrediyorsa, orta vadeli trendin yükselişte olduğu kabul edilir.</p></div><div class="dictionary-item"><h5>Bollinger Bantları</h5><p>Bir basit hareketli ortalamanın (orta bant) etrafına standart sapma ile hesaplanan iki bandın (üst ve alt) eklenmesiyle oluşur. Fiyatların bu bantların dışına çıkması nadirdir ve genellikle aşırı oynaklığa veya güçlü bir trende işaret eder.</p><p class="example"><b>Örnek:</b> Fiyatlar alt banda değip tekrar içeri dönerse bu bir alım fırsatı olabilir. Fiyatların üst banda sürekli baskı yapması ve bandın genişlemesi, güçlü bir yükseliş trendinin işareti olabilir.</p></div><div class="dictionary-item"><h5>Ichimoku Cloud (Ichimoku Bulutu)</h5><p>Tek bakışta trend yönü, momentum, destek ve direnç seviyeleri hakkında kapsamlı bilgi sunar. Fiyatın bulutun (Kumo) üzerinde olması yükseliş, altında olması düşüş trendini gösterir. Bulutun kendisi ise dinamik bir destek/direnç bölgesi olarak çalışır.</p><p class="example"><b>Örnek:</b> Fiyat, yeşil bulutun üzerindeyse bu güçlü bir yükseliş trendidir. Fiyatın bulutun içine girmesi ise piyasanın kararsız olduğunu gösterir.</p></div><div class="dictionary-item"><h5>Stochastic RSI</h5><p>RSI göstergesine stokastik osilatör formülünün uygulanmasıyla elde edilir ve aşırı alım/satım sinyallerini daha sık ve net bir şekilde üretir. 80 üzeri aşırı alım, 20 altı aşırı satım olarak kabul edilir.</p><p class="example"><b>Örnek:</b> StochRSI 20 seviyesinin altına düşüp tekrar yukarı döndüğünde bu bir alım sinyali olarak değerlendirilebilir.</p></div><div class="dictionary-item"><h5>ATR (Average True Range)</h5><p>Piyasanın oynaklığını (volatilite) ölçer. Fiyatın ne kadar hareket ettiğini gösterir, ancak yönünü belirtmez. Yüksek ATR, yüksek oynaklık; düşük ATR, düşük oynaklık anlamına gelir.</p><p class="example"><b>Örnek:</b> Bir yatırımcı, stop-loss seviyesini belirlerken mevcut fiyatın 2 ATR kadar altına koyabilir. Bu, normal piyasa dalgalanmalarından etkilenmemesine yardımcı olur.</p></div><div class="dictionary-item"><h5>Fibonacci Düzeltmesi</h5><p>Bir trendin başlangıç ve bitiş noktaları arasına çizilen yatay seviyelerdir. Trendin olası geri çekilme (düzeltme) seviyelerini, yani potansiyel destek ve direnç alanlarını belirlemek için kullanılır. En yaygın seviyeler %38.2, %50 ve %61.8'dir.</p><p class="example"><b>Örnek:</b> Bir yükseliş trendinde fiyat geri çekilmeye başlarsa, yatırımcılar %50 Fibonacci seviyesinin destek olarak çalışmasını ve fiyatın buradan tekrar yükselişe geçmesini bekleyebilir.</p></div>`;
            }

            function getRecommendation(asset, activeIndicators) {
                const { indicators, latestPrice } = asset;
                let buyScore = 0, sellScore = 0;
                let summaryPoints = { buy: [], sell: [], neutral: [] };

                const formatVal = (val) => (typeof val === 'number' ? val.toFixed(2) : val);

                // RSI
                if (activeIndicators.rsi && indicators.rsi !== null) {
                    if (indicators.rsi <= 30) { buyScore += 2; summaryPoints.buy.push(`RSI(${formatVal(indicators.rsi)}) aşırı satım bölgesinde`); }
                    else if (indicators.rsi < 45) { buyScore += 1; summaryPoints.buy.push(`RSI(${formatVal(indicators.rsi)}) düşük seviyede`); }
                    if (indicators.rsi >= 70) { sellScore += 2; summaryPoints.sell.push(`RSI(${formatVal(indicators.rsi)}) aşırı alım bölgesinde`); }
                    else if (indicators.rsi > 55) { sellScore += 1; summaryPoints.sell.push(`RSI(${formatVal(indicators.rsi)}) yüksek seviyede`); }
                }
                // Stochastic RSI
                if (activeIndicators.stochRsi && indicators.stochRsi) {
                    if(indicators.stochRsi.k <= 20) { buyScore += 2; summaryPoints.buy.push(`StochRSI(${formatVal(indicators.stochRsi.k)}) aşırı satımda`); } 
                    if(indicators.stochRsi.k >= 80) { sellScore += 2; summaryPoints.sell.push(`StochRSI(${formatVal(indicators.stochRsi.k)}) aşırı alımda`); }
                }
                // Bollinger Bands
                if (activeIndicators.bollinger && indicators.bollinger) {
                    if (latestPrice < indicators.bollinger.lower) { buyScore += 2; summaryPoints.buy.push("Fiyat alt Bollinger bandının altında"); } 
                    else if (latestPrice > indicators.bollinger.upper) { sellScore += 2; summaryPoints.sell.push("Fiyat üst Bollinger bandının üzerinde"); }
                    else if (latestPrice < indicators.bollinger.middle) { sellScore += 0.5; }
                    else if (latestPrice > indicators.bollinger.middle) { buyScore += 0.5; }
                }
                // MACD
                if (activeIndicators.macd && indicators.macd) {
                    if (indicators.macd.histogram > 0) {
                        buyScore += 1.5;
                        summaryPoints.buy.push("MACD histogramı pozitif");
                    } else {
                        sellScore += 1.5;
                        summaryPoints.sell.push("MACD histogramı negatif");
                    }
                }
                // Moving Averages (EMA/SMA)
                if (activeIndicators.ema && activeIndicators.sma && indicators.ema && indicators.sma) {
                    if (indicators.ema > indicators.sma) {
                        buyScore += 1;
                        summaryPoints.buy.push("EMA, SMA'nın üzerinde (yükseliş trendi)");
                    } else {
                        sellScore += 1;
                        summaryPoints.sell.push("EMA, SMA'nın altında (düşüş trendi)");
                    }
                }
                // Ichimoku Cloud
                if (activeIndicators.ichimoku && indicators.ichimoku) {
                    const { tenkanSen, kijunSen, senkouSpanA, senkouSpanB } = indicators.ichimoku;
                    const inCloud = latestPrice > Math.min(senkouSpanA, senkouSpanB) && latestPrice < Math.max(senkouSpanA, senkouSpanB);
                    
                    if (latestPrice > senkouSpanA && latestPrice > senkouSpanB) {
                        buyScore += 2;
                        summaryPoints.buy.push("Fiyat Ichimoku bulutunun üzerinde");
                    } else if (latestPrice < senkouSpanA && latestPrice < senkouSpanB) {
                        sellScore += 2;
                        summaryPoints.sell.push("Fiyat Ichimoku bulutunun altında");
                    } else if (inCloud) {
                        summaryPoints.neutral.push("Fiyat Ichimoku bulutunun içinde (kararsız)");
                    }

                    if (tenkanSen > kijunSen) { buyScore += 1; summaryPoints.buy.push("Tenkan/Kijun kesişimi pozitif"); }
                    else { sellScore += 1; summaryPoints.sell.push("Tenkan/Kijun kesişimi negatif"); }
                }
                // Fibonacci
                if (activeIndicators.fibonacci && indicators.fibonacci) {
                    if (latestPrice < indicators.fibonacci.level_618) { sellScore += 0.5; summaryPoints.sell.push("Fiyat kritik 0.618 Fibonacci desteğinin altında"); }
                    else { buyScore += 0.5; summaryPoints.buy.push("Fiyat kritik 0.618 Fibonacci desteğinin üzerinde"); }
                }

                let recommendation, color, category;
                const finalScore = buyScore - sellScore;
                const conflictLevel = Math.min(buyScore, sellScore);

                if (conflictLevel >= 3) {
                    recommendation = "Tut";
                    color = "var(--hold)";
                    category = "hold";
                } else {
                    if (finalScore >= 4) { recommendation = "Güçlü Al"; color = "var(--strong-buy)"; category = "buy"; }
                    else if (finalScore >= 1.5) { recommendation = "Al"; color = "var(--buy)"; category = "buy"; }
                    else if (finalScore <= -4) { recommendation = "Güçlü Sat"; color = "var(--strong-sell)"; category = "sell"; }
                    else if (finalScore <= -1.5) { recommendation = "Sat"; color = "var(--sell)"; category = "sell"; }
                    else { recommendation = "Tut"; color = "var(--hold)"; category = "hold"; }
                }

                let summary = "";
                if (summaryPoints.buy.length > 0) {
                    summary += `<b>⬆ Al Sinyalleri (${summaryPoints.buy.length}):</b> ${summaryPoints.buy.join(', ')}. `;
                }
                if (summaryPoints.sell.length > 0) {
                    summary += `<br><b>⬇ Sat Sinyalleri (${summaryPoints.sell.length}):</b> ${summaryPoints.sell.join(', ')}. `;
                }
                if (summaryPoints.neutral.length > 0) {
                     summary += `<br><b>➖ Nötr Sinyaller (${summaryPoints.neutral.length}):</b> ${summaryPoints.neutral.join(', ')}.`;
                }
                if (summary.length === 0) {
                    summary = "Aktif indikatörlere göre belirgin bir sinyal bulunamadı.";
                }

                return { recommendation, color, summary, category };
            }

            function renderIndicatorCards(type, data) {
                const container = document.getElementById('crypto-indicator-cards-container');
                container.innerHTML = '';
                const activeIndicators = settings[`${type}AnalysisIndicators`];
                const sourceData = data || allCryptoData;

                sourceData.forEach(asset => {
                    if (currentRecommendationFilter !== 'all' && asset.recommendationCategory !== currentRecommendationFilter) {
                        return;
                    }

                    const card = document.createElement('div');
                    card.className = 'indicator-card';
                    if (asset.error) {
                        card.innerHTML = `<h4>${asset.pair.replace("USDT", "")}</h4><p style="color:var(--accent-red)">Veri yüklenemedi.</p>`;
                        container.appendChild(card);
                        return;
                    }
                    const { recommendation, recommendationColor, recommendationSummary, latestPrice, indicators } = asset;

                    const getValueHTML = (label, value, formatter, positiveCondition, negativeCondition) => {
                        if (value === null || value === undefined) return '';
                        let className = 'value';
                        if (positiveCondition?.(value)) className += ' value-positive';
                        else if (negativeCondition?.(value)) className += ' value-negative';
                        return `<div class="indicator-item"><span class="label">${label}</span><span class="${className}">${formatter(value)}</span></div>`;
                    };

                    let detailsHTML = '<div class="indicator-details-grid">';
                    detailsHTML += getValueHTML('Fiyat', latestPrice, val => `$${formatPrice(val)}`);
                    Object.keys(AVAILABLE_INDICATORS).forEach(key => {
                        if(activeIndicators[key]) {
                            const indicatorValue = indicators[key];
                            if (indicatorValue !== undefined && indicatorValue !== null) {
                                 switch(key) {
                                    case 'rsi': detailsHTML += getValueHTML('RSI', indicatorValue, v => v.toFixed(2), v => v < 30, v => v > 70); break;
                                    case 'macd': detailsHTML += getValueHTML('MACD Hist.', indicatorValue?.histogram, v => v.toFixed(6), v => v > 0, v => v < 0); break;
                                    case 'stochRsi': detailsHTML += getValueHTML('Stoch RSI (k)', indicatorValue?.k, v => v.toFixed(2), v => v < 20, v => v > 80); break;
                                    case 'volume': detailsHTML += getValueHTML('Hacim (24s)', indicatorValue, formatVolume); break;
                                    case 'ema': detailsHTML += getValueHTML('EMA (50)', indicatorValue, v => v.toFixed(2)); break;
                                    case 'sma': detailsHTML += getValueHTML('SMA (50)', indicatorValue, v => v.toFixed(2)); break;
                                    case 'atr': detailsHTML += getValueHTML('ATR', indicatorValue, v => v.toFixed(4)); break;
                                    case 'bollinger': 
                                        detailsHTML += getValueHTML('Bollinger Üst', indicatorValue?.upper, v => v.toFixed(2));
                                        detailsHTML += getValueHTML('Bollinger Orta', indicatorValue?.middle, v => v.toFixed(2));
                                        detailsHTML += getValueHTML('Bollinger Alt', indicatorValue?.lower, v => v.toFixed(2));
                                        break;
                                    case 'ichimoku': 
                                        detailsHTML += getValueHTML('Ichimoku Tenkan', indicatorValue?.tenkanSen, v => v.toFixed(2)); 
                                        detailsHTML += getValueHTML('Ichimoku Kijun', indicatorValue?.kijunSen, v => v.toFixed(2)); 
                                        detailsHTML += getValueHTML('Ichimoku Senkou A', indicatorValue?.senkouSpanA, v => v.toFixed(2)); 
                                        detailsHTML += getValueHTML('Ichimoku Senkou B', indicatorValue?.senkouSpanB, v => v.toFixed(2)); 
                                        break;
                                    case 'fibonacci': 
                                        detailsHTML += getValueHTML('Fib 0.236', indicatorValue?.level_236, v => v.toFixed(2)); 
                                        detailsHTML += getValueHTML('Fib 0.382', indicatorValue?.level_382, v => v.toFixed(2)); 
                                        detailsHTML += getValueHTML('Fib 0.5', indicatorValue?.level_500, v => v.toFixed(2)); 
                                        detailsHTML += getValueHTML('Fib 0.618', indicatorValue?.level_618, v => v.toFixed(2)); 
                                        break;
                                }
                            }
                        }
                    });
                    detailsHTML += '</div>';

                    let aiButtonHTML = '';
                    if (currentUserRole === 'admin') {
                        aiButtonHTML = `<button class="ai-btn" data-pair="${asset.pair}" data-type="${type}" title="Bu varlığı yorumla"><i class="fas fa-magic-sparkles"></i></button>`;
                    }

                    card.innerHTML = `
                        <div class="indicator-card-header">
                            <h4>${asset.pair.replace("USDT", "")}</h4>
                            <span class="recommendation-badge" style="background-color:${recommendationColor};">${recommendation}</span>
                        </div>
                        ${detailsHTML}
                        <div class="card-footer">
                            <div class="summary">${recommendationSummary}</div>
                            ${aiButtonHTML}
                        </div>`;
                    container.appendChild(card);
                });
            }

            async function getGeminiAnalysis(type, pair = null) {
                const button = pair ? document.querySelector(`.ai-btn[data-pair="${pair}"]`) : document.getElementById(`analyzeAllCryptoBtn`);
                if (!button) return;

                showLoading(button);
                const analysisContent = document.getElementById('analysisContent');
                analysisContent.innerHTML = '<div class="loading" style="margin: 20px auto; display:block;"></div>';
                showPanel('analysisPanel');

                const dataToAnalyze = (pair ? allCryptoData.filter(c => c.pair === pair) : allCryptoData);
                const activeIndicators = settings[`${type}AnalysisIndicators`];
                let dataSummary = "";

                dataToAnalyze.forEach(asset => {
                    if(!asset.error) {
                        dataSummary += `Varlık: ${asset.pair.replace('USDT', '')}, Fiyat: ${formatPrice(asset.latestPrice)}. Aktif indikatörler: `;
                        Object.keys(activeIndicators).forEach(key => {
                            if(activeIndicators[key] && asset.indicators[key] !== null && asset.indicators[key] !== undefined) {
                                 let val = asset.indicators[key];
                                 if(typeof val === 'object') val = JSON.stringify(val, (k,v) => typeof v === 'number' ? parseFloat(v.toFixed(4)) : v);
                                 dataSummary += `${key}: ${val}, `;
                            }
                        });
                        dataSummary += "\n";
                    }
                });
                
                try {
                    const geminiProxy = functions.httpsCallable('geminiProxy');
                    const result = await geminiProxy({ prompt: dataSummary });

                    if (result.data && result.data.analysis) {
                        const cleanedHtml = result.data.analysis.replace(/^```html\n?|```$/g, '');
                        analysisContent.innerHTML = cleanedHtml;
                    } else {
                        throw new Error("Yapay zekadan geçerli bir yanıt alınamadı.");
                    }
                } catch (error) {
                    console.error("Gemini AI Hatası:", error);
                    analysisContent.innerHTML = `<p style="color:var(--accent-red)">Yorumlama sırasında bir hata oluştu: ${error.message}. Lütfen Firebase projenizde 'geminiProxy' adlı Cloud Function'ın doğru şekilde deploy edildiğinden ve faturalandırmanın aktif olduğundan emin olun.</p>`;
                } finally {
                    hideLoading(button);
                }
            }

            const addNewAsset = async (type) => {
                const input = document.getElementById('newCoinInput');
                const assetList = userPortfolios[activePortfolio];
                const limit = coinLimit;
                
                const newAssetSymbols = input.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                if (newAssetSymbols.length === 0) return;
                if (limit !== Infinity && (assetList.length + newAssetSymbols.length) > limit) {
                    showNotification(translations[settings.lang].role_info(currentUserRole, limit, 'coin'), false);
                    return;
                }

                for (const symbol of newAssetSymbols) {
                    const newPair = (type === 'crypto' && !symbol.endsWith('USDT')) ? `${symbol}USDT` : symbol;
                    if (assetList.includes(newPair)) {
                        showNotification(translations[settings.lang].already_in_list(symbol), false);
                        continue;
                    }
                    try {
                        await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${newPair}`);
                        assetList.push(newPair);
                    } catch (error) {
                        showNotification(translations[settings.lang].invalid_asset(symbol), false);
                    }
                }
                savePortfoliosToFirestore();
                fetchAllDataAndRender();
                input.value = '';
            };

            function showChart(pair, type) {
                document.getElementById('chartPanelTitle').textContent = pair.replace("USDT", "");
                document.getElementById('chartContainer').innerHTML = '';
                new TradingView.widget({ "autosize": true, "symbol": `BINANCE:${pair}`, "interval": "D", "theme": "dark", "style": "1", "locale": settings.lang, "container_id": "chartContainer" });
                showPanel('chartPanel');
            }

            function savePortfoliosToFirestore() {
                if (userDocRef) {
                    userDocRef.update({ portfolios: userPortfolios }).catch(error => console.error("Firebase portföy kaydetme hatası:", error));
                }
            }
            function renderPortfolioSelect() {
                const select = document.getElementById('portfolioSelect');
                select.innerHTML = '';
                for (const name in userPortfolios) {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    if (name === activePortfolio) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                }
            }
            async function setActivePortfolio(name) {
                activePortfolio = name;
                if(userDocRef) { await userDocRef.update({ activePortfolio: name }); }
                renderPortfolioSelect();
                await fetchAllDataAndRender();
            }
            async function fetchAiDataAndRender() {
                renderLoadingSkeletons('crypto-ai', cryptoAiPairs, document.getElementById('cryptoAiPriceTable'));
                const aiData = await Promise.all(cryptoAiPairs.map(fetchCryptoData));

                aiData.forEach(asset => {
                    if(!asset.error) {
                        const { recommendation, color, summary, category } = getRecommendation(asset, settings.cryptoAnalysisIndicators);
                        asset.recommendation = recommendation;
                        asset.recommendationColor = color;
                        asset.recommendationSummary = summary;
                        asset.recommendationCategory = category;
                    }
                });
                
                updateAiTableRows(aiData);
                renderIndicatorCards('crypto', aiData);
            }
            function updateAiTableRows(data) {
                const tableBody = document.getElementById('cryptoAiPriceTable');
                tableBody.innerHTML = '';
                const isSorting = !document.querySelector('#crypto-ai-content .drag-handle-col.hidden');

                data.forEach(result => {
                    const row = document.createElement("tr");
                    row.dataset.pair = result.pair;
                    let rowHTML;

                    if (result.error) {
                        rowHTML = `<td class="drag-handle-col ${isSorting ? '' : 'hidden'}"><i class="fas fa-grip-lines drag-handle"></i></td><td class="asset-cell">${result.pair.replace("USDT", "")}</td><td colspan="4" style="text-align:center; color: var(--accent-red);">Veri alınamadı</td>`;
                    } else {
                        rowHTML = `
                            <td class="drag-handle-col ${isSorting ? '' : 'hidden'}"><i class="fas fa-grip-lines drag-handle"></i></td>
                            <td class="asset-cell" data-pair="${result.pair}" data-type="crypto">${result.pair.replace("USDT", "")}</td>
                            <td>${formatPrice(result.latestPrice)}</td>
                            <td><span style="font-weight:bold; color:${result.recommendationColor};">${result.recommendation}</span></td>
                            <td>${result.recommendationSummary.substring(0, 100)}...</td>
                        `;
                    }
                    rowHTML += `<td><button class="action-btn remove-btn-ai" data-pair="${result.pair}"><i class="fas fa-times"></i></button></td>`;
                    row.innerHTML = rowHTML;
                    tableBody.appendChild(row);
                });
            }
            const addNewAssetAi = async () => {
                const input = document.getElementById('newCoinInput-ai');
                const assetList = cryptoAiPairs;
                const limit = coinLimit;

                const newAssetSymbols = input.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                if (newAssetSymbols.length === 0) return;
                
                if (limit !== Infinity && (assetList.length + newAssetSymbols.length) > limit) {
                    showNotification(translations[settings.lang].role_info(currentUserRole, limit, 'coin'), false);
                    return;
                }

                for (const symbol of newAssetSymbols) {
                    const newPair = !symbol.endsWith('USDT') ? `${symbol}USDT` : symbol;
                    if (assetList.includes(newPair)) {
                        showNotification(translations[settings.lang].already_in_list(symbol), false);
                        continue;
                    }
                    try {
                        await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${newPair}`);
                        assetList.push(newPair);
                    } catch (error) {
                        showNotification(translations[settings.lang].invalid_asset(symbol), false);
                    }
                }
                if (userDocRef) { userDocRef.update({ coins_ai: cryptoAiPairs }); }
                fetchAiDataAndRender();
                input.value = '';
            };

            function renderAlarms() {
                const container = document.getElementById('alarmsListContainer');
                container.innerHTML = '';
                if (userAlarms.length === 0) {
                    container.innerHTML = `<p style="text-align:center; color: var(--text-secondary);">Henüz oluşturulmuş alarm yok.</p>`;
                    return;
                }

                userAlarms.forEach(alarm => {
                    const card = document.createElement('div');
                    card.className = 'alarm-card';
                    card.dataset.alarmId = alarm.id;
                    
                    const coinsToDisplay = alarm.coins || [];
                    card.innerHTML = `
                        <div class="alarm-card-header">
                            <div class="alarm-card-title">${alarm.name}</div>
                            <div class="alarm-card-actions">
                                <button class="action-btn check-alarm-status-btn" title="Durumu Kontrol Et"><i class="fas fa-chart-bar"></i></button>
                                <label class="switch" title="${alarm.isActive ? 'Aktif' : 'Pasif'}">
                                    <input type="checkbox" class="alarm-status-toggle" ${alarm.isActive ? 'checked' : ''}>
                                    <span class="slider"></span>
                                </label>
                                <button class="action-btn edit-alarm-btn" title="Düzenle"><i class="fas fa-edit"></i></button>
                                <button class="action-btn delete-alarm-btn" title="Sil"><i class="fas fa-trash"></i></button>
                                <button class="action-btn backtest-alarm-btn" title="Backtest Sonuçları"><i class="fas fa-history"></i></button>
                            </div>
                        </div>
                        <div class="alarm-card-details">
                            <div class="coin-selection-display">
                                ${(coinsToDisplay.length > 0 ? coinsToDisplay.slice(0, 5) : ['Tüm Liste']).map(c => `<span class="coin-tag-sm">${c.replace("USDT","")}</span>`).join('')}
                                ${(coinsToDisplay.length > 5) ? `<span class="coin-tag-sm">+${coinsToDisplay.length - 5}</span>` : ''}
                            </div>
                        </div>
                    `;
                    container.appendChild(card);
                });
            }

            function renderAlarmCoinTags() {
                const container = document.getElementById('alarmCoinSelectionGrid');
                container.innerHTML = '';
                tempAlarmCoins.forEach(coin => {
                    const tag = document.createElement('div');
                    tag.className = 'coin-tag';
                    tag.innerHTML = `<span>${coin.replace("USDT", "")}</span><span class="remove-coin-tag" data-coin="${coin}">&times;</span>`;
                    container.appendChild(tag);
                });
            }
            function openAlarmPanel(alarm = null) {
                document.getElementById('alarmIdInput').value = alarm ? alarm.id : '';
                document.getElementById('alarmNameInput').value = alarm ? alarm.name : '';
                document.getElementById('alarmPanelTitle').textContent = alarm ? 'Alarmı Düzenle' : 'Yeni Alarm Oluştur';
                
                tempAlarmCoins = alarm && alarm.coins && alarm.coins.length > 0 ? [...alarm.coins] : [...userPortfolios[activePortfolio]];
                renderAlarmCoinTags();

                const isNewAlarm = !alarm;
                const conditions = alarm?.conditions || {};

                document.getElementById('alarmTimeframe').value = alarm?.timeframe || '15m';
                document.getElementById('alarmVolumeCondition').checked = conditions.volume?.enabled ?? isNewAlarm;
                document.getElementById('alarmVolumePeriod').value = conditions.volume?.period ?? 20;
                document.getElementById('alarmVolumeMultiplier').value = conditions.volume?.multiplier ?? 2;
                document.getElementById('alarmVolumeAmount').value = conditions.volume?.amount ?? 0;
                document.getElementById('alarmMacdCondition').checked = conditions.macd?.enabled ?? isNewAlarm;
                document.getElementById('alarmMacdSignalType').value = conditions.macd?.signalType ?? 'buy';
                document.getElementById('alarmTrendFilterEnabled').checked = alarm?.trendFilterEnabled ?? false;
                document.getElementById('alarmADXThreshold').value = alarm?.adxThreshold || 25;

                const fibCond = conditions.fibonacci || {};
                document.getElementById('alarmFibCondition').checked = fibCond.enabled ?? false;
                document.getElementById('alarmFibOperator').value = fibCond.operator || 'above';
                document.getElementById('alarmFibValue1').value = fibCond.values?.[0] || '618';
                document.getElementById('alarmFibValue2').value = fibCond.values?.[1] || '500';

                document.getElementById('fibValue2Container').style.display = (document.getElementById('alarmFibOperator').value === 'between') ? 'block' : 'none';
                showPanel('alarmSettingsPanel');
            }

            async function saveAlarm() {
                const alarmId = document.getElementById('alarmIdInput').value;
                const alarmName = document.getElementById('alarmNameInput').value;
                if (!alarmName) {
                    showNotification("Alarm adı boş bırakılamaz.", false);
                    return;
                }

                const volumeEnabled = document.getElementById('alarmVolumeCondition').checked;
                const macdEnabled = document.getElementById('alarmMacdCondition').checked;

                if (!volumeEnabled && !macdEnabled) {
                    showNotification("En az bir alarm koşulu (Hacim veya MACD) seçmelisiniz.", false);
                    return;
                }
                
                const fibOperator = document.getElementById('alarmFibOperator').value;
                let fibValues = [document.getElementById('alarmFibValue1').value];
                if (fibOperator === 'between') {
                    fibValues.push(document.getElementById('alarmFibValue2').value);
                }

                const newAlarm = {
                    id: alarmId || `alarm_${new Date().getTime()}`,
                    name: alarmName,
                    coins: tempAlarmCoins,
                    isActive: alarmId ? (userAlarms.find(a => a.id === alarmId)?.isActive ?? true) : true,
                    timeframe: document.getElementById('alarmTimeframe').value,
                    trendFilterEnabled: document.getElementById('alarmTrendFilterEnabled').checked,
                    adxThreshold: parseInt(document.getElementById('alarmADXThreshold').value),
                    conditions: {
                        volume: {
                            enabled: volumeEnabled,
                            period: parseInt(document.getElementById('alarmVolumePeriod').value),
                            multiplier: parseFloat(document.getElementById('alarmVolumeMultiplier').value),
                            amount: parseFloat(document.getElementById('alarmVolumeAmount').value) || 0
                        },
                        macd: {
                            enabled: macdEnabled,
                            signalType: document.getElementById('alarmMacdSignalType').value
                        },
                        fibonacci: {
                            enabled: document.getElementById('alarmFibCondition').checked,
                            operator: fibOperator,
                            values: fibValues
                        }
                    }
                };

                if (alarmId) {
                    userAlarms = userAlarms.map(a => a.id === alarmId ? newAlarm : a);
                } else {
                    userAlarms.push(newAlarm);
                }

                try {
                    await userDocRef.update({ alarms: userAlarms });
                    showNotification("Alarm başarıyla kaydedildi.", true);
                    renderAlarms();
                    closeAllPanels();
                } catch (error) {
                    console.error("Alarm kaydedilirken hata:", error);
                    showNotification("Alarm kaydedilemedi.", false);
                }
            }

            async function runBacktest(alarmId) {
                const alarm = userAlarms.find(a => a.id === alarmId);
                if (!alarm) return;

                document.getElementById('backtestAlarmName').textContent = `"${alarm.name}" Stratejisi`;
                const container = document.getElementById('backtest-results-container');
                container.innerHTML = `<div style="text-align: center; padding: 20px;"><div class="loading"></div></div>`;
                showPanel('backtestPanel');
                
                try {
                    const runBacktestOnBackend = functions.httpsCallable('runBacktest');
                    const result = await runBacktestOnBackend({ alarm: alarm });
                    const data = result.data;
                    let resultsHTML = '';

                    for (const coin in data) {
                        const coinData = data[coin];
                        if (!coinData) continue;
                        const totalCandles = 1000;
                        const successRate15m = (coinData.totalSignals > 0) ? ((coinData.positiveSignals_15m / coinData.totalSignals) * 100).toFixed(1) : "0";
                        const successRate1h = (coinData.totalSignals > 0) ? ((coinData.positiveSignals_1h / coinData.totalSignals) * 100).toFixed(1) : "0";
                        
                        let statsHTML = '';
                        if (alarm.conditions.volume?.enabled) {
                            statsHTML += `<p>Hacim Koşulu: <span class="value">${coinData.conditionStats.volumeMet} kez</span> (${((coinData.conditionStats.volumeMet / totalCandles) * 100).toFixed(1)}%)</p>`;
                        }
                        if (alarm.conditions.macd?.enabled) {
                            statsHTML += `<p>MACD Koşulu: <span class="value">${coinData.conditionStats.macdMet} kez</span> (${((coinData.conditionStats.macdMet / totalCandles) * 100).toFixed(1)}%)</p>`;
                        }
                        if (alarm.trendFilterEnabled) {
                             statsHTML += `<p>Trend Filtresi: <span class="value">${coinData.conditionStats.trendMet} kez</span> (${((coinData.conditionStats.trendMet / totalCandles) * 100).toFixed(1)}%)</p>`;
                        }
                        if (alarm.conditions.fibonacci?.enabled) {
                             statsHTML += `<p>Fibonacci Filtresi: <span class="value">${coinData.conditionStats.fibonacciMet} kez</span> (${((coinData.conditionStats.fibonacciMet / totalCandles) * 100).toFixed(1)}%)</p>`;
                        }
                        
                        let recommendationsHTML = '';
                        if (coinData.recommendations && coinData.recommendations.length > 0) {
                            recommendationsHTML = `<div class="backtest-card" style="grid-column: 1 / -1; background-color: rgba(41, 98, 255, 0.1);">
                                    <h5 style="color: #64b5f6;">AI Tavsiyeleri</h5>
                                    <div style="margin-top: 10px;">${coinData.recommendations.map(r => `<p style="margin:4px 0;">${r}</p>`).join('')}</div>
                                </div>`;
                        }
                        
                        resultsHTML += `
                        <div class="backtest-card">
                            <h4 style="color:var(--text-primary); margin-bottom: 15px;">${coin.replace("USDT","")} Sonuçları (Toplam Sinyal: ${coinData.totalSignals})</h4>
                            <div class="backtest-results-grid">
                                ${recommendationsHTML}
                                <div class="backtest-card" style="grid-column: 1 / -1;">
                                    <div class="backtest-results-grid" style="grid-template-columns: 1fr 1fr; gap: 20px;">
                                        <div>
                                            <h5 style="color: var(--accent-blue);">15 Dakika Sonrası</h5>
                                            <p>Başarı Oranı: <span class="value">${successRate15m}%</span></p>
                                            <p>Ort. Getiri: <span class="value" style="color: ${coinData.averageReturn_15m > 0 ? 'var(--value-positive)' : 'var(--value-negative)'};">${coinData.averageReturn_15m}%</span></p>
                                            <p>İyi/Kötü: <span class="value" style="color: var(--value-positive);">+${coinData.bestReturn_15m}%</span> / <span class="value" style="color: var(--value-negative);">${coinData.worstReturn_15m}%</span></p>
                                        </div>
                                        <div>
                                            <h5 style="color: var(--accent-yellow);">1 Saat Sonrası</h5>
                                            <p>Başarı Oranı: <span class="value">${successRate1h}%</span></p>
                                            <p>Ort. Getiri: <span class="value" style="color: ${coinData.averageReturn_1h > 0 ? 'var(--value-positive)' : 'var(--value-negative)'};">${coinData.averageReturn_1h}%</span></p>
                                            <p>İyi/Kötü: <span class="value" style="color: var(--value-positive);">+${coinData.bestReturn_1h}%</span> / <span class="value" style="color: var(--value-negative);">${coinData.worstReturn_1h}%</span></p>
                                        </div>
                                    </div>
                                </div>
                                <div class="backtest-card" style="grid-column: 1 / -1;">
                                    <h5 style="color: #c56cf0;">Koşul İstatistikleri (~${totalCandles} Mumda)</h5>
                                    <div style="margin-top: 10px;">${statsHTML}</div>
                                    <small style="color: var(--text-secondary); display: block; margin-top: 10px;">Bu bölüm, hangi koşulun ne kadar sık sağlandığını gösterir. Eğer sinyal sayısı "0" ise, buradaki düşük yüzdeler hangi kuralın çok katı olduğunu anlamanıza yardımcı olabilir.</small>
                                </div>
                            </div>
                        </div>`;
                    }

                    container.innerHTML = resultsHTML || `<p style="text-align:center; color: var(--text-secondary);">Seçilen strateji için son ~10 günde hiç sinyal bulunamadı. Lütfen koşulları daha az katı yapmayı deneyin.</p>`;

                } catch (error) {
                    console.error("Backtest hatası:", error);
                    container.innerHTML = `<p style="color:var(--accent-red)">Backtest çalıştırılırken bir hata oluştu: ${error.message}</p>`;
                }
            }
            
            async function showAlarmStatus(alarmId) {
                const alarm = userAlarms.find(a => a.id === alarmId);
                if (!alarm) return;
                
                const panelContent = document.getElementById('alarmStatusContent');
                document.getElementById('alarmStatusTitle').textContent = `"${alarm.name}" Anlık Durumu`;
                panelContent.innerHTML = '<div style="text-align:center; padding: 40px;"><div class="loading" style="width:30px; height:30px;"></div></div>';
                showPanel('alarmStatusPanel');

                try {
                    const checkAlarmStatus = functions.httpsCallable('checkAlarmStatus');
                    const result = await checkAlarmStatus({ alarm });
                    const { statuses } = result.data;

                    let contentHTML = '<div class="indicator-cards-container" style="padding-top:0;">';

                    statuses.forEach(item => {
                        if (item.error) {
                            contentHTML += `<div class="indicator-card"><h4>${item.coin.replace("USDT", "")}</h4><p style="color:var(--accent-red)">Durum alınamadı: ${item.error}</p></div>`;
                            return;
                        }
                        
                        const renderStatus = (label, condition, isEnabled) => {
                            if (!isEnabled) return '';

                            const isMet = condition.met;
                            const icon = isMet ? '<i class="fas fa-check-circle" style="color: var(--value-positive);"></i>' : '<i class="fas fa-times-circle" style="color: var(--value-negative);"></i>';
                            const text = isMet ? 'SAĞLANDI' : 'BEKLENİYOR';
                            
                            return `
                                <div class="indicator-item" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                                    <div style="display: flex; justify-content: space-between; width: 100%;">
                                        <span class="label">${label}</span>
                                        <span class="value" style="font-size: 0.9rem;">${icon} ${text}</span>
                                    </div>
                                    <small style="color: var(--text-secondary);">${condition.details}</small>
                                </div>
                            `;
                        };

                        contentHTML += `
                            <div class="indicator-card">
                                <div class="indicator-card-header" style="margin-bottom: 10px; padding-bottom: 10px;">
                                    <h4>${item.coin.replace("USDT", "")}</h4>
                                    <span style="font-size: 1.1rem; font-weight: 600;">$${formatPrice(item.currentPrice)}</span>
                                </div>
                                <div class="indicator-details-grid" style="gap: 12px;">
                                    ${renderStatus('Hacim Artışı', item.status.volume, alarm.conditions.volume?.enabled)}
                                    ${renderStatus('Hacim Tutarı', item.status.volumeAmount, alarm.conditions.volume?.enabled && alarm.conditions.volume?.amount > 0)}
                                    ${renderStatus('MACD Kesişimi', item.status.macd, alarm.conditions.macd?.enabled)}
                                    ${renderStatus('Güçlü Trend', item.status.trend, alarm.trendFilterEnabled)}
                                    ${renderStatus('Fibonacci', item.status.fibonacci, alarm.conditions.fibonacci?.enabled)}
                                </div>
                            </div>
                        `;
                    });

                    contentHTML += '</div>';
                    panelContent.innerHTML = contentHTML;

                } catch (error) {
                    console.error("Alarm durumu alınırken hata:", error);
                    panelContent.innerHTML = `<p style="color:var(--accent-red); text-align:center;">Durum bilgisi alınamadı: ${error.message}</p>`;
                }
            }

            document.getElementById('logoutBtn').addEventListener('click', (e) => { e.preventDefault(); auth.signOut(); });
            document.getElementById('refreshBtn').addEventListener('click', fetchAllDataAndRender);
            document.getElementById('addCoinBtn').addEventListener('click', () => addNewAsset('crypto'));
            document.getElementById('newCoinInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') addNewAsset('crypto'); });
            document.getElementById('addCoinBtn-ai').addEventListener('click', addNewAssetAi);
            document.getElementById('newCoinInput-ai').addEventListener('keypress', (e) => { if (e.key === 'Enter') addNewAssetAi(); });
            document.getElementById('toggleSortBtn-ai').addEventListener('click', () => {
                document.querySelectorAll('#crypto-ai-content .drag-handle-col').forEach(el => el.classList.toggle('hidden'));
            });
            document.getElementById('settingsBtn').addEventListener('click', () => showPanel('settingsPanel'));
            document.querySelectorAll('.close-btn').forEach(btn => btn.addEventListener('click', closeAllPanels));
            document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
            modalOverlay.addEventListener('click', closeAllPanels);
            document.getElementById('toggleSortBtn').addEventListener('click', () => {
                document.querySelectorAll('#crypto-content .drag-handle-col').forEach(el => el.classList.toggle('hidden'));
            });
            document.querySelector('#crypto-content thead').addEventListener('click', (e) => {
                const header = e.target.closest('th.sortable');
                if (!header) return;
                const key = header.dataset.sortKey;
                
                if (currentSort.key !== key) {
                    currentSort.key = key;
                    currentSort.order = 'asc';
                } else {
                    if (currentSort.order === 'asc') {
                        currentSort.order = 'desc';
                    } else if (currentSort.order === 'desc') {
                        currentSort.key = null;
                        currentSort.order = 'default';
                    }
                }
                sortAndRenderTable();
            });

            trackerPage.addEventListener('click', async (e) => {
                // Sinyal Analizini Çalıştırma
                if (e.target.closest('#runSignalAnalysisBtn')) {
                    const btn = e.target.closest('#runSignalAnalysisBtn');
                    showLoading(btn);

                    const coinInput = document.getElementById('signalAnalysisCoins').value;
                    const coins = coinInput.split(',').map(s => s.trim().toUpperCase()).filter(Boolean).map(s => s.endsWith('USDT') ? s : s + 'USDT');
                    
                    if(coins.length === 0) {
                        showNotification("Lütfen en az bir coin girin.", false);
                        hideLoading(btn);
                        return;
                    }

                    const params = {
                        coins: coins,
                        timeframe: document.getElementById('signalAnalysisTimeframe').value,
                        changePercent: parseFloat(document.getElementById('signalAnalysisChange').value),
                        direction: document.getElementById('signalAnalysisDirection').value,
                        days: parseInt(document.getElementById('signalAnalysisPeriod').value)
                    };

                    const resultContainer = document.getElementById('signalAnalysisResultContainer');
                    resultContainer.innerHTML = '<div class="loading" style="margin: 20px auto; display:block;"></div>';

                    try {
                        const findSignalDNA = functions.httpsCallable('findSignalDNA');
                        const result = await findSignalDNA(params);
                        const data = result.data;
                        
                        let html = '';
                        for(const coin in data) {
                            const res = data[coin];
                            html += `<div class="backtest-card" style="margin-bottom:15px;"><h4>${coin.replace("USDT","")} Analiz Sonuçları</h4>`;
                            if(res.error) {
                                html += `<p style="color:var(--accent-red)">Hata: ${res.error}</p>`;
                            } else if(res.totalEvents === 0) {
                                html += `<p>Belirtilen koşullarda (${params.direction === 'up' ? '+' : '-'}${params.changePercent}%) hiç olay bulunamadı.</p>`;
                            } else {
                                html += `
                                    <p>Bu koşul, son ${params.days} günde <strong>${res.totalEvents}</strong> kez gerçekleşti.</p>
                                    <p>Sinyal sonrası ortalama performans:</p>
                                    <ul style="font-size: 0.9rem; padding-left: 20px;">
                                        <li>1 periyot sonra: <strong style="color: ${res.avgReturn1 > 0 ? 'var(--value-positive)' : 'var(--value-negative)'};">${res.avgReturn1.toFixed(2)}%</strong></li>
                                        <li>4 periyot sonra: <strong style="color: ${res.avgReturn4 > 0 ? 'var(--value-positive)' : 'var(--value-negative)'};">${res.avgReturn4.toFixed(2)}%</strong> (Başarı: %${res.winRate4.toFixed(0)})</li>
                                    </ul>
                                    <div style="border-top: 1px solid var(--border-color); padding-top:10px; margin-top:10px;">
                                        <strong>💡 Erken Yakalama Tavsiyesi:</strong><br>
                                        Bu büyük hareketler olmadan hemen önce, MACD histogram değeri ortalama <strong>${res.avgMomentumHisto.toFixed(6)}</strong> seviyesindeydi.
                                        Yükselişi erken yakalamak için bir MACD alarmı kurarken, histogramın bu değere yaklaştığı veya bu değeri geçtiği anı (örneğin sıfır çizgisini geçtiği anı) bir tetikleyici olarak kullanmak, başarı şansınızı artırabilir.
                                    </div>
                                `;
                            }
                            html += `</div>`;
                        }
                        resultContainer.innerHTML = html;
                    } catch (error) {
                        console.error("Sinyal analizi hatası:", error);
                        resultContainer.innerHTML = `<p style="color:var(--accent-red)">Analiz sırasında bir hata oluştu: ${error.message}</p>`;
                    } finally {
                        hideLoading(btn);
                    }
                    return;
                }

                if (e.target.closest('#newPortfolioBtn')) {
                    document.getElementById('portfolioModalTitle').textContent = 'Yeni Liste Oluştur';
                    document.getElementById('portfolioModalLabel').textContent = 'Yeni Listenin Adı';
                    document.getElementById('portfolioNameInput').value = '';
                    document.getElementById('portfolioActionInput').value = 'new';
                    document.getElementById('portfolio-error-message').textContent = '';
                    showPanel('portfolioModal');
                    return;
                }
                if (e.target.closest('#renamePortfolioBtn')) {
                    document.getElementById('portfolioModalTitle').textContent = 'Listeyi Yeniden Adlandır';
                    document.getElementById('portfolioModalLabel').textContent = 'Yeni Ad';
                    document.getElementById('portfolioNameInput').value = activePortfolio;
                    document.getElementById('portfolioActionInput').value = 'rename';
                    document.getElementById('originalPortfolioNameInput').value = activePortfolio;
                    document.getElementById('portfolio-error-message').textContent = '';
                    showPanel('portfolioModal');
                    return;
                }
                if (e.target.closest('#deletePortfolioBtn')) {
                    if (Object.keys(userPortfolios).length <= 1) {
                        showNotification("Son listeyi silemezsiniz!", false);
                        return;
                    }
                    if (confirm(`"${activePortfolio}" listesini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
                        delete userPortfolios[activePortfolio];
                        const newActive = Object.keys(userPortfolios)[0];
                        await setActivePortfolio(newActive);
                        savePortfoliosToFirestore();
                        showNotification(`"${activePortfolio}" listesi silindi.`, true);
                    }
                    return;
                }

                const strategyBtn = e.target.closest('.strategy-btn');
                if(strategyBtn) {
                    document.querySelector('#strategyPresetFilters button.active')?.classList.remove('active');
                    strategyBtn.classList.add('active');
                    
                    const preset = strategyBtn.dataset.preset;
                    const customIndicatorSection = document.getElementById('customIndicatorSection');
                    const indicatorCheckboxes = document.querySelectorAll(`#crypto-indicator-filters-grid input`);

                    if (preset === 'custom') {
                        customIndicatorSection.style.display = 'block';
                    } else {
                        customIndicatorSection.style.display = 'none';
                        const activeIndicators = STRATEGY_PRESETS[preset];
                        
                        indicatorCheckboxes.forEach(checkbox => {
                            const indicatorKey = checkbox.dataset.indicator;
                            checkbox.checked = activeIndicators.hasOwnProperty(indicatorKey) && activeIndicators[indicatorKey];
                        });
                    }
                    return;
                }
                const collapsibleHeader = e.target.closest('.collapsible-header');
                if (collapsibleHeader) {
                    const parentCollapsible = collapsibleHeader.closest('.collapsible');
                    if (parentCollapsible) {
                        const content = parentCollapsible.querySelector('.collapsible-content');
                        if (content) {
                            collapsibleHeader.classList.toggle('open');
                            content.classList.toggle('open');
                        }
                    }
                    return;
                }

                const tabLink = e.target.closest('.tab-link');
                if(tabLink && !tabLink.classList.contains('active')) {
                    document.querySelector('.tab-link.active')?.classList.remove('active');
                    document.querySelector('.tab-content.active')?.classList.remove('active');
                    tabLink.classList.add('active');
                    document.getElementById(`${tabLink.dataset.tab}-content`)?.classList.add('active');
                    return;
                }

                const assetActionTarget = e.target.closest('.asset-cell, .clickable-pct, .remove-btn, .remove-btn-ai');
                if(assetActionTarget) {
                    const { pair, type, col } = assetActionTarget.dataset;
                    if (!pair) return;
                    const assetData = allCryptoData.find(c => c.pair === pair);

                    if (assetActionTarget.classList.contains('asset-cell')) { 
                        showChart(pair, type); 
                    }
                    else if (assetActionTarget.classList.contains('clickable-pct')) {
                        if (assetData && !assetData.error) {
                            const colData = assetData[`col${col}`];
                            if (colData && typeof colData.pct === 'number') {
                                const periodName = settings.columns[col].name;
                                const pctChange = colData.pct.toFixed(2);
                                
                                document.getElementById('detailPanelTitle').textContent = `${assetData.pair.replace('USDT','')} - ${periodName} Değişim Detayı`;
                                document.getElementById('detailPanelContent').innerHTML = translations[settings.lang].lowest_price_detail(
                                    periodName,
                                    formatPrice(colData.lowestPrice), 
                                    colData.lowestDate,
                                    formatPrice(assetData.latestPrice),
                                    pctChange
                                );
                                showPanel('detailPanel');
                            }
                        }
                    } else if (assetActionTarget.classList.contains('remove-btn')) {
                        userPortfolios[activePortfolio] = userPortfolios[activePortfolio].filter(p => p !== pair);
                        savePortfoliosToFirestore();
                        fetchAllDataAndRender();
                    } else if (assetActionTarget.classList.contains('remove-btn-ai')) {
                        const pairToRemove = assetActionTarget.dataset.pair;
                        cryptoAiPairs = cryptoAiPairs.filter(p => p !== pairToRemove);
                        if (userDocRef) { userDocRef.update({ coins_ai: cryptoAiPairs }); }
                        fetchAiDataAndRender();
                    }
                }

                const pivotFilterBtn = e.target.closest('#cryptoPivotFilters button');
                if(pivotFilterBtn) {
                     settings.cryptoPivotFilter = pivotFilterBtn.dataset.filter;
                     if (userDocRef) userDocRef.update({ 'settings.cryptoPivotFilter': settings.cryptoPivotFilter });
                     document.querySelector('#cryptoPivotFilters button.active').classList.remove('active');
                     pivotFilterBtn.classList.add('active');
                     renderSupportResistance('crypto', allCryptoData);
                     return;
                }
                const intervalFilterBtn = e.target.closest('#cryptoIntervalFilters button');
                if(intervalFilterBtn && !intervalFilterBtn.classList.contains('active')) {
                    document.querySelector('#cryptoIntervalFilters button.active').classList.remove('active');
                    intervalFilterBtn.classList.add('active');
                }
                 const recommendationFilterBtn = e.target.closest('#cryptoRecommendationFilters button');
                if(recommendationFilterBtn) {
                     currentRecommendationFilter = recommendationFilterBtn.dataset.filter;
                     document.querySelector('#cryptoRecommendationFilters button.active').classList.remove('active');
                     recommendationFilterBtn.classList.add('active');
                     renderIndicatorCards('crypto');
                     return;
                }

                if (e.target.closest('#createNewAlarmBtn')) {
                    if (!settings.telegramPhone) {
                        showNotification("Lütfen önce Ayarlar menüsünden Telegram Chat ID'nizi kaydedin.", false);
                        return;
                    }
                    openAlarmPanel(null);
                }
                
                const alarmCard = e.target.closest('.alarm-card');
                if(alarmCard) {
                    const alarmId = alarmCard.dataset.alarmId;
                    if(e.target.closest('.edit-alarm-btn')) {
                        const alarm = userAlarms.find(a => a.id === alarmId);
                        openAlarmPanel(alarm);
                    }
                    if(e.target.closest('.delete-alarm-btn')) {
                        if(confirm("Bu alarmı silmek istediğinizden emin misiniz?")) {
                            userAlarms = userAlarms.filter(a => a.id !== alarmId);
                            await userDocRef.update({ alarms: userAlarms });
                            renderAlarms();
                            showNotification("Alarm silindi.", true);
                        }
                    }
                    if (e.target.matches('.alarm-status-toggle')) {
                        const alarm = userAlarms.find(a => a.id === alarmId);
                        alarm.isActive = e.target.checked;
                        await userDocRef.update({ alarms: userAlarms });
                        showNotification(`Alarm ${alarm.isActive ? 'aktif' : 'pasif'} edildi.`, true);
                    }
                     if(e.target.closest('.backtest-alarm-btn')) {
                        runBacktest(alarmId);
                    }
                     if (e.target.closest('.check-alarm-status-btn')) {
                        showAlarmStatus(alarmId);
                    }
                }
            });
            
            document.getElementById('savePortfolioBtn').addEventListener('click', async () => {
                const action = document.getElementById('portfolioActionInput').value;
                const newName = document.getElementById('portfolioNameInput').value.trim();
                const originalName = document.getElementById('originalPortfolioNameInput').value;
                const errorDiv = document.getElementById('portfolio-error-message');

                if (!newName) {
                    errorDiv.textContent = 'Liste adı boş olamaz.';
                    return;
                }
                if (userPortfolios[newName] && newName !== originalName) {
                    errorDiv.textContent = 'Bu isimde bir liste zaten var.';
                    return;
                }

                if (action === 'new') {
                    userPortfolios[newName] = [];
                    await setActivePortfolio(newName);
                    savePortfoliosToFirestore();
                    showNotification(`"${newName}" listesi oluşturuldu.`, true);
                } else if (action === 'rename') {
                    userPortfolios[newName] = userPortfolios[originalName];
                    delete userPortfolios[originalName];
                    await setActivePortfolio(newName);
                    savePortfoliosToFirestore();
                    showNotification(`Liste "${originalName}" -> "${newName}" olarak değiştirildi.`, true);
                }
                closeAllPanels();
            });

            document.getElementById('alarmFibOperator').addEventListener('change', (e) => {
                document.getElementById('fibValue2Container').style.display = (e.target.value === 'between') ? 'block' : 'none';
            });

            // --- INITIAL RENDER ---
            renderIndicatorFilters();
            renderDictionary();
            renderAlarms();
            applySettings();
            renderPortfolioSelect();
            await fetchAllDataAndRender();
            await fetchAiDataAndRender();
        }
        
        document.getElementById('loginBtn').addEventListener('click', () => auth.signInWithEmailAndPassword(document.getElementById("email").value, document.getElementById("password").value).catch(err => document.getElementById("error-message").textContent = err.message));
        document.getElementById('signupBtn').addEventListener('click', () => auth.createUserWithEmailAndPassword(document.getElementById("email").value, document.getElementById("password").value).catch(err => document.getElementById("error-message").textContent = err.message));
    });

