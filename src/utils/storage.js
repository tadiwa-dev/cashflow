// Simple utility to manage localStorage data
// Simulates async behavior to match original Firebase implementation structure roughly

const APP_KEY = 'fundflow-local-data';

// Initial state structure
const getInitialData = () => {
    try {
        const stored = localStorage.getItem(APP_KEY);
        if (stored) return JSON.parse(stored);
    } catch (e) {
        console.error("Failed to load local storage:", e);
    }

    return {
        incomes: [],
        containers: [],
        expenses: [],
        clearedTithe: 0,
        clearedOffering: 0,
        clearedCharity: 0
    };
};

// Helper to save data
const saveData = (data) => {
    localStorage.setItem(APP_KEY, JSON.stringify(data));
    // Dispatch a storage event so tabs/windows sync (optional, but good for local dev)
    window.dispatchEvent(new Event('storage'));
};

const migrateData = (data) => {
    // Migration: If old 'income' property exists, move it to 'incomes' array
    if (data.income !== undefined && (!data.incomes || data.incomes.length === 0)) {
        if (data.income > 0) {
            data.incomes = [{
                id: 'legacy-income',
                source: 'Initial Income',
                amount: data.income,
                date: new Date().toLocaleDateString(),
                createdAt: Date.now()
            }];
        }
        delete data.income;
        saveData(data);
    }
    if (!data.incomes) data.incomes = [];
    if (typeof data.clearedTithe !== 'number') data.clearedTithe = 0;
    if (typeof data.clearedOffering !== 'number') data.clearedOffering = 0;
    if (typeof data.clearedCharity !== 'number') data.clearedCharity = 0;
    return data;
};

export const storage = {
    // Get all data
    getData: () => migrateData(getInitialData()),

    // Incomes
    addIncome: async (income) => {
        const data = migrateData(getInitialData());
        await new Promise(r => setTimeout(r, 100));

        const newIncome = {
            ...income,
            id: Date.now().toString(),
            createdAt: income.createdAt || Date.now()
        };

        data.incomes.push(newIncome);
        saveData(data);
        return newIncome;
    },

    deleteIncome: async (id) => {
        const data = migrateData(getInitialData());
        await new Promise(r => setTimeout(r, 100));

        data.incomes = data.incomes.filter(i => i.id !== id);
        saveData(data);
    },

    // Containers
    addContainer: async (container) => {
        const data = getInitialData();
        await new Promise(r => setTimeout(r, 100));

        const newContainer = {
            ...container,
            id: Date.now().toString(), // Simple ID generation
            balance: container.balance || 0,
            createdAt: container.createdAt || Date.now()
        };

        data.containers.push(newContainer);
        saveData(data);
        return newContainer;
    },

    updateContainer: async (id, updates) => {
        const data = getInitialData();
        await new Promise(r => setTimeout(r, 100));

        const index = data.containers.findIndex(c => c.id === id);
        if (index !== -1) {
            data.containers[index] = { ...data.containers[index], ...updates };
            saveData(data);
        }
    },

    deleteContainer: async (id) => {
        const data = getInitialData();
        await new Promise(r => setTimeout(r, 100));

        data.containers = data.containers.filter(c => c.id !== id);
        saveData(data);
    },

    // Expenses
    addExpense: async (expense) => {
        const data = getInitialData();
        await new Promise(r => setTimeout(r, 100));

        const newExpense = {
            ...expense,
            id: Date.now().toString(),
            createdAt: expense.createdAt || Date.now()
        };

        data.expenses.push(newExpense);
        saveData(data);
        return newExpense;
    },

    deleteExpense: async (id) => {
        const data = getInitialData();
        await new Promise(r => setTimeout(r, 100));

        data.expenses = data.expenses.filter(e => e.id !== id);
        saveData(data);
    },

    updateClearedDeductions: async (updates) => {
        const data = migrateData(getInitialData());
        await new Promise(r => setTimeout(r, 100));

        if (updates.clearedTithe !== undefined) data.clearedTithe = updates.clearedTithe;
        if (updates.clearedOffering !== undefined) data.clearedOffering = updates.clearedOffering;
        if (updates.clearedCharity !== undefined) data.clearedCharity = updates.clearedCharity;

        saveData(data);
    },

    // Subscriber for reacting to changes
    subscribe: (callback) => {
        const handler = () => {
            callback(getInitialData());
        };

        window.addEventListener('storage', handler);
        callback(getInitialData());

        return () => window.removeEventListener('storage', handler);
    },

    // Backup & Restore
    exportData: () => {
        return JSON.stringify(migrateData(getInitialData()), null, 2);
    },

    importData: async (jsonString) => {
        try {
            const data = JSON.parse(jsonString);
            if (!data || typeof data !== 'object') throw new Error("Invalid data format");

            // Basic validation
            if (!Array.isArray(data.incomes)) data.incomes = [];
            if (!Array.isArray(data.containers)) data.containers = [];
            if (!Array.isArray(data.expenses)) data.expenses = [];

            saveData(data);
            return true;
        } catch (e) {
            console.error("Import failed:", e);
            return false;
        }
    }
};
