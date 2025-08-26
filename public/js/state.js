// ---- GLOBAL ÇATI (her JS dosyasının en üstüne koy) ----
window.App = window.App || {
  // sürüm bilgisi bu tur için (elle güncelle)
  version: 'v3.0.0-' + (window.App?.versionTag || ''),
  loaded: {},
  guards: {},
  log: (...args) => console.log('[App]', ...args),
};

let state = {
    currentUserRole: null,
    coinLimit: 10,
    settings: {},
    pageInitialized: false,
    autoRefreshTimer: null,
    reportsRefreshTimer: null,
    // YENİ: Canlı tarayıcı zamanlayıcısı
    liveScannerTimer: null,
    allCryptoData: [],
    userAlarms: [],
    trackedReports: [],
    currentSort: { key: null, order: 'default' },
    userPortfolios: {},
    activePortfolio: 'Varsayılan',
    cryptoAiPairs: [],
    discoveryCoins: [],
    userDocRef: null,
    sortableInstance: null,
    currentRecommendationFilter: 'all',
    tempAlarmCoins: [],
    tradingViewWidget: null,
    firebase: {
        auth: null,
        db: null,
        functions: null
    }
};
