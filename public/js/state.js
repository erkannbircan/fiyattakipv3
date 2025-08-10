let state = {
    currentUserRole: null,
    coinLimit: 10,
    settings: {},
    pageInitialized: false,
    autoRefreshTimer: null,
    reportsRefreshTimer: null,
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
