document.addEventListener('DOMContentLoaded', () => {

    // --- Navigation Logic ---
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');
    const pageTitle = document.querySelector('.welcome-text'); // Dynamically update this if needed

    navItems.forEach(item => {
        item.addEventListener('click', function () {
            const targetId = this.dataset.target;

            // If no target (e.g. settings/help/logout which might differ), ignore or handle
            if (!targetId) return;

            // Remove active classes
            navItems.forEach(n => n.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            // Add active class
            this.classList.add('active');
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
            }
        });
    });

    // --- Chart.js: Market Overview ---
    // Simulating the specific Purple/Black Candlestick-ish look using a Bar Chart 
    // where we color bars based on Up/Down to mimic the provided image style.
    // Since true candles are complex in vanilla Chart.js, we will use a refined Bar Chart 
    // that looks like volume/price movement with the requested color palette.

    // Updated Chart Config for Dark Blue Theme
    const ctx = document.getElementById('mainChart');
    if (ctx) {
        const chartCtx = ctx.getContext('2d');

        // Exact Blue from the image approximation
        const mainColor = '#60a5fa'; // Bright Blue

        let fillGradient = chartCtx.createLinearGradient(0, 0, 0, 400);
        fillGradient.addColorStop(0, 'rgba(56, 189, 248, 0.2)');
        fillGradient.addColorStop(1, 'rgba(56, 189, 248, 0.05)');

        new Chart(chartCtx, {
            type: 'line',
            data: {
                labels: ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '1:00', '1:30', '2:00', '2:30', '3:00'],
                datasets: [{
                    label: 'NABIL',
                    // Data points mimicking the curve in the image (dip then rise)
                    data: [1210, 1215, 1205, 1212, 1220, 1245, 1232, 1248, 1255, 1248, 1265],
                    borderColor: '#60a5fa', // Solid bright blue
                    backgroundColor: fillGradient,
                    borderWidth: 3,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#ffffff',
                    pointHoverBorderColor: '#60a5fa',
                    pointHoverBorderWidth: 3,
                    fill: true,
                    tension: 0.5 // High tension for very smooth "fluid" curves
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#ffffff',
                        titleColor: '#1e293b',
                        bodyColor: '#64748b',
                        borderColor: '#e2e8f0',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        callbacks: {
                            label: function (context) {
                                return 'Price: Rs. ' + context.parsed.y;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: true,
                            color: '#f1f5f9', // Very subtle grid
                        },
                        ticks: { color: '#94a3b8', font: { size: 11 } }
                    },
                    y: {
                        position: 'right',
                        grid: {
                            color: '#f1f5f9',
                        },
                        ticks: { color: '#94a3b8', font: { size: 11 } }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });

        // Expose chart instance globally if we need to update it
        window.mainChartInstance = Chart.getChart(chartCtx);
    }

    // --- Profile Dropdown Logic ---
    const profileTrigger = document.getElementById('profileTrigger');
    const profileDropdown = document.getElementById('profileDropdown');
    const profileContainer = document.querySelector('.user-profile-container');

    if (profileTrigger && profileDropdown) {
        profileTrigger.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubble
            profileDropdown.classList.toggle('active');
            profileContainer.classList.toggle('active');
        });

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!profileContainer.contains(e.target)) {
                profileDropdown.classList.remove('active');
                profileContainer.classList.remove('active');
            }
        });
    }

    // --- Theme Toggle Logic ---
    const themeToggle = document.getElementById('themeToggle');
    // Check local storage or preference
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeToggle) themeToggle.checked = true;
        updateChartTheme(true);
    }

    if (themeToggle) {
        themeToggle.addEventListener('change', function () {
            if (this.checked) {
                document.body.classList.add('dark-mode');
                localStorage.setItem('theme', 'dark');
                updateChartTheme(true);
            } else {
                document.body.classList.remove('dark-mode');
                localStorage.setItem('theme', 'light');
                updateChartTheme(false);
            }
        });
    }

    function updateChartTheme(isDark) {
        const chart = Chart.getChart('mainChart'); // Get instance
        if (!chart) return;

        if (isDark) {
            chart.options.scales.x.grid.color = 'rgba(255, 255, 255, 0.05)';
            chart.options.scales.y.grid.color = 'rgba(255, 255, 255, 0.05)';
            chart.options.scales.x.ticks.color = '#94a3b8';
            chart.options.scales.y.ticks.color = '#94a3b8';
            chart.options.plugins.tooltip.backgroundColor = '#1e293b';
            chart.options.plugins.tooltip.titleColor = '#f8fafc';
            chart.options.plugins.tooltip.bodyColor = '#cbd5e1';
            chart.options.plugins.tooltip.borderColor = '#334155';
        } else {
            // Revert to Light Mode defaults
            chart.options.scales.x.grid.color = '#f1f5f9';
            chart.options.scales.y.grid.color = '#f1f5f9';
            chart.options.scales.x.ticks.color = '#94a3b8';
            chart.options.scales.y.ticks.color = '#94a3b8';
            chart.options.plugins.tooltip.backgroundColor = '#ffffff';
            chart.options.plugins.tooltip.titleColor = '#1e293b';
            chart.options.plugins.tooltip.bodyColor = '#64748b';
            chart.options.plugins.tooltip.borderColor = '#e2e8f0';
        }
        chart.update();
    }
});
