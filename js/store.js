/**
 * store.js - Handles all localStorage operations and data calculations.
 */

const Store = {
    // Keys for localStorage
    KEYS: {
        CUSTOMERS: 'debt_tracker_customers',
        PRODUCTS: 'debt_tracker_products',
        SETTINGS: 'debt_tracker_settings'
    },

    // Default settings
    DEFAULT_SETTINGS: {
        currency: '$',
        theme: 'light', // 'light' or 'dark'
        lastActiveMonth: '' // Tracks the last month the app was opened (YYYY-MM)
    },

    /**
     * Initialize store. Creates empty arrays if they don't exist.
     */
    init() {
        if (!localStorage.getItem(this.KEYS.CUSTOMERS)) {
            localStorage.setItem(this.KEYS.CUSTOMERS, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.KEYS.PRODUCTS)) {
            localStorage.setItem(this.KEYS.PRODUCTS, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.KEYS.SETTINGS)) {
            localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(this.DEFAULT_SETTINGS));
        }

        this.checkMonthlyRollover();
    },

    /**
     * Check if a new month has started. If so, reset all payments and fully-paid debts,
     * and roll over any unpaid balances as a single new debt.
     */
    checkMonthlyRollover() {
        const settings = this.getSettings();
        const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

        if (!settings.lastActiveMonth) {
            settings.lastActiveMonth = currentMonth;
            this.saveSettings(settings);
            return;
        }

        if (settings.lastActiveMonth !== currentMonth) {
            let customers = this.getCustomers();
            customers.forEach(customer => {
                const balance = this.getCustomerBalance(customer);

                // Clear history for the new month
                customer.orders = [];
                customer.payments = [];

                if (balance > 0) {
                    // Carry over the outstanding debt
                    customer.orders.push({
                        id: this.generateId(),
                        date: new Date().toISOString().split('T')[0],
                        dueDate: null,
                        items: [{
                            name: `Previous Balance Rollover from ${settings.lastActiveMonth}`,
                            quantity: 1,
                            price: balance
                        }]
                    });
                }
            });

            this.set(this.KEYS.CUSTOMERS, customers);

            settings.lastActiveMonth = currentMonth;
            this.saveSettings(settings);
        }
    },

    /**
     * Generic generic getter
     */
    get(key) {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch (e) {
            console.error(`Error parsing ${key} from localStorage`, e);
            return null;
        }
    },

    /**
     * Generic generic setter
     */
    set(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },

    // --- Customers ---

    getCustomers() {
        return this.get(this.KEYS.CUSTOMERS) || [];
    },

    getCustomer(id) {
        return this.getCustomers().find(c => c.id === id);
    },

    saveCustomer(customer) {
        const customers = this.getCustomers();
        const index = customers.findIndex(c => c.id === customer.id);

        if (index > -1) {
            // Update
            customers[index] = customer;
        } else {
            // Create
            if (!customer.id) customer.id = this.generateId();
            if (!customer.orders) customer.orders = [];
            if (!customer.payments) customer.payments = [];
            customers.push(customer);
        }

        this.set(this.KEYS.CUSTOMERS, customers);
        return customer;
    },

    deleteCustomer(id) {
        let customers = this.getCustomers();
        customers = customers.filter(c => c.id !== id);
        this.set(this.KEYS.CUSTOMERS, customers);
    },

    // --- Products ---

    getProducts() {
        return this.get(this.KEYS.PRODUCTS) || [];
    },

    saveProduct(product) {
        const products = this.getProducts();
        const index = products.findIndex(p => p.id === product.id);

        if (index > -1) {
            products[index] = product;
        } else {
            if (!product.id) product.id = this.generateId();
            products.push(product);
        }

        this.set(this.KEYS.PRODUCTS, products);
        return product;
    },

    deleteProduct(id) {
        let products = this.getProducts();
        products = products.filter(p => p.id !== id);
        this.set(this.KEYS.PRODUCTS, products);
    },

    // --- Settings ---
    getSettings() {
        return this.get(this.KEYS.SETTINGS) || this.DEFAULT_SETTINGS;
    },

    saveSettings(settings) {
        this.set(this.KEYS.SETTINGS, { ...this.getSettings(), ...settings });
    },

    // --- Calculations ---

    /**
     * Calculate order total
     */
    calculateOrderTotal(order) {
        if (!order || !order.items) return 0;
        return order.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    },

    /**
     * Calculate total orders value for a customer
     */
    getCustomerTotalDebt(customer) {
        if (!customer || !customer.orders) return 0;
        return customer.orders.reduce((sum, order) => sum + this.calculateOrderTotal(order), 0);
    },

    /**
     * Calculate total paid by a customer
     */
    getCustomerTotalPaid(customer) {
        if (!customer || !customer.payments) return 0;
        return customer.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    },

    /**
     * Calculate current balance (outstanding) for a customer
     */
    getCustomerBalance(customer) {
        const totalDebt = this.getCustomerTotalDebt(customer);
        const totalPaid = this.getCustomerTotalPaid(customer);
        return totalDebt - totalPaid; // Positive means they owe money
    },

    /**
     * Global calculations
     */
    getGlobalStats() {
        const customers = this.getCustomers();
        let totalSales = 0;
        let totalCollected = 0;
        let totalOutstanding = 0;
        let debtorsCount = 0;

        customers.forEach(customer => {
            const debt = this.getCustomerTotalDebt(customer);
            const paid = this.getCustomerTotalPaid(customer);
            const balance = debt - paid;

            totalSales += debt;
            totalCollected += paid;
            totalOutstanding += balance;

            if (balance > 0) {
                debtorsCount++;
            }
        });

        // Top 5 debtors
        const topDebtors = [...customers]
            .map(c => ({ id: c.id, name: c.name, balance: this.getCustomerBalance(c) }))
            .filter(c => c.balance > 0)
            .sort((a, b) => b.balance - a.balance)
            .slice(0, 5);

        // Overdue debts (orders with due date before today and not fully paid)
        let overdueOrders = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        customers.forEach(customer => {
            if (customer.orders) {
                customer.orders.forEach(order => {
                    if (order.dueDate) {
                        const dueDate = new Date(order.dueDate);
                        // Simplified overdue check: order has due date, it's past, and customer still has a positive overall balance
                        // (In a more complex app, payments would be linked directly to orders. Here we pool payments per customer).
                        if (dueDate < today && this.getCustomerBalance(customer) > 0) {
                             overdueOrders.push({
                                 customerId: customer.id,
                                 customerName: customer.name,
                                 orderId: order.id,
                                 date: order.date,
                                 dueDate: order.dueDate,
                                 total: this.calculateOrderTotal(order)
                             });
                        }
                    }
                });
            }
        });

        overdueOrders.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        return {
            totalSales,
            totalCollected,
            totalOutstanding,
            debtorsCount,
            topDebtors,
            overdueOrders
        };
    },

    // --- Helpers ---
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    },

    formatMoney(amount) {
        const currency = this.getSettings().currency;
        // Basic formatting, could be improved with Intl.NumberFormat
        return `${currency}${Number(amount).toFixed(2)}`;
    },

    formatDate(dateString) {
        if (!dateString) return '';
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    },

    exportData() {
        const data = {
            customers: this.getCustomers(),
            products: this.getProducts(),
            settings: this.getSettings(),
            exportDate: new Date().toISOString()
        };
        return JSON.stringify(data, null, 2);
    },

    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (data.customers) this.set(this.KEYS.CUSTOMERS, data.customers);
            if (data.products) this.set(this.KEYS.PRODUCTS, data.products);
            if (data.settings) this.set(this.KEYS.SETTINGS, data.settings);
            return true;
        } catch (e) {
            console.error("Failed to import data", e);
            return false;
        }
    }
};

// Initialize on load
Store.init();
