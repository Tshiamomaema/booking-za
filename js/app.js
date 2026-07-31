/**
 * app.js - Handles UI interactions, rendering, and routing.
 */

const App = {
    currentView: 'view-dashboard',
    currentCustomer: null,
    chartInstance: null,

    init() {
        this.setupNavigation();
        this.setupTheme();
        this.renderAllViews();

        // Listen for resize to adjust view padding for mobile nav
        window.addEventListener('resize', this.adjustPadding.bind(this));
        this.adjustPadding();
    },

    adjustPadding() {
        const mainContent = document.getElementById('main-content');
        if (window.innerWidth < 768) { // md breakpoint in tailwind
            mainContent.classList.add('pb-16');
        } else {
            mainContent.classList.remove('pb-16');
        }
    },

    setupTheme() {
        const settings = Store.getSettings();
        if (settings.theme === 'dark' || (!('theme' in settings) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        const toggleTheme = () => {
            document.documentElement.classList.toggle('dark');
            const isDark = document.documentElement.classList.contains('dark');
            Store.saveSettings({ theme: isDark ? 'dark' : 'light' });
            this.renderSettings(); // Update settings view if active
            if(this.currentView === 'view-dashboard') this.renderDashboard(); // Update chart colors
        };

        // Remove old listeners to prevent duplicates if init is called again
        const mobileToggle = document.getElementById('theme-toggle-mobile');
        const desktopToggle = document.getElementById('theme-toggle-desktop');

        const newMobileToggle = mobileToggle.cloneNode(true);
        mobileToggle.parentNode.replaceChild(newMobileToggle, mobileToggle);
        newMobileToggle.addEventListener('click', toggleTheme);

        const newDesktopToggle = desktopToggle.cloneNode(true);
        desktopToggle.parentNode.replaceChild(newDesktopToggle, desktopToggle);
        newDesktopToggle.addEventListener('click', toggleTheme);
    },

    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            // Remove old listeners
            const newLink = link.cloneNode(true);
            link.parentNode.replaceChild(newLink, link);

            newLink.addEventListener('click', (e) => {
                e.preventDefault();
                const target = e.currentTarget.getAttribute('data-target');
                this.navigate(target);
            });
        });

        // Handle browser back button for customer details
        window.onpopstate = (e) => {
            if (e.state && e.state.view) {
                this.navigate(e.state.view, false);
            } else {
                this.navigate('view-dashboard', false);
            }
        };
    },

    navigate(viewId, pushState = true) {
        // Hide all views
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active-view');
            v.classList.add('hidden');
        });

        // Show target view
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.remove('hidden');
            targetView.classList.add('active-view');
        }

        // Update nav active states
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.getAttribute('data-target') === viewId) {
                link.classList.add('active', 'text-slate-900', 'dark:text-white');
                if(link.closest('#mobile-nav')) link.classList.remove('text-slate-400', 'dark:text-slate-500');
            } else {
                link.classList.remove('active', 'text-slate-900', 'dark:text-white');
                if(link.closest('#mobile-nav')) link.classList.add('text-slate-400', 'dark:text-slate-500');
            }
        });

        this.currentView = viewId;

        // Render specific view data if needed on enter
        if (viewId === 'view-dashboard') this.renderDashboard();
        if (viewId === 'view-customers') {
            this.currentCustomer = null;
            this.renderCustomers();
        }
        if (viewId === 'view-catalog') this.renderCatalog();
        if (viewId === 'view-settings') this.renderSettings();

        // History API
        if (pushState) {
            history.pushState({ view: viewId }, '', `#${viewId}`);
        }
    },

    renderAllViews() {
        this.renderDashboard();
        this.renderCustomers();
        this.renderCatalog();
        this.renderSettings();
    },

    // --- View: Dashboard ---
    renderDashboard() {
        const content = document.getElementById('dashboard-content');
        const stats = Store.getGlobalStats();

        let html = `
            <!-- Global Metrics -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
                <div class="bg-surface dark:bg-surfaceDark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sleek">
                    <h3 class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Total Outstanding</h3>
                    <div class="text-3xl font-bold text-danger tracking-tight">${Store.formatMoney(stats.totalOutstanding)}</div>
                    <div class="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium">From ${stats.debtorsCount} clients</div>
                </div>
                <div class="bg-surface dark:bg-surfaceDark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sleek">
                    <h3 class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Total Collected</h3>
                    <div class="text-3xl font-bold text-secondary tracking-tight">${Store.formatMoney(stats.totalCollected)}</div>
                    <div class="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium">All time</div>
                </div>
                <div class="bg-surface dark:bg-surfaceDark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sleek md:col-span-2 hidden md:block">
                    <h3 class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Total Sales Vol</h3>
                    <div class="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">${Store.formatMoney(stats.totalSales)}</div>
                    <div class="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium">Gross revenue</div>
                </div>
            </div>

            <!-- Chart Area -->
            <div class="bg-surface dark:bg-surfaceDark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sleek mb-10">
                <h3 class="text-sm font-semibold text-slate-900 dark:text-white mb-6">Revenue Breakdown</h3>
                <div class="relative h-64 w-full flex justify-center items-center">
                    <canvas id="dashboard-chart"></canvas>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 pb-10">
                <!-- Top Debtors -->
                <div>
                    <div class="flex items-center mb-4 px-1">
                        <div class="w-2 h-2 rounded-full bg-danger mr-2"></div>
                        <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Top Outstanding Accounts</h3>
                    </div>
                    <div class="bg-surface dark:bg-surfaceDark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sleek overflow-hidden">
        `;

        if (stats.topDebtors.length === 0) {
            html += `<div class="p-8 text-center text-slate-500 text-sm font-medium">All accounts settled.</div>`;
        } else {
            html += `<ul class="divide-y divide-slate-100 dark:divide-slate-800/50">`;
            stats.topDebtors.forEach((debtor, index) => {
                html += `
                    <li class="p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group" onclick="app.viewCustomerDetails('${debtor.id}')">
                        <div class="flex items-center">
                            <span class="text-slate-400 dark:text-slate-500 font-medium text-xs w-6">${index + 1}</span>
                            <span class="font-medium text-slate-900 dark:text-slate-200 group-hover:text-primary dark:group-hover:text-white transition-colors">${debtor.name}</span>
                        </div>
                        <span class="font-semibold text-danger">${Store.formatMoney(debtor.balance)}</span>
                    </li>
                `;
            });
            html += `</ul>`;
        }

        html += `
                    </div>
                </div>

                <!-- Overdue Orders -->
                <div>
                    <div class="flex items-center mb-4 px-1">
                        <div class="w-2 h-2 rounded-full bg-orange-500 mr-2"></div>
                        <h3 class="text-sm font-semibold text-slate-900 dark:text-white">Overdue Items</h3>
                    </div>
                    <div class="bg-surface dark:bg-surfaceDark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sleek overflow-hidden">
        `;

        if (stats.overdueOrders.length === 0) {
            html += `<div class="p-8 text-center text-slate-500 text-sm font-medium">No overdue items.</div>`;
        } else {
            html += `<ul class="divide-y divide-slate-100 dark:divide-slate-800/50">`;
            // Show only top 5 overdue to save space
            stats.overdueOrders.slice(0, 5).forEach(order => {
                html += `
                    <li class="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group" onclick="app.viewCustomerDetails('${order.customerId}')">
                        <div class="flex justify-between items-start mb-1.5">
                            <span class="font-medium text-slate-900 dark:text-slate-200 group-hover:text-primary dark:group-hover:text-white transition-colors">${order.customerName}</span>
                            <span class="font-semibold text-slate-900 dark:text-white">${Store.formatMoney(order.total)}</span>
                        </div>
                        <div class="flex justify-between items-center text-xs">
                            <span class="text-slate-500 dark:text-slate-400">${Store.formatDate(order.date)}</span>
                            <span class="text-orange-600 dark:text-orange-400 font-medium bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-md">Due ${Store.formatDate(order.dueDate)}</span>
                        </div>
                    </li>
                `;
            });
            html += `</ul>`;
            if (stats.overdueOrders.length > 5) {
                html += `<div class="p-3 text-center text-xs font-medium text-slate-500 bg-slate-50 dark:bg-slate-800/30">+ ${stats.overdueOrders.length - 5} more items</div>`;
            }
        }

        html += `
                    </div>
                </div>
            </div>
        `;

        content.innerHTML = html;
        this.renderChart(stats);
    },

    renderChart(stats) {
        const ctx = document.getElementById('dashboard-chart');
        if (!ctx) return;

        // Destroy existing chart if it exists to prevent memory leaks/glitches
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#94A3B8' : '#64748B'; // slate-400 : slate-500
        const borderColor = isDark ? '#1E293B' : '#FFFFFF';

        this.chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Collected', 'Outstanding'],
                datasets: [{
                    data: [stats.totalCollected, stats.totalOutstanding],
                    backgroundColor: [
                        '#059669', // Emerald 600
                        '#E11D48'  // Rose 600
                    ],
                    borderWidth: 4,
                    borderColor: borderColor,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: textColor,
                            font: { family: "'Inter', sans-serif", weight: '500', size: 12 },
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: isDark ? '#0F172A' : '#1E293B',
                        titleFont: { family: "'Inter', sans-serif", size: 13 },
                        bodyFont: { family: "'Inter', sans-serif", size: 13, weight: 'bold' },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += Store.formatMoney(context.parsed);
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    },

    // --- View: Customers ---
    renderCustomers(searchQuery = '') {
        const content = document.getElementById('customers-content');
        let customers = Store.getCustomers();

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            customers = customers.filter(c =>
                c.name.toLowerCase().includes(lowerQuery) ||
                (c.phone && c.phone.toLowerCase().includes(lowerQuery))
            );
        }

        // Sort by balance (highest first), then by name
        customers.sort((a, b) => {
            const balA = Store.getCustomerBalance(a);
            const balB = Store.getCustomerBalance(b);
            if (balB !== balA) return balB - balA;
            return a.name.localeCompare(b.name);
        });

        let html = `
            <div class="mb-8 relative">
                <span class="absolute inset-y-0 left-0 flex items-center pl-4">
                    <i class="fas fa-search text-slate-400"></i>
                </span>
                <input type="text" id="customer-search" placeholder="Search clients..." value="${searchQuery}"
                    class="w-full pl-11 pr-4 py-3 bg-surface dark:bg-surfaceDark border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-slate-500 shadow-sm transition-shadow placeholder-slate-400"
                    onkeyup="app.handleCustomerSearch(event)">
            </div>
        `;

        if (customers.length === 0) {
            html += `
                <div class="text-center py-16 px-4 bg-surface dark:bg-surfaceDark rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                    <i class="fas fa-users text-4xl text-slate-300 dark:text-slate-600 mb-4"></i>
                    <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-1">No clients found</h3>
                    <p class="text-slate-500 dark:text-slate-400 text-sm">Get started by adding your first client.</p>
                </div>
            `;
        } else {
            html += `<div class="bg-surface dark:bg-surfaceDark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sleek overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 pb-safe">`;
            customers.forEach(customer => {
                const balance = Store.getCustomerBalance(customer);
                const balanceClass = balance > 0 ? 'text-danger' : (balance < 0 ? 'text-secondary' : 'text-slate-400 dark:text-slate-500');

                html += `
                    <div class="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                         onclick="app.viewCustomerDetails('${customer.id}')">
                        <div>
                            <h3 class="font-semibold text-base text-slate-900 dark:text-slate-200 group-hover:text-primary dark:group-hover:text-white transition-colors tracking-tight">${customer.name}</h3>
                            <div class="flex items-center text-xs text-slate-500 dark:text-slate-400 mt-1 space-x-3">
                                <span>${customer.phone || 'No phone'}</span>
                                ${customer.notes ? '<span class="flex items-center"><i class="fas fa-align-left text-[10px] mr-1 opacity-70"></i> Note</span>' : ''}
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="font-bold text-lg tracking-tight ${balanceClass}">${Store.formatMoney(balance)}</div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        content.innerHTML = html;

        // Refocus search if it was active
        if (searchQuery) {
            const searchInput = document.getElementById('customer-search');
            if (searchInput) {
                searchInput.focus();
                // Move cursor to end
                const val = searchInput.value;
                searchInput.value = '';
                searchInput.value = val;
            }
        }
    },

    handleCustomerSearch(event) {
        this.renderCustomers(event.target.value);
    },

    showAddCustomerModal(customerId = null) {
        let customer = { name: '', phone: '', email: '', notes: '' };
        if (customerId) {
            customer = Store.getCustomer(customerId);
        }

        const html = `
            <div class="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                <h3 class="text-xl font-bold">${customerId ? 'Edit' : 'Add'} Customer</h3>
                <button onclick="App.closeModal()" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><i class="fas fa-times"></i></button>
            </div>
            <div class="p-4 space-y-4">
                <form id="customer-form" onsubmit="app.saveCustomer(event, '${customerId || ''}')">
                    <div class="mb-3">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                        <input type="text" id="cust-name" required value="${customer.name}" class="w-full p-2 border rounded-lg focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                    </div>
                    <div class="mb-3">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                        <input type="tel" id="cust-phone" value="${customer.phone || ''}" class="w-full p-2 border rounded-lg focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                    </div>
                    <div class="mb-3">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                        <input type="email" id="cust-email" value="${customer.email || ''}" class="w-full p-2 border rounded-lg focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                        <textarea id="cust-notes" rows="2" class="w-full p-2 border rounded-lg focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white">${customer.notes || ''}</textarea>
                    </div>
                    <div class="flex justify-end space-x-2">
                        <button type="button" onclick="App.closeModal()" class="px-4 py-2 border rounded-lg text-gray-700 dark:text-gray-300 dark:border-gray-600">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-indigo-700 shadow">Save</button>
                    </div>
                </form>
            </div>
        `;
        this.showModal(html);
    },

    saveCustomer(event, id) {
        event.preventDefault();
        const customer = {
            id: id || undefined,
            name: document.getElementById('cust-name').value.trim(),
            phone: document.getElementById('cust-phone').value.trim(),
            email: document.getElementById('cust-email').value.trim(),
            notes: document.getElementById('cust-notes').value.trim(),
        };

        if (id) {
            // Preserve existing orders/payments if editing
            const existing = Store.getCustomer(id);
            customer.orders = existing.orders;
            customer.payments = existing.payments;
        }

        const saved = Store.saveCustomer(customer);
        this.closeModal();

        if (this.currentView === 'view-customer-details' && this.currentCustomer && this.currentCustomer.id === saved.id) {
            this.viewCustomerDetails(saved.id);
        } else {
            this.renderCustomers();
            this.renderDashboard(); // Refresh stats
        }
    },

    // --- Customer Details Sub-view ---
    viewCustomerDetails(id) {
        this.currentCustomer = Store.getCustomer(id);
        if (!this.currentCustomer) return;

        document.getElementById('detail-customer-name').innerText = this.currentCustomer.name;
        const content = document.getElementById('customer-details-content');

        const balance = Store.getCustomerBalance(this.currentCustomer);
        const totalDebt = Store.getCustomerTotalDebt(this.currentCustomer);
        const totalPaid = Store.getCustomerTotalPaid(this.currentCustomer);
        const balanceClass = balance > 0 ? 'text-danger' : (balance < 0 ? 'text-secondary' : 'text-slate-900 dark:text-white');

        let html = `
            <!-- Summary Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div class="bg-surface dark:bg-surfaceDark p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sleek relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1 h-full ${balance > 0 ? 'bg-danger' : 'bg-slate-300 dark:bg-slate-600'}"></div>
                    <div class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 pl-2">Total Owed</div>
                    <div class="font-bold text-2xl tracking-tight pl-2 ${balanceClass}">${Store.formatMoney(balance)}</div>
                </div>
                <div class="bg-surface dark:bg-surfaceDark p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sleek">
                    <div class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Total Ordered</div>
                    <div class="font-bold text-2xl tracking-tight text-slate-900 dark:text-white">${Store.formatMoney(totalDebt)}</div>
                </div>
                <div class="bg-surface dark:bg-surfaceDark p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sleek relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-1 h-full bg-secondary"></div>
                    <div class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 pl-2">Total Paid</div>
                    <div class="font-bold text-2xl tracking-tight text-secondary pl-2">${Store.formatMoney(totalPaid)}</div>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-col sm:flex-row gap-3 mb-10">
                <button onclick="app.showAddOrderModal('${id}')" class="flex-1 bg-primary hover:bg-primaryHover text-white py-3 rounded-xl text-sm font-semibold shadow-sm transition-colors flex justify-center items-center">
                    <i class="fas fa-file-invoice-dollar mr-2"></i> Add Debt
                </button>
                <button onclick="app.showAddPaymentModal('${id}')" class="flex-1 bg-secondary hover:bg-emerald-700 text-white py-3 rounded-xl text-sm font-semibold shadow-sm transition-colors flex justify-center items-center">
                    <i class="fas fa-hand-holding-dollar mr-2"></i> Record Payment
                </button>
                <button onclick="app.showAddCustomerModal('${id}')" class="bg-surface dark:bg-surfaceDark border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 px-5 py-3 rounded-xl text-sm font-semibold shadow-sm transition-colors flex justify-center items-center sm:w-auto">
                    <i class="fas fa-edit mr-2"></i> Edit
                </button>
            </div>

            <!-- Tabs -->
            <div class="border-b border-slate-200 dark:border-slate-800 mb-6">
                <ul class="flex text-sm font-medium">
                    <li class="mr-6">
                        <a href="#" class="inline-block py-3 border-b-2 border-primary text-slate-900 dark:border-white dark:text-white active" id="tab-orders" onclick="app.switchCustomerTab('orders', event)">History & Debts</a>
                    </li>
                    <li class="mr-6">
                        <a href="#" class="inline-block py-3 border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition-colors" id="tab-payments" onclick="app.switchCustomerTab('payments', event)">Payments</a>
                    </li>
                </ul>
            </div>

            <!-- Tab Content: Orders -->
            <div id="content-orders" class="space-y-4 pb-10">
        `;

        if (!this.currentCustomer.orders || this.currentCustomer.orders.length === 0) {
            html += `<div class="text-center py-12 text-slate-500 text-sm font-medium">No history recorded yet.</div>`;
        } else {
            // Sort orders newest first
            const sortedOrders = [...this.currentCustomer.orders].sort((a, b) => new Date(b.date) - new Date(a.date));

            sortedOrders.forEach(order => {
                const total = Store.calculateOrderTotal(order);
                const isOverdue = order.dueDate && new Date(order.dueDate) < new Date(new Date().setHours(0,0,0,0));

                html += `
                    <div class="bg-surface dark:bg-surfaceDark p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sleek relative overflow-hidden group">
                        <div class="flex justify-between items-start mb-4">
                            <div>
                                <div class="font-semibold text-slate-900 dark:text-white text-sm">${Store.formatDate(order.date)}</div>
                                ${order.dueDate ? `<div class="text-[11px] font-medium mt-1 ${isOverdue ? 'text-danger bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded' : 'text-slate-500'}">Due: ${Store.formatDate(order.dueDate)}</div>` : ''}
                            </div>
                            <div class="font-bold text-lg tracking-tight text-slate-900 dark:text-white">${Store.formatMoney(total)}</div>
                        </div>
                        <div class="border-t border-slate-100 dark:border-slate-800/50 pt-3 space-y-2">
                `;

                order.items.forEach(item => {
                    html += `
                        <div class="flex justify-between text-sm">
                            <span class="text-slate-600 dark:text-slate-400 font-medium">${item.quantity}<span class="text-slate-400 mx-1">x</span>${item.name}</span>
                            <span class="text-slate-900 dark:text-slate-300 font-medium">${Store.formatMoney(item.quantity * item.price)}</span>
                        </div>
                    `;
                });

                html += `
                        </div>
                        <div class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end bg-surface/90 dark:bg-surfaceDark/90 backdrop-blur-sm pl-4 pb-2 -mt-1 -mr-1">
                             <button onclick="app.deleteOrder('${id}', '${order.id}')" class="text-slate-400 hover:text-danger text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded transition-colors"><i class="fas fa-trash mr-1"></i> Delete</button>
                        </div>
                    </div>
                `;
            });
        }

        html += `</div>`; // End orders content

        // Tab Content: Payments
        html += `<div id="content-payments" class="space-y-4 pb-10 hidden">`;

        if (!this.currentCustomer.payments || this.currentCustomer.payments.length === 0) {
            html += `<div class="text-center py-12 text-slate-500 text-sm font-medium">No payments recorded yet.</div>`;
        } else {
            const sortedPayments = [...this.currentCustomer.payments].sort((a, b) => new Date(b.date) - new Date(a.date));

            sortedPayments.forEach(payment => {
                html += `
                    <div class="bg-surface dark:bg-surfaceDark p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sleek flex justify-between items-center group relative overflow-hidden">
                        <div class="flex items-center">
                            <div class="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-secondary flex items-center justify-center mr-4">
                                <i class="fas fa-check"></i>
                            </div>
                            <div>
                                <div class="font-semibold text-slate-900 dark:text-white text-sm">${Store.formatDate(payment.date)}</div>
                                <div class="text-xs font-medium text-slate-500 mt-0.5">Payment received</div>
                            </div>
                        </div>
                        <div class="flex items-center">
                            <div class="font-bold text-secondary text-lg tracking-tight group-hover:mr-10 transition-all">+${Store.formatMoney(payment.amount)}</div>
                            <button onclick="app.deletePayment('${id}', '${payment.id}')" class="absolute right-4 text-slate-400 hover:text-danger opacity-0 group-hover:opacity-100 transition-all p-2 rounded"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
            });
        }

        html += `
            </div>

            <!-- Danger Zone -->
            <div class="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 pb-safe">
                <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Danger Zone</h4>
                <button onclick="app.confirmDeleteCustomer('${id}')" class="w-full py-3 border border-danger/30 text-danger rounded-xl text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                    Delete Client & All Records
                </button>
            </div>
        `;

        content.innerHTML = html;
        this.navigate('view-customer-details');
    },

    switchCustomerTab(tabName, event) {
        event?.preventDefault();

        // Reset tabs
        const tabs = ['orders', 'payments'];
        tabs.forEach(t => {
            const el = document.getElementById(`tab-${t}`);
            const content = document.getElementById(`content-${t}`);
            if(el) {
                el.classList.remove('border-primary', 'text-slate-900', 'dark:border-white', 'dark:text-white', 'active');
                el.classList.add('border-transparent', 'text-slate-500', 'hover:text-slate-700', 'dark:text-slate-400', 'dark:hover:text-slate-300');
            }
            if(content) content.classList.add('hidden');
        });

        // Activate selected
        const activeTab = document.getElementById(`tab-${tabName}`);
        const activeContent = document.getElementById(`content-${tabName}`);
        if(activeTab) {
            activeTab.classList.add('border-primary', 'text-slate-900', 'dark:border-white', 'dark:text-white', 'active');
            activeTab.classList.remove('border-transparent', 'text-slate-500', 'hover:text-slate-700', 'dark:text-slate-400', 'dark:hover:text-slate-300');
        }
        if(activeContent) activeContent.classList.remove('hidden');
    },

    // --- Orders & Payments ---

    showAddOrderModal(customerId) {
        const today = new Date().toISOString().split('T')[0];
        const products = Store.getProducts();

        if (products.length === 0) {
             const html = `
                <div class="p-10 text-center space-y-4">
                    <div class="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-box-open text-2xl text-slate-400"></i>
                    </div>
                    <h3 class="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Catalog is Empty</h3>
                    <p class="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto">You must add products to your catalog before you can record a debt.</p>
                    <div class="flex justify-center space-x-3 mt-8">
                        <button onclick="App.closeModal()" class="px-5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Close</button>
                        <button onclick="App.closeModal(); app.navigate('view-catalog')" class="px-5 py-2.5 bg-primary hover:bg-primaryHover text-white rounded-xl text-sm font-semibold shadow-sm transition-colors">Go to Catalog</button>
                    </div>
                </div>
            `;
            this.showModal(html);
            return;
        }

        let productOptions = '<option value="" disabled selected>Select a product...</option>';
        products.forEach(p => {
            productOptions += `<option value='${JSON.stringify(p)}'>${p.name} - ${Store.formatMoney(p.price)}</option>`;
        });

        const html = `
            <div class="p-6 border-b border-slate-100 dark:border-slate-800/50 flex justify-between items-center">
                <h3 class="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Add Debt</h3>
                <button onclick="App.closeModal()" class="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><i class="fas fa-times"></i></button>
            </div>
            <div class="p-6">
                <form id="order-form" onsubmit="app.saveOrder(event, '${customerId}')" class="space-y-6">
                    <div class="grid grid-cols-2 gap-5">
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Date *</label>
                            <input type="date" id="order-date" required value="${today}" class="input-base">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Due Date</label>
                            <input type="date" id="order-due-date" class="input-base">
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Items from Catalog</label>
                        <div id="order-items-container" class="space-y-3">
                            <!-- First Item -->
                            <div class="flex gap-3 items-start order-item-row">
                                <select required class="item-select flex-grow input-base py-2.5" onchange="app.updateOrderTotalPreview()">
                                    ${productOptions}
                                </select>
                                <input type="number" placeholder="Qty" required min="1" step="1" value="1" class="item-qty w-24 input-base py-2.5 text-center" oninput="app.updateOrderTotalPreview()">
                            </div>
                        </div>
                        <button type="button" onclick="app.addOrderItemRow()" class="mt-4 text-sm font-semibold text-primary dark:text-white hover:text-primaryHover opacity-90 transition-colors flex items-center"><i class="fas fa-plus-circle mr-1.5"></i> Add another product</button>
                    </div>

                    <div class="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl flex justify-between items-center border border-slate-100 dark:border-slate-800 mt-2">
                        <span class="font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-widest text-xs">Total Amount</span>
                        <span class="font-bold text-2xl text-slate-900 dark:text-white tracking-tight" id="order-total-preview">${Store.getSettings().currency}0.00</span>
                    </div>

                    <div class="flex justify-end space-x-3 pt-2">
                        <button type="button" onclick="App.closeModal()" class="px-5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                        <button type="submit" class="px-5 py-2.5 bg-primary hover:bg-primaryHover text-white rounded-xl text-sm font-semibold shadow-sm transition-colors">Save Debt</button>
                    </div>
                </form>
            </div>
        `;
        this.showModal(html);
    },

    addOrderItemRow() {
        const products = Store.getProducts();
        let productOptions = '<option value="" disabled selected>Select a product...</option>';
        products.forEach(p => {
            productOptions += `<option value='${JSON.stringify(p)}'>${p.name} - ${Store.formatMoney(p.price)}</option>`;
        });

        const container = document.getElementById('order-items-container');
        const div = document.createElement('div');
        div.className = 'flex gap-3 items-start order-item-row mt-3';
        div.innerHTML = `
            <select required class="item-select flex-grow input-base py-2.5" onchange="app.updateOrderTotalPreview()">
                ${productOptions}
            </select>
            <input type="number" placeholder="Qty" required min="1" step="1" value="1" class="item-qty w-24 input-base py-2.5 text-center" oninput="app.updateOrderTotalPreview()">
            <button type="button" onclick="this.parentElement.remove(); app.updateOrderTotalPreview();" class="text-slate-400 hover:text-danger p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><i class="fas fa-times"></i></button>
        `;
        container.appendChild(div);
    },

    updateOrderTotalPreview() {
        const rows = document.querySelectorAll('.order-item-row');
        let total = 0;
        rows.forEach(row => {
            const select = row.querySelector('.item-select');
            if (select.value) {
                const product = JSON.parse(select.value);
                const qty = parseInt(row.querySelector('.item-qty').value, 10) || 0;
                total += qty * product.price;
            }
        });
        document.getElementById('order-total-preview').innerText = Store.formatMoney(total);
    },

    saveOrder(event, customerId) {
        event.preventDefault();
        const customer = Store.getCustomer(customerId);
        if (!customer) return;

        const rows = document.querySelectorAll('.order-item-row');
        const items = [];
        rows.forEach(row => {
            const select = row.querySelector('.item-select');
            if (select.value) {
                const product = JSON.parse(select.value);
                const qty = parseInt(row.querySelector('.item-qty').value, 10) || 1;
                items.push({
                    name: product.name,
                    quantity: qty,
                    price: product.price
                });
            }
        });

        if (items.length === 0) {
            alert('Please select at least one product.');
            return;
        }

        const order = {
            id: Store.generateId(),
            date: document.getElementById('order-date').value,
            dueDate: document.getElementById('order-due-date').value || null,
            items: items
        };

        if (!customer.orders) customer.orders = [];
        customer.orders.push(order);

        Store.saveCustomer(customer);
        this.closeModal();
        this.viewCustomerDetails(customerId); // Refresh view
        this.renderDashboard(); // Refresh stats
    },

    deleteOrder(customerId, orderId) {
        if (!confirm('Are you sure you want to delete this order?')) return;

        const customer = Store.getCustomer(customerId);
        if (customer && customer.orders) {
            customer.orders = customer.orders.filter(o => o.id !== orderId);
            Store.saveCustomer(customer);
            this.viewCustomerDetails(customerId);
            this.renderDashboard();
        }
    },

    showAddPaymentModal(customerId) {
        const today = new Date().toISOString().split('T')[0];
        const customer = Store.getCustomer(customerId);
        const balance = Store.getCustomerBalance(customer);

        const html = `
            <div class="p-6 border-b border-slate-100 dark:border-slate-800/50 flex justify-between items-center">
                <h3 class="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Record Payment</h3>
                <button onclick="App.closeModal()" class="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><i class="fas fa-times"></i></button>
            </div>
            <div class="p-6">
                <div class="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl flex justify-between items-center border border-slate-100 dark:border-slate-800 mb-6">
                    <span class="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-xs">Current Balance</span>
                    <span class="font-bold text-xl tracking-tight ${balance > 0 ? 'text-danger' : 'text-slate-900 dark:text-white'}">${Store.formatMoney(balance)}</span>
                </div>
                <form id="payment-form" onsubmit="app.savePayment(event, '${customerId}')" class="space-y-5">
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Amount Received *</label>
                        <div class="relative">
                            <span class="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 font-semibold">${Store.getSettings().currency}</span>
                            <input type="number" id="pay-amount" required min="0.01" step="0.01" value="${balance > 0 ? balance : ''}"
                                class="input-base pl-10 font-medium">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Date *</label>
                        <input type="date" id="pay-date" required value="${today}" class="input-base">
                    </div>
                    <div class="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800/50 mt-2">
                        <button type="button" onclick="App.closeModal()" class="px-5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                        <button type="submit" class="px-5 py-2.5 bg-secondary hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors">Save Payment</button>
                    </div>
                </form>
            </div>
        `;
        this.showModal(html);
    },

    savePayment(event, customerId) {
        event.preventDefault();
        const customer = Store.getCustomer(customerId);
        if (!customer) return;

        const payment = {
            id: Store.generateId(),
            amount: parseFloat(document.getElementById('pay-amount').value),
            date: document.getElementById('pay-date').value,
            note: ''
        };

        if (!customer.payments) customer.payments = [];
        customer.payments.push(payment);

        Store.saveCustomer(customer);
        this.closeModal();
        this.viewCustomerDetails(customerId);
        this.switchCustomerTab('payments'); // Show payment tab automatically
        this.renderDashboard();
    },

    deletePayment(customerId, paymentId) {
        if (!confirm('Are you sure you want to delete this payment record?')) return;

        const customer = Store.getCustomer(customerId);
        if (customer && customer.payments) {
            customer.payments = customer.payments.filter(p => p.id !== paymentId);
            Store.saveCustomer(customer);
            this.viewCustomerDetails(customerId);
            this.switchCustomerTab('payments');
            this.renderDashboard();
        }
    },

    confirmDeleteCustomer(id) {
        if (confirm('WARNING: Are you absolutely sure you want to delete this customer and ALL of their orders and payments? This cannot be undone.')) {
            Store.deleteCustomer(id);
            this.navigate('view-customers');
            this.renderDashboard();
        }
    },

    // --- View: Catalog ---
    renderCatalog() {
        const content = document.getElementById('catalog-content');
        const products = Store.getProducts();

        let html = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">`;

        if (products.length === 0) {
            html += `
                <div class="col-span-full text-center py-16 px-4 bg-surface dark:bg-surfaceDark rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                    <i class="fas fa-box-open text-4xl text-slate-300 dark:text-slate-600 mb-4"></i>
                    <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-1">Catalog is empty</h3>
                    <p class="text-slate-500 dark:text-slate-400 text-sm">Add frequently sold products to speed up debt entry.</p>
                </div>
            `;
        } else {
            products.forEach(product => {
                html += `
                    <div class="bg-surface dark:bg-surfaceDark p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sleek flex flex-col justify-between group">
                        <div class="mb-4">
                            <h3 class="font-semibold text-lg text-slate-900 dark:text-slate-200 tracking-tight">${product.name}</h3>
                            <div class="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mt-2">${Store.formatMoney(product.price)}</div>
                        </div>
                        <div class="flex justify-end space-x-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/50 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="app.showAddProductModal('${product.id}')" class="text-slate-400 hover:text-primary dark:hover:text-white p-2 transition-colors"><i class="fas fa-edit"></i></button>
                            <button onclick="app.deleteProduct('${product.id}')" class="text-slate-400 hover:text-danger p-2 transition-colors"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
            });
        }

        html += `</div>`;
        content.innerHTML = html;
    },

    showAddProductModal(productId = null) {
        let product = { name: '', price: '' };
        if (productId) {
            const products = Store.getProducts();
            product = products.find(p => p.id === productId) || product;
        }

        const html = `
            <div class="p-6 border-b border-slate-100 dark:border-slate-800/50 flex justify-between items-center">
                <h3 class="text-xl font-bold text-slate-900 dark:text-white tracking-tight">${productId ? 'Edit' : 'Add'} Product</h3>
                <button onclick="App.closeModal()" class="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><i class="fas fa-times"></i></button>
            </div>
            <div class="p-6">
                <form onsubmit="app.saveProduct(event, '${productId || ''}')" class="space-y-5">
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Product Name *</label>
                        <input type="text" id="prod-name" required value="${product.name}" class="input-base">
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Default Price *</label>
                        <div class="relative">
                            <span class="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 font-semibold">${Store.getSettings().currency}</span>
                            <input type="number" id="prod-price" required min="0" step="0.01" value="${product.price}"
                                class="input-base pl-10 font-medium">
                        </div>
                    </div>
                    <div class="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800/50 mt-2">
                        <button type="button" onclick="App.closeModal()" class="px-5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                        <button type="submit" class="px-5 py-2.5 bg-primary hover:bg-primaryHover text-white rounded-xl text-sm font-semibold shadow-sm transition-colors">Save Product</button>
                    </div>
                </form>
            </div>
        `;
        this.showModal(html);
    },

    saveProduct(event, id) {
        event.preventDefault();
        const product = {
            id: id || undefined,
            name: document.getElementById('prod-name').value.trim(),
            price: parseFloat(document.getElementById('prod-price').value)
        };

        Store.saveProduct(product);
        this.closeModal();
        this.renderCatalog();
    },

    deleteProduct(id) {
        if(confirm('Delete this product from the catalog?')) {
            Store.deleteProduct(id);
            this.renderCatalog();
        }
    },

    // --- View: Settings ---
    renderSettings() {
        const content = document.getElementById('settings-content');
        const settings = Store.getSettings();
        const isDark = document.documentElement.classList.contains('dark');

        const html = `
            <div class="space-y-8 pb-10">
                <!-- Preferences -->
                <div class="bg-surface dark:bg-surfaceDark p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sleek">
                    <h3 class="text-sm font-semibold text-slate-900 dark:text-white mb-6 uppercase tracking-widest text-slate-500">Preferences</h3>

                    <div class="flex items-center justify-between mb-6 pb-6 border-b border-slate-100 dark:border-slate-800/50">
                        <div>
                            <div class="font-medium text-slate-900 dark:text-slate-200">Currency Symbol</div>
                            <div class="text-sm text-slate-500 dark:text-slate-400 mt-1">Used for all monetary displays</div>
                        </div>
                        <input type="text" id="setting-currency" value="${settings.currency}" maxlength="5" class="w-20 text-center input-base font-semibold" onchange="app.saveSetting('currency', this.value)">
                    </div>

                    <div class="flex items-center justify-between">
                        <div>
                            <div class="font-medium text-slate-900 dark:text-slate-200">Dark Mode</div>
                            <div class="text-sm text-slate-500 dark:text-slate-400 mt-1">Toggle dark theme appearance</div>
                        </div>
                        <button onclick="document.getElementById('theme-toggle-mobile').click()" class="relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${isDark ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}">
                            <span class="inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${isDark ? 'translate-x-6' : 'translate-x-1'}"></span>
                        </button>
                    </div>
                </div>

                <!-- Data Management -->
                <div class="bg-surface dark:bg-surfaceDark p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sleek">
                    <h3 class="text-sm font-semibold text-slate-900 dark:text-white mb-4 uppercase tracking-widest text-slate-500">Data Backup</h3>
                    <p class="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                        Your data is stored locally in this browser. Export it regularly to maintain a secure backup.
                    </p>

                    <div class="flex flex-col sm:flex-row gap-3">
                        <button onclick="app.exportData()" class="flex-1 bg-surface dark:bg-surfaceDark border border-slate-200 dark:border-slate-700 py-3 rounded-xl text-sm font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm flex items-center justify-center">
                            <i class="fas fa-download mr-2 text-slate-400"></i> Export JSON
                        </button>
                        <button onclick="document.getElementById('import-file').click()" class="flex-1 bg-surface dark:bg-surfaceDark border border-slate-200 dark:border-slate-700 py-3 rounded-xl text-sm font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm flex items-center justify-center">
                            <i class="fas fa-upload mr-2 text-slate-400"></i> Import JSON
                        </button>
                        <input type="file" id="import-file" class="hidden" accept=".json" onchange="app.importData(event)">
                    </div>
                </div>
            </div>
        `;
        content.innerHTML = html;
    },

    saveSetting(key, value) {
        Store.saveSettings({ [key]: value });
        this.renderAllViews(); // Re-render to apply currency changes immediately
    },

    exportData() {
        const dataStr = Store.exportData();
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

        const exportFileDefaultName = `debt-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    },

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const contents = e.target.result;
            if (confirm('Are you sure you want to import data? This will overwrite your current local data.')) {
                if (Store.importData(contents)) {
                    alert('Data imported successfully!');
                    this.renderAllViews();
                } else {
                    alert('Failed to import data. Please ensure the file is valid JSON.');
                }
            }
            // reset file input
            event.target.value = '';
        };
        reader.readAsText(file);
    },

    // --- Modals Base ---
    showModal(contentHtml) {
        const container = document.getElementById('modals-container');
        container.innerHTML = `
            <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity modal-overlay" onclick="App.closeModal()"></div>
                <div class="bg-surface dark:bg-surfaceDark rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative z-10 modal-content border border-slate-200 dark:border-slate-800">
                    ${contentHtml}
                </div>
            </div>
        `;
    },

    closeModal() {
        document.getElementById('modals-container').innerHTML = '';
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => {
    App.init();

    // Initial route check
    const hash = window.location.hash.substring(1);
    if (hash && document.getElementById(hash)) {
        App.navigate(hash);
    } else {
        App.navigate('view-dashboard');
    }
});

// For easier console/onclick access
window.app = App;
