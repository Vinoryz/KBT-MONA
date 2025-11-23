import React, { useState, useEffect } from "react";
import AppLayout from "@/Layouts/AppLayout";
import { Head } from "@inertiajs/react";
import axios from "axios";
import MonaCalendar from "@/Components/MonaCalendar";

// Helper functions for number formatting
const formatNumberWithDots = (value) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, "");

    // Add dots every 3 digits from right to left
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const parseFormattedNumber = (formattedValue) => {
    // Remove dots to get raw number
    return formattedValue.replace(/\./g, "");
};

// Helper function to format currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(amount);
};

export default function Transaction({ auth }) {
    const [transactionType, setTransactionType] = useState("income"); // 'income' or 'expense'
    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });
    const [formData, setFormData] = useState({
        amount: "",
        category: "",
        date: new Date().toISOString().split("T")[0], // Today's date
        description: "",
    });

    // Selected date for calendar
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Transaction details state (itemized list)
    const [transactionDetails, setTransactionDetails] = useState([]);
    const [showItemizedInput, setShowItemizedInput] = useState(false);
    const [showItemForm, setShowItemForm] = useState(false);
    const [currentItem, setCurrentItem] = useState({
        item_name: "",
        quantity: 1,
        item_price: "",
    });
    const [editingItemId, setEditingItemId] = useState(null);

    // Modal notification state
    const [modalNotification, setModalNotification] = useState({
        show: false,
        type: "", // 'success' or 'error'
        title: "",
        message: "",
    });

    // Budget warning modal state
    const [budgetWarningModal, setBudgetWarningModal] = useState({
        show: false,
        pendingTransaction: null,
    });

    // Quick Stats state
    const [stats, setStats] = useState({
        totalIncome: 0,
        totalExpenses: 0,
        netBalance: 0,
        loading: true,
    });

    // Date warning state
    const [showDateWarning, setShowDateWarning] = useState(false);

    // Mobile detection state
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 640);
        };

        checkMobile();
        window.addEventListener("resize", checkMobile);

        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // Format date for display as DD/MM/YYYY
    const formatDateForDisplay = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Handle date change from MonaCalendar
    const handleDateChange = (date) => {
        setSelectedDate(date);
        if (date) {
            const formattedDate = date.toISOString().split("T")[0];
            setFormData({ ...formData, date: formattedDate });
        }
    };

    // Fetch categories from API based on transaction type
    const fetchCategories = async (type) => {
        try {
            setLoadingCategories(true);
            console.log("Fetching categories for type:", type);
            const response = await axios.get(`/api/categories?type=${type}`);
            console.log("Categories received:", response.data);
            setCategories(response.data);
        } catch (error) {
            console.error("Error fetching categories:", error);
            showModalNotification(
                "error",
                "Something went wrong",
                "Failed to load categories"
            );
            // Fallback categories
            setCategories([]);
        } finally {
            setLoadingCategories(false);
        }
    };

    // Fetch monthly statistics
    const fetchMonthlyStats = async () => {
        try {
            setStats((prev) => ({ ...prev, loading: true }));

            // Get current month and year
            const now = new Date();
            const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
            const currentYear = now.getFullYear();

            const response = await axios.get(
                `/api/transactions/monthly-stats`,
                {
                    params: {
                        month: currentMonth,
                        year: currentYear,
                    },
                }
            );

            const responseData = response.data.data; // API returns data in data property
            setStats({
                totalIncome: responseData.total_income || 0,
                totalExpenses: Math.abs(responseData.total_expenses || 0), // Make sure it's positive
                netBalance: responseData.net_balance || 0, // Use the calculated net_balance from API
                loading: false,
            });
        } catch (error) {
            console.error("Error fetching monthly stats:", error);
            // Set default values on error
            setStats({
                totalIncome: 0,
                totalExpenses: 0,
                netBalance: 0,
                loading: false,
            });
        }
    };

    // Load categories when component mounts or transaction type changes
    useEffect(() => {
        fetchCategories(transactionType);
        // Reset category selection when type changes
        setFormData((prev) => ({ ...prev, category: "" }));
    }, [transactionType]);

    // Load monthly statistics when component mounts
    useEffect(() => {
        fetchMonthlyStats();
    }, []);

    // Hide modal notification after 3 seconds
    useEffect(() => {
        if (modalNotification.show) {
            const timer = setTimeout(() => {
                setModalNotification({
                    show: false,
                    type: "",
                    title: "",
                    message: "",
                });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [modalNotification.show]);

    const showModalNotification = (type, title, message) => {
        setModalNotification({ show: true, type, title, message });
    };

    // Transaction Details Functions
    const handleSaveItem = () => {
        if (
            !currentItem.item_name ||
            !currentItem.quantity ||
            !currentItem.item_price
        ) {
            showModalNotification(
                "error",
                "Something went wrong",
                "Please fill in all item fields."
            );
            return;
        }

        if (editingItemId) {
            // Update existing item - add it back to the list
            setTransactionDetails([
                ...transactionDetails,
                {
                    ...currentItem,
                    id: editingItemId,
                    category_id: formData.category || "",
                },
            ]);
            setEditingItemId(null);
        } else {
            // Add new item
            setTransactionDetails([
                ...transactionDetails,
                {
                    ...currentItem,
                    id: Date.now(),
                    category_id: formData.category || "",
                },
            ]);
        }

        // Reset current item and hide form
        setCurrentItem({
            item_name: "",
            quantity: 1,
            item_price: "",
        });
        setShowItemForm(false);
    };

    const handleEditItem = (item) => {
        // Remove item from list temporarily while editing
        setTransactionDetails(
            transactionDetails.filter((i) => i.id !== item.id)
        );

        // Load item into form
        setCurrentItem({
            item_name: item.item_name,
            quantity: item.quantity,
            item_price: item.item_price,
        });
        setEditingItemId(item.id);
        setShowItemForm(true);
    };

    const handleCancelEdit = () => {
        // If we were editing, add the item back to the list
        if (editingItemId) {
            // Item was already removed from list, so we need to restore it
            // But we don't have the original data anymore, so just clear the edit state
            setEditingItemId(null);
        }

        setCurrentItem({
            item_name: "",
            quantity: 1,
            item_price: "",
        });
        setShowItemForm(false);
    };

    const removeItem = (id) => {
        setTransactionDetails(
            transactionDetails.filter((item) => item.id !== id)
        );
    };

    // Calculate total from items
    const calculateTotalFromItems = () => {
        return transactionDetails.reduce((total, item) => {
            const quantity = parseInt(item.quantity) || 0;
            const price =
                parseFloat(parseFormattedNumber(item.item_price)) || 0;
            return total + quantity * price;
        }, 0);
    };

    // Auto-update amount when items change
    useEffect(() => {
        if (showItemizedInput && transactionDetails.length > 0) {
            const total = calculateTotalFromItems();
            setFormData((prev) => ({ ...prev, amount: total.toString() }));
        }
    }, [transactionDetails, showItemizedInput]);

    const checkBudgetExists = async (categoryId, date) => {
        try {
            const transactionDate = new Date(date);
            const month = transactionDate.getMonth() + 1; // getMonth() returns 0-11
            const year = transactionDate.getFullYear();

            const response = await axios.get("/api/budgets/check", {
                params: {
                    category_id: categoryId,
                    month: month,
                    year: year,
                },
            });

            return response.data.has_budget;
        } catch (error) {
            console.error("Error checking budget:", error);
            return true; // If error, assume budget exists to avoid blocking
        }
    };

    const saveTransaction = async (transactionData) => {
        try {
            // Use /api/transactions/add to avoid conflict with History page
            const response = await axios.post(
                "/api/transactions/add",
                transactionData
            );
            showModalNotification(
                "success",
                "Success",
                "Transaction added Successfully!"
            );

            // Check for budget alert in response
            if (response.data.budget_alert) {
                const alert = response.data.budget_alert;
                const alertMessage = `${alert.message} (${Math.floor(
                    alert.percentage
                )}% of budget used)`;

                // Show budget alert notification
                setTimeout(() => {
                    showModalNotification(
                        alert.alert_level === "critical" ? "error" : "warning",
                        "Budget Alert",
                        alertMessage
                    );
                }, 1500); // Delay to show after success message
            }

            // Dispatch event for notification bell to refresh
            window.dispatchEvent(new CustomEvent('transaction-created'));

            // Reset form
            setFormData({
                amount: "",
                category: "",
                date: new Date().toISOString().split("T")[0],
                description: "",
            });
            setSelectedDate(new Date());

            // Reset transaction details
            setTransactionDetails([]);
            setShowItemizedInput(false);

            // Refresh monthly statistics after adding transaction
            fetchMonthlyStats();
        } catch (err) {
            showModalNotification(
                "error",
                "Something went wrong",
                "Failed to create transaction!"
            );
            console.error(
                "Failed to create transaction:",
                err?.response?.data || err.message
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.amount || !formData.category || !formData.date) {
            showModalNotification(
                "error",
                "Something went wrong",
                "Please fill in all required fields."
            );
            return;
        }

        const rawAmount = Number(formData.amount);
        if (Number.isNaN(rawAmount) || rawAmount <= 0) {
            showModalNotification(
                "error",
                "Something went wrong",
                "Amount must be a valid positive number."
            );
            return;
        }

        setSubmitting(true);

        const transactionData = {
            category_id: parseInt(formData.category),
            amount: parseFloat(formData.amount),
            description: formData.description || "",
            transaction_date: formData.date,
        };

        // Add transaction details if itemized input is enabled and has items
        if (showItemizedInput && transactionDetails.length > 0) {
            transactionData.transaction_details = transactionDetails.map(
                (item) => ({
                    item_name: item.item_name,
                    quantity: parseInt(item.quantity) || 1,
                    item_price: parseFloat(
                        parseFormattedNumber(item.item_price)
                    ),
                    category_id: item.category_id
                        ? parseInt(item.category_id)
                        : parseInt(formData.category),
                })
            );
        }

        // Check budget only for expense transactions
        if (transactionType === "expense") {
            const hasBudget = await checkBudgetExists(
                transactionData.category_id,
                transactionData.transaction_date
            );

            if (!hasBudget) {
                // Show budget warning modal
                setBudgetWarningModal({
                    show: true,
                    pendingTransaction: transactionData,
                });
                setSubmitting(false);
                return;
            }
        }

        // If income or budget exists, save directly
        await saveTransaction(transactionData);
    };

    const handleContinueAnyway = async () => {
        setBudgetWarningModal({ show: false, pendingTransaction: null });
        setSubmitting(true);
        await saveTransaction(budgetWarningModal.pendingTransaction);
    };

    const handleCancelTransaction = () => {
        setBudgetWarningModal({ show: false, pendingTransaction: null });
        setSubmitting(false);
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this transaction?"))
            return;

        try {
            await axios.delete(`/api/transactions/${id}`);
            showModalNotification(
                "success",
                "Success",
                "Transaction deleted successfully!"
            );
            
            // Dispatch event for notification bell to refresh
            window.dispatchEvent(new CustomEvent('transaction-deleted'));
            
            fetchMonthlyStats();
        } catch (error) {
            console.error("Error deleting transaction:", error);
            showModalNotification(
                "error",
                "Something went wrong",
                "Failed to delete transaction"
            );
        }
    };

    return (
        <AppLayout title="MONA - Transaction" auth={auth}>
            <Head title="MONA - Transaction" />

            {/* Modal Notification Overlay (SweetAlert2-style) */}
            {modalNotification.show && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-11/12 animate-scale-in">
                        {/* Icon */}
                        <div className="flex justify-center mb-6">
                            {modalNotification.type === "success" ? (
                                <div className="w-20 h-20 rounded-full border-4 border-growth-green-500 flex items-center justify-center animate-check-icon">
                                    <svg
                                        className="w-12 h-12 text-growth-green-500"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={4}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                </div>
                            ) : (
                                <div className="w-20 h-20 rounded-full border-4 border-expense-red-500 flex items-center justify-center animate-error-icon">
                                    <img
                                        src="/images/icons/exclamation-warning-icon.svg"
                                        alt="Error"
                                        className="w-10 h-10"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Title */}
                        <h3
                            className={`text-2xl font-bold text-center mb-3 ${
                                modalNotification.type === "success"
                                    ? "text-growth-green-500"
                                    : "text-expense-red-500"
                            }`}
                        >
                            {modalNotification.title}
                        </h3>

                        {/* Message */}
                        <p className="text-gray-600 text-center text-base">
                            {modalNotification.message}
                        </p>
                    </div>
                </div>
            )}

            {/* Floating Date Warning Notification */}
            {showDateWarning && (
                <div className="fixed top-4 right-4 z-[9999] animate-slide-in-right">
                    <div className="bg-white rounded-lg shadow-lg border-l-4 border-expense-red-500 p-4 max-w-sm">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                                <svg
                                    className="w-6 h-6 text-expense-red-500"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h4 className="text-sm font-semibold text-gray-900 mb-1">
                                    Can't Select Future Date
                                </h4>
                                <p className="text-sm text-gray-600">
                                    Please select today or a past date.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Budget Warning Modal */}
            {budgetWarningModal.show && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-11/12 animate-scale-in">
                        {/* Warning Icon */}
                        <div className="flex justify-center mb-6">
                            <div className="w-20 h-20 rounded-full border-4 border-yellow-500 flex items-center justify-center animate-warning-icon">
                                <svg
                                    className="w-12 h-12 text-yellow-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                    />
                                </svg>
                            </div>
                        </div>

                        {/* Title */}
                        <h3 className="text-2xl font-bold text-center mb-3 text-yellow-600">
                            No Budget Set
                        </h3>

                        {/* Message */}
                        <p className="text-gray-600 text-center text-base mb-6">
                            You haven't set a budget for this expense category
                            in the selected month. Do you want to continue
                            anyway?
                        </p>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleContinueAnyway}
                                className="w-full py-3 px-6 rounded-lg font-medium bg-growth-green-500 text-white hover:bg-growth-green-600 transition-colors"
                            >
                                Continue Anyway
                            </button>
                            <button
                                onClick={handleCancelTransaction}
                                className="w-full py-3 px-6 rounded-lg font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                            >
                                Cancel Transaction
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Keyframes for animations */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { 
                        opacity: 0; 
                        transform: scale(0.5); 
                    }
                    to { 
                        opacity: 1; 
                        transform: scale(1); 
                    }
                }
                @keyframes checkIcon {
                    0% { 
                        transform: scale(0) rotate(0deg); 
                        opacity: 0; 
                    }
                    50% { 
                        transform: scale(1.2) rotate(180deg); 
                    }
                    100% { 
                        transform: scale(1) rotate(360deg); 
                        opacity: 1; 
                    }
                }
                @keyframes errorIcon {
                    0% { 
                        transform: scale(0); 
                        opacity: 0; 
                    }
                    50% { 
                        transform: scale(1.2); 
                    }
                    100% { 
                        transform: scale(1); 
                        opacity: 1; 
                    }
                }
                .animate-fade-in {
                    animation: fadeIn 0.3s ease-out;
                }
                .animate-scale-in {
                    animation: scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .animate-check-icon {
                    animation: checkIcon 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.1s both;
                }
                .animate-error-icon {
                    animation: errorIcon 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.1s both;
                }
                .animate-warning-icon {
                    animation: warningIcon 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.1s both;
                }
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                .animate-slide-in-right {
                    animation: slideInRight 0.3s ease-out;
                }
            `}</style>

            {/* Animation Styles */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-fade-in {
                    animation: fadeIn 0.8s ease-out forwards;
                }
                .animate-fade-in-up {
                    animation: fadeInUp 0.8s ease-out forwards;
                }
                .delay-100 { animation-delay: 0.1s; opacity: 0; }
                .delay-200 { animation-delay: 0.2s; opacity: 0; }
                .delay-300 { animation-delay: 0.3s; opacity: 0; }
            `}</style>

            <div className="overflow-x-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Header */}
                    <div className="mb-8 animate-fade-in">
                        <h1 className="text-2xl sm:text-3xl md:text-3xl lg:text-3xl xl:text-4xl font-bold text-charcoal mb-2">
                            Add Transaction
                        </h1>
                        <p className="text-sm sm:text-base md:text-base lg:text-base xl:text-lg text-medium-gray">
                            Record your income and expenses
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* New Transaction Form */}
                        <div className="animate-fade-in-up delay-100 bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative z-50">
                            <h2 className="text-xl font-semibold mb-2">
                                New Transaction
                            </h2>
                            <p className="text-gray-600 mb-6">
                                Enter the details of your transaction
                            </p>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Income/Expense Buttons */}
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setTransactionType("income")
                                        }
                                        className={`flex-1 py-3 px-6 rounded-lg text-sm font-medium transition-colors ${
                                            transactionType === "income"
                                                ? "bg-growth-green-500 text-white"
                                                : "bg-[#D4EADF] text-growth-green-500 hover:bg-[#C0E0CB]"
                                        }`}
                                    >
                                        + Income
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setTransactionType("expense")
                                        }
                                        className={`flex-1 py-3 px-6 rounded-lg text-sm font-medium transition-colors ${
                                            transactionType === "expense"
                                                ? "bg-expense-red-500 text-white"
                                                : "bg-[#F9E4E3] text-expense-red-500 hover:bg-[#F5D2D0]"
                                        }`}
                                    >
                                        - Expense
                                    </button>
                                </div>

                                {/* Amount */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Amount*
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="0"
                                        value={formatNumberWithDots(
                                            formData.amount
                                        )}
                                        onChange={(e) => {
                                            const rawValue =
                                                parseFormattedNumber(
                                                    e.target.value
                                                );
                                            setFormData({
                                                ...formData,
                                                amount: rawValue,
                                            });
                                        }}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-growth-green-500 focus:border-transparent"
                                        required
                                        disabled={
                                            showItemizedInput &&
                                            transactionDetails.length > 0
                                        }
                                    />
                                    {showItemizedInput &&
                                        transactionDetails.length > 0 && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Amount is auto-calculated from
                                                items below
                                            </p>
                                        )}
                                </div>

                                {/* Itemized Input Toggle */}
                                <div className="flex items-center justify-between py-2">
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showItemizedInput}
                                            onChange={(e) => {
                                                setShowItemizedInput(
                                                    e.target.checked
                                                );
                                                if (!e.target.checked) {
                                                    setTransactionDetails([]);
                                                }
                                            }}
                                            className="w-4 h-4 text-growth-green-500 border-gray-300 rounded focus:ring-growth-green-500"
                                        />
                                        <span className="ml-2 text-sm font-medium text-gray-700">
                                            Add itemized details
                                        </span>
                                    </label>
                                </div>

                                {/* Transaction Details (Items) */}
                                {showItemizedInput && (
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 space-y-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-sm font-semibold text-gray-700">
                                                Items
                                            </h3>
                                            {!showItemForm && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setShowItemForm(true)
                                                    }
                                                    className="text-sm px-3 py-1 bg-growth-green-500 text-white rounded hover:bg-growth-green-600 transition-colors"
                                                >
                                                    + Add Item
                                                </button>
                                            )}
                                        </div>

                                        {/* Item Input Form */}
                                        {showItemForm && (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-semibold text-blue-700">
                                                        {editingItemId
                                                            ? "Edit Item"
                                                            : "New Item"}
                                                    </span>
                                                    {editingItemId && (
                                                        <button
                                                            type="button"
                                                            onClick={
                                                                handleCancelEdit
                                                            }
                                                            className="text-xs text-gray-500 hover:text-gray-700"
                                                        >
                                                            Cancel
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Item Name */}
                                                <input
                                                    type="text"
                                                    placeholder="Item name"
                                                    value={
                                                        currentItem.item_name
                                                    }
                                                    onChange={(e) =>
                                                        setCurrentItem({
                                                            ...currentItem,
                                                            item_name:
                                                                e.target.value,
                                                        })
                                                    }
                                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />

                                                <div className="grid grid-cols-2 gap-2">
                                                    {/* Quantity */}
                                                    <input
                                                        type="number"
                                                        placeholder="Qty"
                                                        value={
                                                            currentItem.quantity
                                                        }
                                                        onChange={(e) =>
                                                            setCurrentItem({
                                                                ...currentItem,
                                                                quantity:
                                                                    e.target
                                                                        .value,
                                                            })
                                                        }
                                                        min="1"
                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    />

                                                    {/* Price */}
                                                    <input
                                                        type="text"
                                                        placeholder="Price"
                                                        value={formatNumberWithDots(
                                                            currentItem.item_price
                                                        )}
                                                        onChange={(e) => {
                                                            const rawValue =
                                                                parseFormattedNumber(
                                                                    e.target
                                                                        .value
                                                                );
                                                            setCurrentItem({
                                                                ...currentItem,
                                                                item_price:
                                                                    rawValue,
                                                            });
                                                        }}
                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    />
                                                </div>

                                                {/* Subtotal Preview */}
                                                {currentItem.quantity &&
                                                    currentItem.item_price && (
                                                        <div className="text-right text-xs text-gray-600 font-medium">
                                                            Subtotal:{" "}
                                                            {formatNumberWithDots(
                                                                (
                                                                    (parseInt(
                                                                        currentItem.quantity
                                                                    ) || 0) *
                                                                    (parseFloat(
                                                                        parseFormattedNumber(
                                                                            currentItem.item_price
                                                                        )
                                                                    ) || 0)
                                                                ).toString()
                                                            )}
                                                        </div>
                                                    )}

                                                {/* Save Button */}
                                                <button
                                                    type="button"
                                                    onClick={handleSaveItem}
                                                    className="w-full py-2 px-4 bg-growth-green-500 text-white text-sm font-medium rounded hover:bg-growth-green-600 transition-colors"
                                                >
                                                    {editingItemId
                                                        ? "✓ Update Item"
                                                        : "✓ Save Item"}
                                                </button>
                                            </div>
                                        )}

                                        {/* Saved Items List */}
                                        {transactionDetails.length === 0 &&
                                        !showItemForm ? (
                                            <p className="text-sm text-gray-500 text-center py-4">
                                                No items yet. Click "+ Add Item"
                                                to start.
                                            </p>
                                        ) : transactionDetails.length > 0 ? (
                                            <div className="space-y-2">
                                                <h4 className="text-xs font-semibold text-gray-600 mb-2">
                                                    Saved Items:
                                                </h4>
                                                {transactionDetails.map(
                                                    (item, index) => (
                                                        <div
                                                            key={item.id}
                                                            className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                                                        >
                                                            <div className="flex items-start justify-between mb-2">
                                                                <div className="flex-1">
                                                                    <p className="text-sm font-semibold text-gray-800">
                                                                        {
                                                                            item.item_name
                                                                        }
                                                                    </p>
                                                                    <p className="text-xs text-gray-600 mt-1">
                                                                        {
                                                                            item.quantity
                                                                        }{" "}
                                                                        ×{" "}
                                                                        {formatNumberWithDots(
                                                                            item.item_price
                                                                        )}{" "}
                                                                        ={" "}
                                                                        <span className="font-semibold text-growth-green-600">
                                                                            {formatNumberWithDots(
                                                                                (
                                                                                    (parseInt(
                                                                                        item.quantity
                                                                                    ) ||
                                                                                        0) *
                                                                                    (parseFloat(
                                                                                        parseFormattedNumber(
                                                                                            item.item_price
                                                                                        )
                                                                                    ) ||
                                                                                        0)
                                                                                ).toString()
                                                                            )}
                                                                        </span>
                                                                    </p>
                                                                </div>
                                                                <div className="flex gap-2 ml-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleEditItem(
                                                                                item
                                                                            )
                                                                        }
                                                                        className="text-blue-500 hover:text-blue-700 text-xs p-1"
                                                                        title="Edit"
                                                                    >
                                                                        <svg
                                                                            className="w-4 h-4"
                                                                            fill="none"
                                                                            stroke="currentColor"
                                                                            viewBox="0 0 24 24"
                                                                        >
                                                                            <path
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                                strokeWidth={
                                                                                    2
                                                                                }
                                                                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                                                            />
                                                                        </svg>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            removeItem(
                                                                                item.id
                                                                            )
                                                                        }
                                                                        className="text-red-500 hover:text-red-700 text-xs p-1"
                                                                        title="Delete"
                                                                    >
                                                                        <svg
                                                                            className="w-4 h-4"
                                                                            fill="none"
                                                                            stroke="currentColor"
                                                                            viewBox="0 0 24 24"
                                                                        >
                                                                            <path
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                                strokeWidth={
                                                                                    2
                                                                                }
                                                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                                            />
                                                                        </svg>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        ) : null}

                                        {transactionDetails.length > 0 && (
                                            <div className="border-t pt-3 mt-3">
                                                <div className="flex justify-between items-center font-semibold text-gray-700">
                                                    <span>Total Amount:</span>
                                                    <span className="text-lg text-growth-green-500">
                                                        {formatNumberWithDots(
                                                            calculateTotalFromItems().toString()
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Category */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Category*
                                    </label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                category: e.target.value,
                                            })
                                        }
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#058743] focus:border-transparent"
                                        disabled={loadingCategories}
                                        required
                                    >
                                        <option value="">
                                            {loadingCategories
                                                ? "Loading categories..."
                                                : "Select a category"}
                                        </option>
                                        {categories.map((category) => (
                                            <option
                                                key={category.id}
                                                value={category.id}
                                            >
                                                {category.category_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Date */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Date*
                                    </label>
                                    <MonaCalendar
                                        selected={selectedDate}
                                        onChange={handleDateChange}
                                        maxDate={new Date()}
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Description
                                    </label>
                                    <textarea
                                        placeholder="Optional description..."
                                        value={formData.description}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                description: e.target.value,
                                            })
                                        }
                                        rows={4}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#058743] focus:border-transparent resize-none"
                                    />
                                </div>

                                {/* Submit Button */}
                                <div className="relative z-50">
                                    <button
                                        type="submit"
                                        disabled={
                                            submitting || loadingCategories
                                        }
                                        className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
                                            submitting || loadingCategories
                                                ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                                                : "bg-black text-white hover:bg-gray-800"
                                        }`}
                                    >
                                        {submitting
                                            ? "Adding..."
                                            : "Add Transaction"}
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Quick Stats */}
                        <div className="animate-fade-in-up delay-200 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-xl font-semibold mb-2">
                                Quick Stats
                            </h2>
                            <p className="text-gray-600 mb-6">
                                This month's summary
                            </p>

                            <div className="space-y-6">
                                {/* Total Income */}
                                <div className="bg-[#D4EADF] rounded-lg p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-base sm:text-lg md:text-xl lg:text-xl xl:text-xl text-[#058743] mb-2 font-medium">
                                                Total Income
                                            </p>
                                            <p className="text-lg sm:text-xl md:text-2xl lg:text-2xl xl:text-3xl font-bold text-[#058743]">
                                                {stats.loading
                                                    ? "Loading..."
                                                    : formatCurrency(
                                                          stats.totalIncome
                                                      )}
                                            </p>
                                        </div>
                                        <div className="text-[#058743] text-lg sm:text-xl md:text-2xl lg:text-2xl xl:text-3xl">
                                            +
                                        </div>
                                    </div>
                                </div>

                                {/* Total Expenses */}
                                <div className="bg-[#F9E4E3] rounded-lg p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-base sm:text-lg md:text-xl lg:text-xl xl:text-xl text-[#DC3545] mb-2 font-medium">
                                                Total Expenses
                                            </p>
                                            <p className="text-lg sm:text-xl md:text-2xl lg:text-2xl xl:text-3xl font-bold text-[#DC3545]">
                                                {stats.loading
                                                    ? "Loading..."
                                                    : formatCurrency(
                                                          stats.totalExpenses
                                                      )}
                                            </p>
                                        </div>
                                        <div className="text-[#DC3545] text-lg sm:text-xl md:text-2xl lg:text-2xl xl:text-3xl">
                                            -
                                        </div>
                                    </div>
                                </div>

                                {/* Net Balance */}
                                <div className="bg-[#F2F8FE] rounded-lg p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-base sm:text-lg md:text-xl lg:text-xl xl:text-xl text-[#5877D0] mb-2 font-medium">
                                                Net Balance
                                            </p>
                                            <p
                                                className={`text-lg sm:text-xl md:text-2xl lg:text-2xl xl:text-3xl font-bold ${
                                                    stats.netBalance >= 0
                                                        ? "text-[#058743]"
                                                        : "text-[#DC3545]"
                                                }`}
                                            >
                                                {stats.loading
                                                    ? "Loading..."
                                                    : formatCurrency(
                                                          stats.netBalance
                                                      )}
                                            </p>
                                        </div>
                                        <div className="text-[#5877D0] text-lg sm:text-xl md:text-2xl lg:text-2xl xl:text-3xl">
                                            $
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
