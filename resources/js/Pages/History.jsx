import AppLayout from "@/Layouts/AppLayout";
import { Head } from "@inertiajs/react";
import { useState, useRef, useEffect } from "react";
import React from "react";
import axios from "axios";
import EditTransaction from "@/Components/EditTransaction";

// Helper function Rupiah
const formatCurrency = (value) => {
    const number = Math.abs(value);
    const formatted = new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(number);
    return `${value < 0 ? "-" : ""}Rp${formatted}`;
};

export default function History({ auth, categories = [] }) {
    // State filter
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState("All");
    const [filterCategory, setFilterCategory] = useState("All");
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [meta, setMeta] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [message, setMessage] = useState({ type: "", text: "" });
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);

    // State for expandable transaction details
    const [expandedId, setExpandedId] = useState(null);
    const [transactionDetails, setTransactionDetails] = useState({});
    const [loadingDetails, setLoadingDetails] = useState({});

    // State for delete confirmation modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState(null);
    
    // Success modal state
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [successTitle, setSuccessTitle] = useState("");

    // Get categories based on filter type
    const getAvailableCategories = () => {
        if (filterType === "Income") {
            return categories.filter((cat) => cat.type === "income");
        } else if (filterType === "Expense") {
            return categories.filter((cat) => cat.type === "expense");
        } else {
            // Return all categories
            return categories;
        }
    };

    const availableCategories = getAvailableCategories();

    // ✅ Aman dari null values
    const filteredTransactions = transactions.filter((transaction) => {
        const typeMatch =
            filterType === "All" || transaction.type === filterType;
        const categoryMatch =
            filterCategory === "All" ||
            (transaction.category ?? "") === filterCategory;

        const desc = (transaction.description ?? "").toLowerCase();
        const cat = (transaction.category ?? "").toLowerCase();
        const search = (searchTerm ?? "").toLowerCase();

        const searchMatch =
            !search || desc.includes(search) || cat.includes(search);

        return typeMatch && categoryMatch && searchMatch;
    });

    const searchRef = useRef(null);

    // Fetch single transaction details
    const fetchTransactionDetails = async (transactionId) => {
        if (transactionDetails[transactionId]) {
            // Already loaded
            return;
        }

        setLoadingDetails((prev) => ({ ...prev, [transactionId]: true }));

        try {
            const res = await axios.get(`/api/transactions/${transactionId}`, {
                headers: {
                    Accept: "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                },
                withCredentials: true,
            });

            if (res.data.status === "success") {
                setTransactionDetails((prev) => ({
                    ...prev,
                    [transactionId]: res.data.data.details || [],
                }));
            }
        } catch (err) {
            console.error("Failed to fetch transaction details:", err);
            console.error("Error response:", err.response?.data);
            console.error("Error status:", err.response?.status);

            // Set empty array on error
            setTransactionDetails((prev) => ({
                ...prev,
                [transactionId]: [],
            }));

            // Show error message to user
            if (err.response?.status === 404) {
                showMessage(
                    "error",
                    "Transaction not found or has been deleted."
                );
            } else if (err.response?.status === 403) {
                showMessage(
                    "error",
                    "You do not have permission to view this transaction."
                );
            } else {
                // Don't show error for "no details" case - it's expected
                console.log(
                    "Transaction has no itemized details or error fetching details"
                );
            }
        } finally {
            setLoadingDetails((prev) => ({ ...prev, [transactionId]: false }));
        }
    };

    // Toggle expansion
    const toggleExpand = (transactionId) => {
        if (expandedId === transactionId) {
            // Collapse if already expanded
            setExpandedId(null);
        } else {
            // Expand and fetch details
            setExpandedId(transactionId);
            fetchTransactionDetails(transactionId);
        }
    };

    const fetchTransactions = async (page = 1) => {
        setLoading(true);
        setError(null);

        const paramsObj = {};
        if (filterType !== "All") paramsObj.type = filterType.toLowerCase();
        if (filterCategory !== "All" && categoryNameToIdMap[filterCategory]) {
            paramsObj.category_id = categoryNameToIdMap[filterCategory];
        } else if (filterCategory !== "All") {
            paramsObj.search = filterCategory;
        }
        if (searchTerm) paramsObj.search = searchTerm;
        paramsObj.per_page = "100";
        paramsObj.page = String(page);

        try {
            await axios.get("/sanctum/csrf-cookie");
            const res = await axios.get("/api/transactions", {
                params: paramsObj,
                headers: {
                    Accept: "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                },
                withCredentials: true,
            });
            const body = res.data;
            setTransactions(body.data ?? []);
            setMeta(body.meta ?? null);
        } catch (err) {
            if (err?.response?.status === 401) {
                setError("Unauthorized — please log in.");
            } else {
                setError("Failed to fetch transactions.");
            }
        } finally {
            setLoading(false);
        }
    };

    const [categoryNameToIdMap, setCategoryNameToIdMap] = useState({});
    const fetchCategories = async () => {
        try {
            const res = await axios.get("/api/categories", {
                headers: { Accept: "application/json" },
                withCredentials: true,
            });
            const list = res.data?.data ?? res.data ?? [];
            const map = {};
            list.forEach((c) => {
                if (c && c.category_name)
                    map[c.category_name] = c.id ?? c.category_id ?? null;
            });
            setCategoryNameToIdMap(map);
        } catch (e) {
            console.warn("Could not fetch categories", e?.message ?? e);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        clearTimeout(searchRef.current);
        searchRef.current = setTimeout(() => fetchTransactions(1), 300);
        return () => clearTimeout(searchRef.current);
    }, [filterType, filterCategory, searchTerm]);

    const clearFilters = () => {
        setSearchTerm("");
        setFilterType("All");
        setFilterCategory("All");
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    };

    const handleDelete = async (transactionId) => {
        // Show custom modal instead of browser confirm
        setTransactionToDelete(transactionId);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!transactionToDelete) return;

        setDeletingId(transactionToDelete);
        setShowDeleteModal(false);

        try {
            const response = await axios.delete(
                `/api/transactions/${transactionToDelete}`,
                {
                    headers: {
                        Accept: "application/json",
                        "X-Requested-With": "XMLHttpRequest",
                    },
                    withCredentials: true,
                }
            );

            if (response.data.status === "success") {
                // Show success modal
                setSuccessTitle("Transaction Deleted!");
                setSuccessMessage("The transaction has been successfully removed.");
                setShowSuccessModal(true);
                
                // Auto-dismiss after 2 seconds
                setTimeout(() => {
                    setShowSuccessModal(false);
                }, 2000);
                
                // Dispatch event for notification bell to refresh
                window.dispatchEvent(new CustomEvent('transaction-deleted'));
                // Refresh the transactions list
                fetchTransactions(1);
            }
        } catch (error) {
            console.error("Error deleting transaction:", error);

            if (error.response?.status === 404) {
                showMessage("error", "Transaction not found.");
            } else if (error.response?.status === 403) {
                showMessage(
                    "error",
                    "You are not authorized to delete this transaction."
                );
            } else {
                showMessage(
                    "error",
                    "Failed to delete transaction. Please try again."
                );
            }
        } finally {
            setDeletingId(null);
            setTransactionToDelete(null);
        }
    };

    const cancelDelete = () => {
        setShowDeleteModal(false);
        setTransactionToDelete(null);
    };

    const handleEdit = (transaction) => {
        // Convert the transaction data to the format expected by EditTransaction
        const editData = {
            id: transaction.id,
            type: transaction.type?.toLowerCase(), // Convert "Income"/"Expense" to "income"/"expense"
            amount: Math.abs(transaction.amount || 0), // Always positive for editing
            category_id: categoryNameToIdMap[transaction.category] || null,
            transaction_date: null, // Will be set from API if needed
            description: transaction.description || "",
        };

        // Try to find the exact date format - we might need to convert from display format
        if (transaction.date) {
            // Convert from "1/9/2025" format to "YYYY-MM-DD" format
            const dateParts = transaction.date.split("/");
            if (dateParts.length === 3) {
                const [day, month, year] = dateParts;
                editData.transaction_date = `${year}-${month.padStart(
                    2,
                    "0"
                )}-${day.padStart(2, "0")}`;
            }
        }

        setEditingTransaction(editData);
        setShowEditModal(true);
    };

    const handleEditClose = () => {
        setShowEditModal(false);
        setEditingTransaction(null);
    };

    const handleEditUpdate = () => {
        // Show success modal
        setSuccessTitle("Transaction Updated!");
        setSuccessMessage("Your transaction has been successfully updated.");
        setShowSuccessModal(true);
        
        // Auto-dismiss after 2 seconds
        setTimeout(() => {
            setShowSuccessModal(false);
        }, 2000);
        
        // Refresh transactions after successful update
        fetchTransactions(1);
    };

    const totalTransactions = filteredTransactions.length;
    const totalIncome = filteredTransactions
        .filter((t) => t.type === "Income")
        .reduce((sum, t) => sum + (t.amount ?? 0), 0);
    const totalExpenses = filteredTransactions
        .filter((t) => t.type === "Expense")
        .reduce((sum, t) => sum + (t.amount ?? 0), 0);

    return (
        <AppLayout title="MONA - History" auth={auth}>
            <Head title="History" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 md:py-8 bg-[F8F7F0]">
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
                        @keyframes slideDown {
                            from {
                                opacity: 0;
                                max-height: 0;
                                transform: translateY(-10px);
                            }
                            to {
                                opacity: 1;
                                max-height: 500px;
                                transform: translateY(0);
                            }
                        }
                        .animate-fade-in {
                            animation: fadeIn 0.8s ease-out forwards;
                        }
                        .animate-fade-in-up {
                            animation: fadeInUp 0.8s ease-out forwards;
                        }
                        .animate-slide-down {
                            animation: slideDown 0.3s ease-out forwards;
                        }
                        .delay-100 { animation-delay: 0.1s; opacity: 0; }
                        .delay-200 { animation-delay: 0.2s; opacity: 0; }
                        .delay-300 { animation-delay: 0.3s; opacity: 0; }
                        .delay-400 { animation-delay: 0.4s; opacity: 0; }
                        .delay-500 { animation-delay: 0.5s; opacity: 0; }
                    `}</style>

                {/* Summary */}
                <div className="mb-6 sm:mb-8 animate-fade-in">
                    <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-3xl xl:text-4xl font-bold text-charcoal mb-2">
                        Transaction History
                    </h1>
                    <p className="text-xs sm:text-sm md:text-base lg:text-base xl:text-lg text-medium-gray">
                        View and manage all your transactions
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
                    <div className="animate-fade-in-up delay-100 bg-white p-4 sm:p-6 rounded-lg shadow-md">
                        <h3 className="text-xs sm:text-sm text-gray-500">
                            Total Transactions
                        </h3>
                        <p className="text-lg sm:text-xl md:text-xl lg:text-xl xl:text-2xl font-bold text-gray-800">
                            {totalTransactions}
                        </p>
                    </div>
                    <div className="animate-fade-in-up delay-200 bg-white p-4 sm:p-6 rounded-lg shadow-md">
                        <h3 className="text-xs sm:text-sm text-gray-500">
                            Total Income
                        </h3>
                        <p className="text-lg sm:text-xl md:text-xl lg:text-xl xl:text-2xl font-bold text-green-600">
                            {formatCurrency(totalIncome)}
                        </p>
                    </div>
                    <div className="animate-fade-in-up delay-300 bg-white p-4 sm:p-6 rounded-lg shadow-md">
                        <h3 className="text-xs sm:text-sm text-gray-500">
                            Total Expenses
                        </h3>
                        <p className="text-lg sm:text-xl md:text-xl lg:text-xl xl:text-2xl font-bold text-red-600">
                            {formatCurrency(totalExpenses)}
                        </p>
                    </div>
                </div>

                {/* Filters */}
                <div className="animate-fade-in-up delay-400 bg-white p-3 sm:p-4 rounded-lg shadow-md mb-6 sm:mb-8 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                    <input
                        type="text"
                        placeholder="Search Transaction..."
                        className="w-full text-sm sm:text-base border-gray-300 rounded-md px-3 sm:px-4 py-2 focus:ring-green-500 focus:border-green-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <select
                        value={filterType}
                        onChange={(e) => {
                            setFilterType(e.target.value);
                            setFilterCategory("All");
                        }}
                        className="w-full sm:w-auto text-sm sm:text-base border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                    >
                        <option value="All">All Types</option>
                        <option value="Income">Income</option>
                        <option value="Expense">Expense</option>
                    </select>
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="w-full sm:w-auto text-sm sm:text-base border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                    >
                        <option value="All">All Categories</option>
                        {availableCategories.map((category) => (
                            <option
                                key={category.id}
                                value={category.category_name}
                            >
                                {category.category_name}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={clearFilters}
                        className="w-full sm:w-auto text-sm sm:text-base text-gray-600 px-3 sm:px-4 py-2 rounded-md hover:bg-gray-100 transition flex-shrink-0"
                    >
                        Clear Filters
                    </button>
                </div>

                {/* Transactions Table */}
                <div className="animate-fade-in-up delay-500 bg-white overflow-hidden shadow-md rounded-lg">
                    <div className="p-4 sm:p-6">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                            Transactions
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-500">
                            Showing {filteredTransactions.length} transactions
                        </p>
                    </div>
                    {loading && (
                        <div className="p-6 text-center text-gray-500">
                            Loading...
                        </div>
                    )}
                    {error && (
                        <div className="p-6 text-center text-red-600">
                            {error}
                        </div>
                    )}

                    {/* Desktop Table View - Hidden on mobile and tablet */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Type
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Category
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Description
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Amount
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredTransactions.map((transaction) => (
                                    <React.Fragment key={transaction.id}>
                                        <tr
                                            className="hover:bg-gray-50 cursor-pointer transition-colors"
                                            onClick={() =>
                                                toggleExpand(transaction.id)
                                            }
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                <div className="flex items-center gap-2">
                                                    <svg
                                                        className={`w-4 h-4 transition-transform ${
                                                            expandedId ===
                                                            transaction.id
                                                                ? "rotate-90"
                                                                : ""
                                                        }`}
                                                        fill="currentColor"
                                                        viewBox="0 0 20 20"
                                                    >
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                    {transaction.date ?? "-"}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                        transaction.type ===
                                                        "Income"
                                                            ? "bg-green-100 text-green-800"
                                                            : "bg-red-100 text-red-800"
                                                    }`}
                                                >
                                                    {transaction.type ?? "-"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {transaction.category ?? "-"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {transaction.description ?? "-"}
                                            </td>
                                            <td
                                                className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                                                    (transaction.amount ?? 0) >=
                                                    0
                                                        ? "text-green-600"
                                                        : "text-red-600"
                                                }`}
                                            >
                                                {formatCurrency(
                                                    transaction.amount ?? 0
                                                )}
                                            </td>
                                            <td
                                                className="px-6 py-4 whitespace-nowrap text-sm font-medium"
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                            >
                                                <div className="flex items-center gap-4">
                                                    <button
                                                        onClick={() =>
                                                            handleEdit(
                                                                transaction
                                                            )
                                                        }
                                                        className="disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-70"
                                                        disabled={
                                                            deletingId ===
                                                            transaction.id
                                                        }
                                                        title="Edit transaction"
                                                    >
                                                        <img
                                                            src="/images/icons/edit-icon.svg"
                                                            alt="Edit"
                                                            className="h-5 w-5"
                                                            style={{
                                                                filter: "invert(38%) sepia(91%) saturate(1951%) hue-rotate(201deg) brightness(97%) contrast(101%)",
                                                            }}
                                                        />
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            handleDelete(
                                                                transaction.id
                                                            )
                                                        }
                                                        disabled={
                                                            deletingId ===
                                                            transaction.id
                                                        }
                                                        className="disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-70"
                                                        title="Delete transaction"
                                                    >
                                                        {deletingId ===
                                                        transaction.id ? (
                                                            <div className="animate-spin h-5 w-5 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                                                        ) : (
                                                            <img
                                                                src="/images/icons/delete-icon.svg"
                                                                alt="Delete"
                                                                className="h-5 w-5"
                                                                style={{
                                                                    filter: "invert(27%) sepia(94%) saturate(4601%) hue-rotate(352deg) brightness(94%) contrast(93%)",
                                                                }}
                                                            />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {/* Expandable Details Row */}
                                        {expandedId === transaction.id && (
                                            <tr className="bg-gray-50">
                                                <td
                                                    colSpan="6"
                                                    className="px-6 py-4"
                                                >
                                                    <div className="animate-slide-down">
                                                        {loadingDetails[
                                                            transaction.id
                                                        ] ? (
                                                            <div className="text-center text-gray-500 py-4">
                                                                Loading
                                                                details...
                                                            </div>
                                                        ) : transactionDetails[
                                                              transaction.id
                                                          ]?.length > 0 ? (
                                                            <div className="space-y-2">
                                                                <h4 className="font-semibold text-gray-700 mb-3">
                                                                    Transaction
                                                                    Items:
                                                                </h4>
                                                                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                                                    <table className="min-w-full divide-y divide-gray-200">
                                                                        <thead className="bg-gray-100">
                                                                            <tr>
                                                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                                                                                    Item
                                                                                    Name
                                                                                </th>
                                                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                                                                                    Quantity
                                                                                </th>
                                                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                                                                                    Price
                                                                                </th>
                                                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">
                                                                                    Subtotal
                                                                                </th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-gray-200">
                                                                            {transactionDetails[
                                                                                transaction
                                                                                    .id
                                                                            ].map(
                                                                                (
                                                                                    detail,
                                                                                    idx
                                                                                ) => (
                                                                                    <tr
                                                                                        key={
                                                                                            detail.id ||
                                                                                            idx
                                                                                        }
                                                                                        className="hover:bg-gray-50"
                                                                                    >
                                                                                        <td className="px-4 py-3 text-sm text-gray-700">
                                                                                            {
                                                                                                detail.item_name
                                                                                            }
                                                                                        </td>
                                                                                        <td className="px-4 py-3 text-sm text-gray-600">
                                                                                            {
                                                                                                detail.quantity
                                                                                            }
                                                                                        </td>
                                                                                        <td className="px-4 py-3 text-sm text-gray-600">
                                                                                            {formatCurrency(
                                                                                                detail.item_price
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="px-4 py-3 text-sm font-medium text-gray-700">
                                                                                            {formatCurrency(
                                                                                                detail.subtotal
                                                                                            )}
                                                                                        </td>
                                                                                    </tr>
                                                                                )
                                                                            )}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-center text-gray-500 py-4">
                                                                No itemized
                                                                details for this
                                                                transaction
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Tablet & Mobile Card View - Shown below lg breakpoint */}
                    <div className="lg:hidden divide-y divide-gray-200">
                        {filteredTransactions.map((transaction) => (
                            <div
                                key={transaction.id}
                                className="hover:bg-gray-50"
                            >
                                <div
                                    className="p-4 sm:p-5 md:p-6 cursor-pointer"
                                    onClick={() => toggleExpand(transaction.id)}
                                >
                                    {/* Header: Date and Type Badge */}
                                    <div className="flex justify-between items-start mb-3 md:mb-4">
                                        <div className="flex items-center gap-2">
                                            <svg
                                                className={`w-4 h-4 transition-transform ${
                                                    expandedId ===
                                                    transaction.id
                                                        ? "rotate-90"
                                                        : ""
                                                }`}
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                            <span className="text-xs sm:text-sm md:text-base text-gray-500">
                                                {transaction.date ?? "-"}
                                            </span>
                                        </div>
                                        <span
                                            className={`px-2 md:px-3 py-1 text-xs md:text-sm font-semibold rounded-full ${
                                                transaction.type === "Income"
                                                    ? "bg-green-100 text-green-800"
                                                    : "bg-red-100 text-red-800"
                                            }`}
                                        >
                                            {transaction.type ?? "-"}
                                        </span>
                                    </div>

                                    {/* Category and Description */}
                                    <div className="mb-3 md:mb-4">
                                        <p className="text-sm md:text-base font-medium text-gray-900">
                                            {transaction.category ?? "-"}
                                        </p>
                                        <p className="text-xs md:text-sm text-gray-600 mt-1">
                                            {transaction.description ?? "-"}
                                        </p>
                                    </div>

                                    {/* Amount and Actions */}
                                    <div className="flex justify-between items-center">
                                        <span
                                            className={`text-base md:text-lg font-bold ${
                                                (transaction.amount ?? 0) >= 0
                                                    ? "text-green-600"
                                                    : "text-red-600"
                                            }`}
                                        >
                                            {formatCurrency(
                                                transaction.amount ?? 0
                                            )}
                                        </span>
                                        <div
                                            className="flex items-center gap-3 md:gap-4"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <button
                                                onClick={() =>
                                                    handleEdit(transaction)
                                                }
                                                className="disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-70"
                                                disabled={
                                                    deletingId ===
                                                    transaction.id
                                                }
                                                title="Edit transaction"
                                            >
                                                <img
                                                    src="/images/icons/edit-icon.svg"
                                                    alt="Edit"
                                                    className="h-5 w-5 md:h-6 md:w-6"
                                                    style={{
                                                        filter: "invert(38%) sepia(91%) saturate(1951%) hue-rotate(201deg) brightness(97%) contrast(101%)",
                                                    }}
                                                />
                                            </button>
                                            <button
                                                onClick={() =>
                                                    handleDelete(transaction.id)
                                                }
                                                disabled={
                                                    deletingId ===
                                                    transaction.id
                                                }
                                                className="disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-70"
                                                title="Delete transaction"
                                            >
                                                {deletingId ===
                                                transaction.id ? (
                                                    <div className="animate-spin h-5 w-5 md:h-6 md:w-6 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                                                ) : (
                                                    <img
                                                        src="/images/icons/delete-icon.svg"
                                                        alt="Delete"
                                                        className="h-5 w-5 md:h-6 md:w-6"
                                                        style={{
                                                            filter: "invert(27%) sepia(94%) saturate(4601%) hue-rotate(352deg) brightness(94%) contrast(93%)",
                                                        }}
                                                    />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Expandable Details */}
                                {expandedId === transaction.id && (
                                    <div className="px-4 sm:px-5 md:px-6 pb-4 sm:pb-5 md:pb-6 bg-gray-50 animate-slide-down">
                                        {loadingDetails[transaction.id] ? (
                                            <div className="text-center text-gray-500 py-4 text-sm">
                                                Loading details...
                                            </div>
                                        ) : transactionDetails[transaction.id]
                                              ?.length > 0 ? (
                                            <div className="space-y-2">
                                                <h4 className="font-semibold text-gray-700 mb-3 text-sm md:text-base">
                                                    Transaction Items:
                                                </h4>
                                                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                                    {transactionDetails[
                                                        transaction.id
                                                    ].map((detail, idx) => (
                                                        <div
                                                            key={
                                                                detail.id || idx
                                                            }
                                                            className="p-3 border-b last:border-b-0 hover:bg-gray-50"
                                                        >
                                                            <div className="flex justify-between items-start mb-2">
                                                                <span className="text-sm md:text-base font-medium text-gray-700">
                                                                    {
                                                                        detail.item_name
                                                                    }
                                                                </span>
                                                                <span className="text-sm md:text-base font-semibold text-gray-900">
                                                                    {formatCurrency(
                                                                        detail.subtotal
                                                                    )}
                                                                </span>
                                                            </div>
                                                            <div className="flex gap-4 text-xs md:text-sm text-gray-600">
                                                                <span>
                                                                    Qty:{" "}
                                                                    {
                                                                        detail.quantity
                                                                    }
                                                                </span>
                                                                <span>×</span>
                                                                <span>
                                                                    {formatCurrency(
                                                                        detail.item_price
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center text-gray-500 py-4 text-xs md:text-sm">
                                                No itemized details for this
                                                transaction
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-modalFadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all animate-modalSlideUp">
                        <div className="p-6">
                            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4 animate-scaleIn">
                                <svg
                                    className="w-6 h-6 text-red-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
                                Delete Transaction
                            </h3>
                            <p className="text-gray-600 text-center mb-6">
                                Are you sure you want to delete this transaction? This action cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={cancelDelete}
                                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors duration-200"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-modalFadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all animate-modalSlideUp">
                        <div className="p-8 text-center">
                            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-[#058743] rounded-full mb-4 animate-scaleIn">
                                <svg
                                    className="w-8 h-8 text-white animate-checkmark"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={3}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                {successTitle}
                            </h3>
                            <p className="text-gray-600">
                                {successMessage}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Transaction Modal */}
            {showEditModal && editingTransaction && (
                <EditTransaction
                    transaction={editingTransaction}
                    onClose={handleEditClose}
                    onUpdate={handleEditUpdate}
                />
            )}
        </AppLayout>
    );
}
