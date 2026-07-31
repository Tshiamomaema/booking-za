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
                link.classList.add('active', 'text-primary', 'dark:text-indigo-400');
                if(link.closest('#mobile-nav')) link.classList.remove('text-gray-500', 'dark:text-gray-400');
            } else {
                link.classList.remove('active', 'text-primary', 'dark:text-indigo-400');
                if(link.closest('#mobile-nav')) link.classList.add('text-gray-500', 'dark:text-gray-400');
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
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Outstanding</h3>
                    <div class="text-2xl font-bold text-danger">${Store.formatMoney(stats.totalOutstanding)}</div>
                    <div class="text-xs text-gray-400 mt-1">From ${stats.debtorsCount} customers</div>
                </div>
                <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Collected</h3>
                    <div class="text-2xl font-bold text-secondary">${Store.formatMoney(stats.totalCollected)}</div>
                </div>
                <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 md:col-span-2 hidden md:block">
                    <h3 class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Sales (All Time)</h3>
                    <div class="text-2xl font-bold dark:text-white">${Store.formatMoney(stats.totalSales)}</div>
                </div>
            </div>

            <!-- Chart Area -->
            <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
                <h3 class="font-bold text-lg mb-4 dark:text-white">Revenue Overview</h3>
                <div class="relative h-48 w-full">
                    <canvas id="dashboard-chart"></canvas>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                <!-- Top Debtors -->
                <div>
                    <h3 class="font-bold text-lg mb-3 flex items-center dark:text-white">
                        <i class="fas fa-exclamation-circle text-danger mr-2"></i> Top Debtors
                    </h3>
                    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        `;

        if (stats.topDebtors.length === 0) {
            html += `<div class="p-4 text-center text-gray-500 text-sm">No outstanding debts. Great job!</div>`;
        } else {
            html += `<ul class="divide-y divide-gray-100 dark:divide-gray-700">`;
            stats.topDebtors.forEach((debtor, index) => {
                html += `
                    <li class="p-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onclick="app.viewCustomerDetails('${debtor.id}')">
                        <div class="flex items-center">
                            <span class="text-gray-400 font-mono text-sm w-5">${index + 1}.</span>
                            <span class="font-medium dark:text-gray-200">${debtor.name}</span>
                        </div>
                        <span class="font-bold text-danger">${Store.formatMoney(debtor.balance)}</span>
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
                    <h3 class="font-bold text-lg mb-3 flex items-center dark:text-white">
                        <i class="fas fa-clock text-orange-500 mr-2"></i> Overdue Debts
                    </h3>
                    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        `;

        if (stats.overdueOrders.length === 0) {
            html += `<div class="p-4 text-center text-gray-500 text-sm">No overdue debts found.</div>`;
        } else {
            html += `<ul class="divide-y divide-gray-100 dark:divide-gray-700">`;
            // Show only top 5 overdue to save space
            stats.overdueOrders.slice(0, 5).forEach(order => {
                html += `
                    <li class="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onclick="app.viewCustomerDetails('${order.customerId}')">
                        <div class="flex justify-between items-start mb-1">
                            <span class="font-medium dark:text-gray-200">${order.customerName}</span>
                            <span class="font-bold text-gray-800 dark:text-white">${Store.formatMoney(order.total)}</span>
                        </div>
                        <div class="flex justify-between items-center text-xs">
                            <span class="text-gray-500">Order: ${Store.formatDate(order.date)}</span>
                            <span class="text-danger font-medium bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">Due: ${Store.formatDate(order.dueDate)}</span>
                        </div>
                    </li>
                `;
            });
            html += `</ul>`;
            if (stats.overdueOrders.length > 5) {
                html += `<div class="p-2 text-center text-xs text-gray-500 bg-gray-50 dark:bg-gray-700/50">+ ${stats.overdueOrders.length - 5} more overdue</div>`;
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
        const textColor = isDark ? '#9CA3AF' : '#6B7280'; // gray-400 : gray-500

        this.chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Collected', 'Outstanding'],
                datasets: [{
                    data: [stats.totalCollected, stats.totalOutstanding],
                    backgroundColor: [
                        '#10B981', // Emerald 500 (Collected)
                        '#EF4444'  // Red 500 (Outstanding)
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: textColor }
                    },
                    tooltip: {
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
            <div class="mb-4">
                <div class="relative">
                    <span class="absolute inset-y-0 left-0 flex items-center pl-3">
                        <i class="fas fa-search text-gray-400"></i>
                    </span>
                    <input type="text" id="customer-search" placeholder="Search customers..." value="${searchQuery}"
                        class="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        onkeyup="app.handleCustomerSearch(event)">
                </div>
            </div>
            <div class="space-y-3 pb-4">
        `;

        if (customers.length === 0) {
            html += `<div class="text-center py-8 text-gray-500 dark:text-gray-400">No customers found. Click Add to create one.</div>`;
        } else {
            customers.forEach(customer => {
                const balance = Store.getCustomerBalance(customer);
                const balanceClass = balance > 0 ? 'text-danger' : (balance < 0 ? 'text-secondary' : 'text-gray-500');

                html += `
                    <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center cursor-pointer active:scale-[0.98] transition-transform"
                         onclick="app.viewCustomerDetails('${customer.id}')">
                        <div>
                            <h3 class="font-bold text-lg dark:text-gray-100">${customer.name}</h3>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${customer.phone || 'No phone'} ${customer.notes ? '&bull; <i class="fas fa-sticky-note"></i>' : ''}</p>
                        </div>
                        <div class="text-right">
                            <div class="font-bold text-lg ${balanceClass}">${Store.formatMoney(balance)}</div>
                            <div class="text-xs text-gray-400">Balance</div>
                        </div>
                    </div>
                `;
            });
        }

        html += `</div>`;
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
        const balanceClass = balance > 0 ? 'text-danger' : (balance < 0 ? 'text-secondary' : 'text-gray-800 dark:text-gray-100');

        let html = `
            <!-- Action Buttons -->
            <div class="flex space-x-2 mb-6">
                <button onclick="app.showAddOrderModal('${id}')" class="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-medium shadow flex flex-col items-center justify-center">
                    <i class="fas fa-file-invoice-dollar mb-1 text-lg"></i> Add Debt
                </button>
                <button onclick="app.showAddPaymentModal('${id}')" class="flex-1 bg-secondary text-white py-2 rounded-lg text-sm font-medium shadow flex flex-col items-center justify-center">
                    <i class="fas fa-hand-holding-dollar mb-1 text-lg"></i> Record Payment
                </button>
                <button onclick="app.showAddCustomerModal('${id}')" class="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 rounded-lg shadow flex flex-col items-center justify-center">
                    <i class="fas fa-edit mb-1"></i> Edit
                </button>
            </div>

            <!-- Summary Cards -->
            <div class="grid grid-cols-3 gap-2 mb-6">
                <div class="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                    <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total Owed</div>
                    <div class="font-bold ${balanceClass} text-sm sm:text-base">${Store.formatMoney(balance)}</div>
                </div>
                <div class="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                    <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total Orders</div>
                    <div class="font-bold text-gray-800 dark:text-gray-100 text-sm sm:text-base">${Store.formatMoney(totalDebt)}</div>
                </div>
                <div class="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                    <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total Paid</div>
                    <div class="font-bold text-secondary text-sm sm:text-base">${Store.formatMoney(totalPaid)}</div>
                </div>
            </div>

            <!-- Tabs -->
            <div class="border-b dark:border-gray-700 mb-4">
                <ul class="flex text-sm font-medium text-center text-gray-500 dark:text-gray-400">
                    <li class="mr-2">
                        <a href="#" class="inline-block p-4 text-primary border-b-2 border-primary rounded-t-lg active dark:text-indigo-400 dark:border-indigo-400" id="tab-orders" onclick="app.switchCustomerTab('orders', event)">Orders / Debts</a>
                    </li>
                    <li class="mr-2">
                        <a href="#" class="inline-block p-4 border-b-2 border-transparent rounded-t-lg hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300" id="tab-payments" onclick="app.switchCustomerTab('payments', event)">Payment History</a>
                    </li>
                </ul>
            </div>

            <!-- Tab Content: Orders -->
            <div id="content-orders" class="space-y-3 pb-8">
        `;

        if (!this.currentCustomer.orders || this.currentCustomer.orders.length === 0) {
            html += `<div class="text-center py-6 text-gray-500 text-sm">No orders recorded yet.</div>`;
        } else {
            // Sort orders newest first
            const sortedOrders = [...this.currentCustomer.orders].sort((a, b) => new Date(b.date) - new Date(a.date));

            sortedOrders.forEach(order => {
                const total = Store.calculateOrderTotal(order);
                const isOverdue = order.dueDate && new Date(order.dueDate) < new Date(new Date().setHours(0,0,0,0));

                html += `
                    <div class="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <div class="font-bold text-sm dark:text-gray-200">${Store.formatDate(order.date)}</div>
                                ${order.dueDate ? `<div class="text-xs ${isOverdue ? 'text-danger font-bold' : 'text-gray-500'}">Due: ${Store.formatDate(order.dueDate)}</div>` : ''}
                            </div>
                            <div class="font-bold text-lg dark:text-white">${Store.formatMoney(total)}</div>
                        </div>
                        <div class="border-t dark:border-gray-700 pt-2 mt-2 space-y-1">
                `;

                order.items.forEach(item => {
                    html += `
                        <div class="flex justify-between text-xs sm:text-sm">
                            <span class="text-gray-600 dark:text-gray-300">${item.quantity}x ${item.name}</span>
                            <span class="text-gray-800 dark:text-gray-200">${Store.formatMoney(item.quantity * item.price)}</span>
                        </div>
                    `;
                });

                html += `
                        </div>
                        <div class="flex justify-end mt-2 pt-2 border-t dark:border-gray-700">
                             <button onclick="app.deleteOrder('${id}', '${order.id}')" class="text-danger text-xs hover:underline"><i class="fas fa-trash"></i> Delete</button>
                        </div>
                    </div>
                `;
            });
        }

        html += `</div>`; // End orders content

        // Tab Content: Payments
        html += `<div id="content-payments" class="space-y-3 pb-8 hidden">`;

        if (!this.currentCustomer.payments || this.currentCustomer.payments.length === 0) {
            html += `<div class="text-center py-6 text-gray-500 text-sm">No payments recorded yet.</div>`;
        } else {
            const sortedPayments = [...this.currentCustomer.payments].sort((a, b) => new Date(b.date) - new Date(a.date));

            sortedPayments.forEach(payment => {
                html += `
                    <div class="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <div>
                            <div class="font-bold text-sm dark:text-gray-200">${Store.formatDate(payment.date)}</div>
                            <div class="text-xs text-gray-500">${payment.note || 'Payment'}</div>
                        </div>
                        <div class="flex items-center gap-4">
                            <div class="font-bold text-secondary text-lg">+${Store.formatMoney(payment.amount)}</div>
                            <button onclick="app.deletePayment('${id}', '${payment.id}')" class="text-danger text-xs hover:bg-red-50 p-1 rounded"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
            });
        }

        html += `
            </div>

            <!-- Danger Zone -->
            <div class="mt-8 pt-4 border-t dark:border-gray-700 pb-16">
                <button onclick="app.confirmDeleteCustomer('${id}')" class="w-full py-2 border border-danger text-danger rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20">
                    Delete Customer & All Records
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
                el.classList.remove('text-primary', 'border-primary', 'active', 'dark:text-indigo-400', 'dark:border-indigo-400');
                el.classList.add('border-transparent', 'hover:text-gray-600', 'hover:border-gray-300');
            }
            if(content) content.classList.add('hidden');
        });

        // Activate selected
        const activeTab = document.getElementById(`tab-${tabName}`);
        const activeContent = document.getElementById(`content-${tabName}`);
        if(activeTab) {
            activeTab.classList.add('text-primary', 'border-primary', 'active', 'dark:text-indigo-400', 'dark:border-indigo-400');
            activeTab.classList.remove('border-transparent', 'hover:text-gray-600', 'hover:border-gray-300');
        }
        if(activeContent) activeContent.classList.remove('hidden');
    },

    // --- Orders & Payments ---

    showAddOrderModal(customerId) {
        const today = new Date().toISOString().split('T')[0];
        const products = Store.getProducts();

        if (products.length === 0) {
             const html = `
                <div class="p-6 text-center space-y-4">
                    <i class="fas fa-box-open text-4xl text-gray-400 mb-2"></i>
                    <h3 class="text-xl font-bold dark:text-white">Catalog is Empty</h3>
                    <p class="text-gray-500 dark:text-gray-400 text-sm">You must add products to your catalog before you can record a debt.</p>
                    <div class="flex justify-center space-x-2 mt-4">
                        <button onclick="App.closeModal()" class="px-4 py-2 border rounded-lg dark:border-gray-600 dark:text-gray-300">Close</button>
                        <button onclick="App.closeModal(); app.navigate('view-catalog')" class="px-4 py-2 bg-primary text-white rounded-lg shadow">Go to Catalog</button>
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
            <div class="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                <h3 class="text-xl font-bold">Add Debt</h3>
                <button onclick="App.closeModal()" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><i class="fas fa-times"></i></button>
            </div>
            <div class="p-4 space-y-4">
                <form id="order-form" onsubmit="app.saveOrder(event, '${customerId}')">
                    <div class="grid grid-cols-2 gap-2 mb-4">
                        <div>
                            <label class="block text-sm font-medium mb-1 dark:text-gray-300">Date *</label>
                            <input type="date" id="order-date" required value="${today}" class="w-full p-2 border rounded-lg focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1 dark:text-gray-300">Due Date</label>
                            <input type="date" id="order-due-date" class="w-full p-2 border rounded-lg focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                        </div>
                    </div>

                    <div class="mb-2">
                        <label class="block text-sm font-medium mb-1 dark:text-gray-300">Items from Catalog</label>
                        <div id="order-items-container" class="space-y-2">
                            <!-- First Item -->
                            <div class="flex gap-2 items-start order-item-row">
                                <select required class="item-select flex-grow p-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" onchange="app.updateOrderTotalPreview()">
                                    ${productOptions}
                                </select>
                                <input type="number" placeholder="Qty" required min="1" step="0.01" value="1" class="item-qty w-20 p-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" oninput="app.updateOrderTotalPreview()">
                            </div>
                        </div>
                        <button type="button" onclick="app.addOrderItemRow()" class="text-primary text-sm mt-2 font-medium hover:underline dark:text-indigo-400"><i class="fas fa-plus"></i> Add another product</button>
                    </div>

                    <div class="flex justify-between items-center py-3 border-t border-b dark:border-gray-700 my-4">
                        <span class="font-bold dark:text-white">Total:</span>
                        <span class="font-bold text-lg dark:text-white" id="order-total-preview">${Store.getSettings().currency}0.00</span>
                    </div>

                    <div class="flex justify-end space-x-2">
                        <button type="button" onclick="App.closeModal()" class="px-4 py-2 border rounded-lg dark:border-gray-600 dark:text-gray-300">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-primary text-white rounded-lg shadow">Save Debt</button>
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
        div.className = 'flex gap-2 items-start order-item-row mt-2';
        div.innerHTML = `
            <select required class="item-select flex-grow p-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" onchange="app.updateOrderTotalPreview()">
                ${productOptions}
            </select>
            <input type="number" placeholder="Qty" required min="1" step="0.01" value="1" class="item-qty w-20 p-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" oninput="app.updateOrderTotalPreview()">
            <button type="button" onclick="this.parentElement.remove(); app.updateOrderTotalPreview();" class="text-danger p-2"><i class="fas fa-times"></i></button>
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
                const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
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
                const qty = parseFloat(row.querySelector('.item-qty').value) || 1;
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
            <div class="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                <h3 class="text-xl font-bold">Record Payment</h3>
                <button onclick="App.closeModal()" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><i class="fas fa-times"></i></button>
            </div>
            <div class="p-4 space-y-4">
                <div class="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-center mb-4">
                    <span class="text-sm text-gray-500 dark:text-gray-300">Current Balance:</span>
                    <span class="font-bold text-lg ml-2 ${balance > 0 ? 'text-danger' : 'dark:text-white'}">${Store.formatMoney(balance)}</span>
                </div>
                <form id="payment-form" onsubmit="app.savePayment(event, '${customerId}')">
                    <div class="mb-3">
                        <label class="block text-sm font-medium mb-1 dark:text-gray-300">Amount Received *</label>
                        <div class="relative">
                            <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">${Store.getSettings().currency}</span>
                            <input type="number" id="pay-amount" required min="0.01" step="0.01" value="${balance > 0 ? balance : ''}"
                                class="w-full pl-8 p-2 border rounded-lg focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                        </div>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-1 dark:text-gray-300">Date *</label>
                        <input type="date" id="pay-date" required value="${today}" class="w-full p-2 border rounded-lg focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                    </div>
                    <div class="flex justify-end space-x-2">
                        <button type="button" onclick="App.closeModal()" class="px-4 py-2 border rounded-lg dark:border-gray-600 dark:text-gray-300">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-secondary text-white rounded-lg shadow">Save Payment</button>
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

        let html = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">`;

        if (products.length === 0) {
            html += `<div class="col-span-full text-center py-8 text-gray-500">Catalog is empty. Add frequently sold products here.</div>`;
        } else {
            products.forEach(product => {
                html += `
                    <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
                        <div class="mb-2">
                            <h3 class="font-bold text-lg dark:text-gray-100">${product.name}</h3>
                            <div class="text-xl font-bold text-primary dark:text-indigo-400 mt-1">${Store.formatMoney(product.price)}</div>
                        </div>
                        <div class="flex justify-end space-x-2 mt-4 pt-4 border-t dark:border-gray-700">
                            <button onclick="app.showAddProductModal('${product.id}')" class="text-gray-500 hover:text-primary p-2"><i class="fas fa-edit"></i></button>
                            <button onclick="app.deleteProduct('${product.id}')" class="text-danger p-2"><i class="fas fa-trash"></i></button>
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
            <div class="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                <h3 class="text-xl font-bold">${productId ? 'Edit' : 'Add'} Product</h3>
                <button onclick="App.closeModal()" class="text-gray-500 hover:text-gray-700"><i class="fas fa-times"></i></button>
            </div>
            <div class="p-4 space-y-4">
                <form onsubmit="app.saveProduct(event, '${productId || ''}')">
                    <div class="mb-3">
                        <label class="block text-sm font-medium mb-1 dark:text-gray-300">Product Name *</label>
                        <input type="text" id="prod-name" required value="${product.name}" class="w-full p-2 border rounded-lg focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-1 dark:text-gray-300">Default Price *</label>
                        <div class="relative">
                            <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">${Store.getSettings().currency}</span>
                            <input type="number" id="prod-price" required min="0" step="0.01" value="${product.price}"
                                class="w-full pl-8 p-2 border rounded-lg focus:ring-primary dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                        </div>
                    </div>
                    <div class="flex justify-end space-x-2">
                        <button type="button" onclick="App.closeModal()" class="px-4 py-2 border rounded-lg dark:border-gray-600 dark:text-gray-300">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-primary text-white rounded-lg shadow">Save</button>
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
            <div class="space-y-6 pb-8 max-w-2xl">
                <!-- Preferences -->
                <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 class="font-bold text-lg mb-4 border-b dark:border-gray-700 pb-2 dark:text-white">Preferences</h3>

                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <div class="font-medium dark:text-gray-200">Currency Symbol</div>
                            <div class="text-sm text-gray-500">Used for all monetary displays</div>
                        </div>
                        <input type="text" id="setting-currency" value="${settings.currency}" maxlength="5" class="w-16 p-2 border rounded text-center dark:bg-gray-700 dark:border-gray-600 dark:text-white" onchange="app.saveSetting('currency', this.value)">
                    </div>

                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <div class="font-medium dark:text-gray-200">Dark Mode</div>
                            <div class="text-sm text-gray-500">Toggle dark theme</div>
                        </div>
                        <button onclick="document.getElementById('theme-toggle-mobile').click()" class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDark ? 'bg-primary' : 'bg-gray-200'}">
                            <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDark ? 'translate-x-6' : 'translate-x-1'}"></span>
                        </button>
                    </div>
                </div>

                <!-- Data Management -->
                <div class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 class="font-bold text-lg mb-4 border-b dark:border-gray-700 pb-2 dark:text-white">Data Backup & Restore</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        All your data is stored locally in this browser. Export it regularly to keep a backup.
                    </p>

                    <div class="flex space-x-2">
                        <button onclick="app.exportData()" class="flex-1 bg-white border border-gray-300 dark:border-gray-600 dark:bg-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 dark:text-white flex items-center justify-center">
                            <i class="fas fa-download mr-2"></i> Export Data
                        </button>
                        <button onclick="document.getElementById('import-file').click()" class="flex-1 bg-white border border-gray-300 dark:border-gray-600 dark:bg-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 dark:text-white flex items-center justify-center">
                            <i class="fas fa-upload mr-2"></i> Import Data
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
            <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity modal-overlay" onclick="App.closeModal()"></div>
                <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto relative z-10 modal-content">
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
