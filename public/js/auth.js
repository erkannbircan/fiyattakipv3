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
                await auth.signInWithEmailAndPassword(email, password);
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
                await auth.createUserWithEmailAndPassword(email, password);
                if (errorMessageDiv) errorMessageDiv.textContent = '';
            } catch (error) {
                if (errorMessageDiv) errorMessageDiv.textContent = `Kayıt olunamadı: ${error.message}`;
            } finally {
                hideLoading(signupBtn);
            }
        });
    }
}

function initializeAuthListener() {
    auth.onAuthStateChanged(async user => {
        if (user) {
            userDocRef = db.collection('users').doc(user.uid);
            try {
                const doc = await userDocRef.get();
                let userData = doc.data();
                if (!doc.exists) {
                    userData = {
                        email: user.email, role: 'new_user',
                        portfolios: { "Varsayılan": ["BTCUSDT", "ETHUSDT", "SOLUSDT"] },
                        activePortfolio: "Varsayılan",
                        coins_ai: ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
                        coins_discovery: ["BTCUSDT", "ETHUSDT"],
                        settings: getDefaultSettings(),
                        alarms: []
                    };
                    await userDocRef.set(userData, { merge: true });
                }

                loadSettingsAndRole(userData);
                if (!pageInitialized) await initializeTrackerPage(userData);

                showPage('tracker-page');
                updateAdminUI();

            } catch (err) {
                console.error("Auth/Firestore Error:", err);
                const errorMessageDiv = document.getElementById('error-message');
                if (errorMessageDiv) {
                    if (err.code === 'permission-denied') {
                        errorMessageDiv.textContent = "Firestore yetki hatası. Veritabanı kurallarınızı kontrol edin.";
                    } else {
                        errorMessageDiv.textContent = `Bir hata oluştu: ${err.message}`;
                    }
                }
                auth.signOut();
            }
        } else {
            showPage('login-page');
            pageInitialized = false; userDocRef = null;
            if(autoRefreshTimer) clearInterval(autoRefreshTimer);
            if(reportsRefreshTimer) clearInterval(reportsRefreshTimer);
        }
    });
}
