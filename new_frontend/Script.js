document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const themeToggle = document.getElementById('theme-toggle');
    const settingsThemeToggle = document.getElementById('settings-theme-toggle');
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    const sectionTitle = document.getElementById('section-title');
    const contentSections = document.querySelectorAll('.content-section');

    // Sidebar Toggling Logic (YouTube Style)
    sidebarToggle.addEventListener('click', () => {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            sidebar.classList.toggle('open');
            sidebar.classList.remove('collapsed');
        } else {
            sidebar.classList.toggle('collapsed');
            sidebar.classList.remove('open');
        }
    });

    // Close sidebar on mobile when clicking outside
    document.addEventListener('click', (e) => {
        const isMobile = window.innerWidth <= 768;
        if (isMobile && sidebar.classList.contains('open')) {
            if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });

    // =============================================
    // Theme Switching (synced: sidebar + settings)
    // =============================================
    const applyTheme = (theme) => {
        document.body.className = theme;
        localStorage.setItem('theme', theme);
        themeToggle.checked = theme === 'dark-mode';
        if (settingsThemeToggle) settingsThemeToggle.checked = theme === 'dark-mode';
    };

    const savedTheme = localStorage.getItem('theme') || 'light-mode';
    applyTheme(savedTheme);

    themeToggle.addEventListener('change', () => {
        applyTheme(themeToggle.checked ? 'dark-mode' : 'light-mode');
    });

    if (settingsThemeToggle) {
        settingsThemeToggle.addEventListener('change', () => {
            applyTheme(settingsThemeToggle.checked ? 'dark-mode' : 'light-mode');
        });
    }

    // =============================================
    // Accent Color Picker
    // =============================================
    const colorPicker = document.getElementById('accent-color-picker');
    if (colorPicker) {
        const savedAccent = localStorage.getItem('accentColor');
        if (savedAccent) {
            document.documentElement.style.setProperty('--accent-blue', savedAccent);
            colorPicker.querySelectorAll('.color-option').forEach(opt => {
                opt.classList.toggle('active', opt.dataset.color === savedAccent);
            });
        }

        colorPicker.addEventListener('click', (e) => {
            const option = e.target.closest('.color-option');
            if (!option) return;

            const color = option.dataset.color;
            document.documentElement.style.setProperty('--accent-blue', color);
            localStorage.setItem('accentColor', color);

            colorPicker.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');
        });
    }

    // =============================================
    // Profile Edit Toggle
    // =============================================
    const editProfileBtn = document.getElementById('btn-edit-profile');
    if (editProfileBtn) {
        let isEditing = false;
        editProfileBtn.addEventListener('click', () => {
            isEditing = !isEditing;
            const editableFields = document.querySelectorAll('.profile-editable');
            editableFields.forEach(field => {
                field.contentEditable = isEditing ? 'true' : 'false';
            });
            editProfileBtn.innerHTML = isEditing
                ? '<i class="fas fa-save"></i> Save Profile'
                : '<i class="fas fa-edit"></i> Edit Profile';

            if (isEditing && editableFields.length > 0) {
                editableFields[0].focus();
            }
        });
    }

    // =============================================
    // Trading Broker Action Toggle
    // =============================================
    const capsuleToggle = document.getElementById('trade-capsule');
    if (capsuleToggle) {
        const btnSell = capsuleToggle.querySelector('.sell');
        const btnBuy = capsuleToggle.querySelector('.buy');
        const slider = capsuleToggle.querySelector('.capsule-slider');
        const actionBtn = document.getElementById('btn-broker-action');

        btnSell.addEventListener('click', () => {
            btnSell.classList.add('active');
            btnBuy.classList.remove('active');
            slider.style.transform = 'translateX(0)';
            slider.style.backgroundColor = 'var(--accent-red)';

            if (actionBtn) {
                actionBtn.textContent = 'SELL';
                actionBtn.classList.remove('buy');
                actionBtn.classList.add('sell');
            }
        });

        btnBuy.addEventListener('click', () => {
            btnBuy.classList.add('active');
            btnSell.classList.remove('active');
            slider.style.transform = 'translateX(100%)';
            slider.style.backgroundColor = 'var(--accent-blue)';

            if (actionBtn) {
                actionBtn.textContent = 'BUY';
                actionBtn.classList.remove('sell');
                actionBtn.classList.add('buy');
            }
        });

        // Initialize position
        slider.style.transform = 'translateX(100%)';
    }

    // =============================================
    // Section Switching Logic
    // =============================================
    function switchToSection(sectionId) {
        navItems.forEach(i => {
            i.classList.remove('active');
            if (i.getAttribute('data-section') === sectionId) {
                i.classList.add('active');
                sectionTitle.textContent = i.querySelector('span').textContent;
            }
        });

        contentSections.forEach(section => {
            section.classList.remove('active');
            if (section.id === sectionId) {
                section.classList.add('active');
            }
        });

        if (window.innerWidth <= 768) {
            sidebar.classList.remove('open');
        }

        window.scrollTo(0, 0);
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute('data-section');
            switchToSection(sectionId);
        });
    });

    // Profile Dropdown Toggle Logic
    const profileTrigger = document.getElementById('user-profile-trigger');
    const profileDropdown = document.getElementById('profile-dropdown');

    if (profileTrigger && profileDropdown) {
        profileTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            profileTrigger.classList.toggle('active');
            profileDropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!profileTrigger.contains(e.target)) {
                profileTrigger.classList.remove('active');
                profileDropdown.classList.remove('show');
            }
        });

        const dropdownItems = profileDropdown.querySelectorAll('.dropdown-item[data-section]');
        dropdownItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const sectionId = item.getAttribute('data-section');
                switchToSection(sectionId);
                profileTrigger.classList.remove('active');
                profileDropdown.classList.remove('show');
            });
        });
    }

    // Generic listener for symbol clicks to show details
    document.addEventListener('click', (e) => {
        const symbolEl = e.target.closest('.symbol-code');
        if (symbolEl) {
            const symbol = symbolEl.textContent;
            switchToSection('stock-detail');
            sectionTitle.textContent = `${symbol} Details`;
        }

        // Buy/Sell buttons inside stock details
        if (e.target.classList.contains('btn-buy-stock') || e.target.classList.contains('btn-sell-stock')) {
            switchToSection('trading');
            const symbol = document.querySelector('.stock-symbol-title').textContent;

            const tradeSelect = document.getElementById('trade-symbol');
            if (tradeSelect) {
                for (let option of tradeSelect.options) {
                    if (option.text.includes(symbol)) {
                        tradeSelect.value = option.value;
                        break;
                    }
                }
            }
        }
    });

    // Market "Trade" buttons (Buy/Sell in tables)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-buy') || e.target.classList.contains('btn-sell')) {
            const row = e.target.closest('tr');
            if (!row) return;
            const symbolEl = row.querySelector('.symbol-code');
            if (!symbolEl) return;
            const symbol = symbolEl.textContent;
            switchToSection('trading');

            const tradeSelect = document.getElementById('trade-symbol');
            if (tradeSelect) {
                for (let option of tradeSelect.options) {
                    if (option.text.includes(symbol)) {
                        tradeSelect.value = option.value;
                        break;
                    }
                }
            }
        }
    });

    // =============================================
    // Improved Calculator Logic
    // =============================================
    const calcBtn = document.getElementById('perform-calc');
    const calcTabs = document.querySelectorAll('.calc-tab');
    const sellFields = document.getElementById('sell-fields');
    const sellResultsOnly = document.getElementById('sell-results-only');
    let currentCalcType = 'buy';

    calcTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            calcTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentCalcType = tab.dataset.type;

            if (currentCalcType === 'sell') {
                sellFields.style.display = 'block';
                sellResultsOnly.style.display = 'block';
                document.getElementById('res-total-label').textContent = 'Net Receivable Amount';
                calcBtn.textContent = 'Calculate Net Profit';
                calcBtn.classList.replace('buy', 'sell');
            } else {
                sellFields.style.display = 'none';
                sellResultsOnly.style.display = 'none';
                document.getElementById('res-total-label').textContent = 'Total Payable Amount';
                calcBtn.textContent = 'Calculate Buy Cost';
                calcBtn.classList.replace('sell', 'buy');
            }
        });
    });

    if (calcBtn) {
        calcBtn.addEventListener('click', () => {
            const qty = parseFloat(document.getElementById('calc-qty').value);
            const price = parseFloat(document.getElementById('calc-buy-price').value);
            const resultsPlaceholder = document.querySelector('.result-placeholder');
            const actualResults = document.querySelector('.actual-results');

            if (isNaN(qty) || isNaN(price) || qty <= 0 || price <= 0) {
                alert('Please enter valid quantity and price');
                return;
            }

            resultsPlaceholder.style.display = 'none';
            actualResults.style.display = 'block';

            const shareAmount = qty * price;
            const brokerComm = calculateCommission(shareAmount);
            const sebonFee = shareAmount * 0.00015;
            const dpFee = 25;

            let total, cgt = 0;

            if (currentCalcType === 'buy') {
                total = shareAmount + brokerComm + sebonFee + dpFee;
                const costPerShare = total / qty;

                document.getElementById('res-share-amt').textContent = `Rs. ${shareAmount.toLocaleString()}`;
                document.getElementById('res-broker-fee').textContent = `Rs. ${brokerComm.toFixed(2)}`;
                document.getElementById('res-sebon-fee').textContent = `Rs. ${sebonFee.toFixed(2)}`;
                document.getElementById('res-dp-fee').textContent = `Rs. ${dpFee.toFixed(2)}`;
                document.getElementById('res-final-total').textContent = `Rs. ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                document.getElementById('res-avg-cost').textContent = `Rs. ${costPerShare.toFixed(2)}`;
            } else {
                const purchasePrice = parseFloat(document.getElementById('calc-purchase-price').value);
                total = shareAmount - brokerComm - sebonFee - dpFee;

                if (!isNaN(purchasePrice) && shareAmount > (purchasePrice * qty)) {
                    const profit = total - (purchasePrice * qty);
                    if (profit > 0) {
                        cgt = profit * 0.05; // 5% CGT
                        total -= cgt;
                    }
                }

                document.getElementById('res-share-amt').textContent = `Rs. ${shareAmount.toLocaleString()}`;
                document.getElementById('res-broker-fee').textContent = `Rs. ${brokerComm.toFixed(2)}`;
                document.getElementById('res-sebon-fee').textContent = `Rs. ${sebonFee.toFixed(2)}`;
                document.getElementById('res-cgt').textContent = `Rs. ${cgt.toFixed(2)}`;
                document.getElementById('res-final-total').textContent = `Rs. ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                document.getElementById('res-avg-cost').textContent = `Rs. ${(total / qty).toFixed(2)}`;
            }
        });
    }

    function calculateCommission(amt) {
        if (amt <= 50000) return Math.max(10, amt * 0.004);
        if (amt <= 500000) return amt * 0.0037;
        if (amt <= 2000000) return amt * 0.0034;
        return amt * 0.003;
    }
});
