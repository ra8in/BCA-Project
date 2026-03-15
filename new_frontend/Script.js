document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const themeToggle = document.getElementById('theme-toggle');
    const settingThemeToggle = document.querySelector('.setting-theme-toggle');
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    const sectionTitle = document.getElementById('section-title');
    const contentSections = document.querySelectorAll('.content-section');

    // Sidebar Toggling Logic (YouTube Style)
    sidebarToggle.addEventListener('click', () => {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            sidebar.classList.toggle('open');
            // Remove collapsed class if it was set on desktop
            sidebar.classList.remove('collapsed');
        } else {
            sidebar.classList.toggle('collapsed');
            // Remove open class if it was set on mobile
            sidebar.classList.remove('open');
        }
    });

    // Close sidebar on mobile when clicking outside or on a link
    document.addEventListener('click', (e) => {
        const isMobile = window.innerWidth <= 768;
        if (isMobile && sidebar.classList.contains('open')) {
            if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });

    // Theme Switching
    const applyTheme = (theme) => {
        document.body.className = theme;
        localStorage.setItem('theme', theme);
        themeToggle.checked = theme === 'dark-mode';
        if (settingThemeToggle) settingThemeToggle.checked = theme === 'dark-mode';
    };

    const savedTheme = localStorage.getItem('theme') || 'light-mode';
    applyTheme(savedTheme);

    themeToggle.addEventListener('change', () => {
        applyTheme(themeToggle.checked ? 'dark-mode' : 'light-mode');
    });

    if (settingThemeToggle) {
        settingThemeToggle.addEventListener('change', () => {
            applyTheme(settingThemeToggle.checked ? 'dark-mode' : 'light-mode');
        });
    }

    // Section Switching Logic
    function switchToSection(sectionId) {
        // Update Active Nav Item
        navItems.forEach(i => {
            i.classList.remove('active');
            if (i.getAttribute('data-section') === sectionId) {
                i.classList.add('active');
                sectionTitle.textContent = i.querySelector('span').textContent;
            }
        });

        // Show Relevant Section
        contentSections.forEach(section => {
            section.classList.remove('active');
            if (section.id === sectionId) {
                section.classList.add('active');
            }
        });

        // Close sidebar on mobile after navigating
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('open');
        }

        // Scroll to top
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

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!profileTrigger.contains(e.target)) {
                profileTrigger.classList.remove('active');
                profileDropdown.classList.remove('show');
            }
        });

        // Dropdown Items Click (Switch Sections)
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
            // In a real app, we'd fetch data here. For now, we show the hardcoded ACLBSL section.
            switchToSection('stock-detail');

            // Update section title correctly
            sectionTitle.textContent = `${symbol} Details`;
        }

        // Buy/Sell buttons inside stock details
        if (e.target.classList.contains('btn-buy-stock') || e.target.classList.contains('btn-sell-stock')) {
            switchToSection('trading');
            const symbol = document.querySelector('.stock-symbol-title').textContent;

            // Auto-select in trading page
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

            // Auto-select symbol
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

    // Improved Calculator Logic
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

            // Toggle visibility of sell-specific fields
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
