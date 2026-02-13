// Simple utility to manage localStorage data
// Simulates async behavior to match original Firebase implementation structure roughly

const APP_KEY = 'fundflow-local-data';

// Initial state structure
const getInitialData = () => {
    const stored = localStorage.getItem(APP_KEY);
    if (stored) return JSON.parse(stored);

    return {
        income: 0,
        containers: [],
        expenses: []
    };
};

// Helper to save data
const saveData = (data) => {
    localStorage.setItem(APP_KEY, JSON.stringify(data));
    // Dispatch a storage event so tabs/windows sync (optional, but good for local dev)
    window.dispatchEvent(new Event('storage'));
};

export const storage = {
    // Get all data
    getData: () => getInitialData(),

    // Update profile (income)
    updateProfile: async (updates) => {
        const data = getInitialData();
        // Simulate network delay
        await new Promise(r => setTimeout(r, 100));

        if (updates.income !== undefined) {
            data.income = updates.income;
        }
        saveData(data);
        return data;
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

    // Subscriber for reacting to changes (replacing onSnapshot)
    subscribe: (callback) => {
        const handler = () => {
            callback(getInitialData());
        };

        window.addEventListener('storage', handler);
        // Also call immediately
        callback(getInitialData());

        return () => window.removeEventListener('storage', handler);
    }
};
