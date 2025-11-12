import { useState, useEffect } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// Helper functions for number formatting
const formatNumberWithDots = (value) => {
    // Handle empty or undefined values
    if (!value) return "";
    // Remove all non-digits
    const digits = String(value).replace(/\D/g, "");

    // Add dots every 3 digits from right to left
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const parseFormattedNumber = (formattedValue) => {
    // Remove dots to get raw number
    return formattedValue.replace(/\./g, "");
};

export default function EditTransaction({ transaction, onClose, onUpdate }) {
    // Initialize with the transaction's type if available, otherwise default to 'expense'
    const [transactionType, setTransactionType] = useState(
        transaction?.type ? transaction.type.toLowerCase() : "expense"
    );
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [notification, setNotification] = useState({ message: "", type: "" });
    const [showNotification, setShowNotification] = useState(false);
    const [showDateWarning, setShowDateWarning] = useState(false);
    const [formData, setFormData] = useState({
        amount: "",
        category: "",
        date: "",
        description: "",
    });
    const [transactionDetails, setTransactionDetails] = useState([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Format date for display as DD/MM/YYYY
    const formatDateForDisplay = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "";
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Initialize form data when transaction prop changes
    useEffect(() => {
        if (transaction) {
            // Determine transaction type based on amount or type field
            const type = transaction.type
                ? transaction.type.toLowerCase()
                : transaction.amount < 0
                ? "expense"
                : "income";

            setTransactionType(type);
            setFormData({
                amount: Math.abs(transaction.amount || 0).toString(), // Always positive in form
                category: transaction.category_id || "",
                date: transaction.transaction_date
                    ? transaction.transaction_date.split("T")[0]
                    : "",
                description: transaction.description || "",
            });

            // Fetch full transaction details including items
            fetchTransactionDetails();
        }
    }, [transaction]);

    // Fetch transaction details from API
    const fetchTransactionDetails = async () => {
        if (!transaction?.id) return;

        setLoadingDetails(true);
        try {
            const response = await axios.get(
                `/api/transactions/${transaction.id}`,
                {
                    headers: {
                        Accept: "application/json",
                        "X-Requested-With": "XMLHttpRequest",
                    },
                    withCredentials: true,
                }
            );

            if (
                response.data.status === "success" &&
                response.data.data.details
            ) {
                // Format the details for editing
                const details = response.data.data.details.map((detail) => ({
                    id: detail.id,
                    item_name: detail.item_name || "",
                    quantity: detail.quantity || 1,
                    item_price: detail.item_price?.toString() || "",
                    category_id:
                        detail.category_id || transaction.category_id || "",
                }));
                setTransactionDetails(details);
            }
        } catch (error) {
            console.error("Error fetching transaction details:", error);
            // If no details exist, that's okay - start with empty array
            setTransactionDetails([]);
        } finally {
            setLoadingDetails(false);
        }
    };

    // Fetch categories from API based on transaction type
    const fetchCategories = async (type) => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/categories?type=${type}`);
            setCategories(response.data);
        } catch (error) {
            console.error("Error fetching categories:", error);
            setCategories([]);
        } finally {
            setLoading(false);
        }
    };

    // Load categories when component mounts or transaction type changes
    useEffect(() => {
        fetchCategories(transactionType);
        // Only reset category if user manually changes the type (not on initial load)
        // We keep the category from formData during initial population
    }, [transactionType]);

    // Hide notification after 3 seconds
    useEffect(() => {
        if (notification.message) {
            setShowNotification(true);
            const timer = setTimeout(() => setShowNotification(false), 2700);
            const timer2 = setTimeout(
                () => setNotification({ message: "", type: "" }),
                3000
            );
            return () => {
                clearTimeout(timer);
                clearTimeout(timer2);
            };
        }
    }, [notification]);

    // Add new transaction detail item
    const addDetailItem = () => {
        setTransactionDetails([
            ...transactionDetails,
            {
                item_name: "",
                quantity: 1,
                item_price: "",
                category_id: formData.category || "",
            },
        ]);
    };

    // Update a specific detail item
    const updateDetailItem = (index, field, value) => {
        const updatedDetails = [...transactionDetails];
        updatedDetails[index][field] = value;
        setTransactionDetails(updatedDetails);
    };

    // Remove a detail item
    const removeDetailItem = (index) => {
        const updatedDetails = transactionDetails.filter((_, i) => i !== index);
        setTransactionDetails(updatedDetails);
    };

    // Calculate total from detail items
    const calculateTotalFromDetails = () => {
        return transactionDetails.reduce((total, detail) => {
            const quantity = Number(detail.quantity) || 0;
            const price = Number(parseFormattedNumber(detail.item_price)) || 0;
            return total + quantity * price;
        }, 0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // If there are transaction details, use the calculated total
        let finalAmount;
        if (transactionDetails.length > 0) {
            finalAmount = calculateTotalFromDetails();

            // Validate all detail items
            for (let i = 0; i < transactionDetails.length; i++) {
                const detail = transactionDetails[i];
                if (!detail.item_name?.trim()) {
                    setNotification({
                        message: `Item ${i + 1}: Item name is required.`,
                        type: "error",
                    });
                    return;
                }
                const quantity = Number(detail.quantity);
                if (Number.isNaN(quantity) || quantity <= 0) {
                    setNotification({
                        message: `Item ${
                            i + 1
                        }: Quantity must be a positive number.`,
                        type: "error",
                    });
                    return;
                }
                const price = Number(parseFormattedNumber(detail.item_price));
                if (Number.isNaN(price) || price <= 0) {
                    setNotification({
                        message: `Item ${
                            i + 1
                        }: Price must be a positive number.`,
                        type: "error",
                    });
                    return;
                }
            }

            if (finalAmount <= 0) {
                setNotification({
                    message: "Total amount must be greater than zero.",
                    type: "error",
                });
                return;
            }
        } else {
            // Use the manual amount if no details
            finalAmount = Number(formData.amount);
            if (Number.isNaN(finalAmount) || finalAmount <= 0) {
                setNotification({
                    message: "Amount must be a valid positive number.",
                    type: "error",
                });
                return;
            }
        }

        if (!formData.category) {
            setNotification({
                message: "Please select a category.",
                type: "error",
            });
            return;
        }

        if (!formData.date) {
            setNotification({
                message: "Please select a date.",
                type: "error",
            });
            return;
        }

        setSubmitting(true);
        try {
            const requestData = {
                category_id: Number(formData.category),
                amount: finalAmount,
                description: formData.description || null,
                transaction_date: formData.date,
            };

            // Add transaction details if they exist
            if (transactionDetails.length > 0) {
                requestData.transaction_details = transactionDetails.map(
                    (detail) => ({
                        item_name: detail.item_name,
                        quantity: Number(detail.quantity),
                        item_price: Number(
                            parseFormattedNumber(detail.item_price)
                        ),
                        category_id: Number(
                            detail.category_id || formData.category
                        ),
                    })
                );
            }

            // Use PUT method for updating
            const response = await axios.put(
                `/api/transactions/${transaction.id}`,
                requestData,
                {
                    headers: {
                        "Content-Type": "application/json",
                        "X-Requested-With": "XMLHttpRequest",
                    },
                    withCredentials: true,
                }
            );

            console.log("Transaction updated:", response.data);
            
            // Close modal immediately
            onClose();
            
            // Call onUpdate callback to refresh and show success modal
            if (onUpdate) {
                onUpdate();
            }
        } catch (err) {
            setNotification({
                message: "Failed to update transaction.",
                type: "error",
            });
            console.error(
                "Failed to update transaction:",
                err?.response?.data || err.message
            );
        } finally {
            setSubmitting(false);
        }
    };

    // Handle backdrop click to close modal
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!transaction) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-hidden"
            onClick={handleBackdropClick}
        >
            {/* Floating Notification (bottom left, animated) */}
            {notification.message && (
                <div
                    className={`fixed bottom-8 left-8 z-[9999] px-6 py-3 rounded-lg shadow-lg transition-all duration-300
                        ${
                            notification.type === "success"
                                ? "bg-green-500 text-white"
                                : "bg-red-500 text-white"
                        }
                        ${
                            showNotification
                                ? "animate-fade-in"
                                : "animate-fade-out"
                        }`}
                    style={{ pointerEvents: "none" }}
                >
                    <style>{`
                        @keyframes fadeInNotif { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
                        @keyframes fadeOutNotif { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(20px) scale(0.95); } }
                        .animate-fade-in { animation: fadeInNotif 0.3s ease-out; }
                        .animate-fade-out { animation: fadeOutNotif 0.3s ease-in; }
                    `}</style>
                    {notification.message}
                </div>
            )}

            {/* Floating Date Warning Notification (top right) */}
            {showDateWarning && (
                <div className="fixed top-4 right-4 z-[9999] animate-slide-in-right">
                    <div className="bg-white rounded-lg shadow-lg border-l-4 border-red-500 p-4 max-w-sm">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                                <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h4 className="text-sm font-semibold text-gray-900 mb-1">Can't Select Future Date</h4>
                                <p className="text-sm text-gray-600">Please select today or a past date.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden flex flex-col">
                {/* Header - Sticky */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white rounded-t-lg sticky top-0 z-10">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Edit Transaction
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {/* Form Content - Scrollable */}
                <div className="p-6 overflow-y-auto flex-1">
                    {loadingDetails ? (
                        <div className="text-center text-gray-500 py-8">
                            Loading transaction details...
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Income/Expense Buttons */}
                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setTransactionType("income")}
                                    className={`flex-1 py-3 px-6 rounded-lg text-sm font-medium transition-colors ${
                                        transactionType === "income"
                                            ? "bg-[#058743] text-white"
                                            : "bg-[#D4EADF] text-[#058743] hover:bg-[#C0E0CB]"
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
                                            ? "bg-[#DC3545] text-white"
                                            : "bg-[#F9E4E3] text-[#DC3545] hover:bg-[#F5D2D0]"
                                    }`}
                                >
                                    - Expense
                                </button>
                            </div>

                            {/* Transaction Details Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Transaction Items{" "}
                                        {transactionDetails.length > 0 &&
                                            `(${transactionDetails.length})`}
                                    </label>
                                    <button
                                        type="button"
                                        onClick={addDetailItem}
                                        className="text-sm text-[#058743] hover:text-[#046635] font-medium flex items-center gap-1"
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
                                                strokeWidth={2}
                                                d="M12 4v16m8-8H4"
                                            />
                                        </svg>
                                        Add Item
                                    </button>
                                </div>

                                {transactionDetails.length > 0 && (
                                    <div className="space-y-3">
                                        {transactionDetails.map(
                                            (detail, index) => (
                                                <div
                                                    key={index}
                                                    className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3"
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-sm font-medium text-gray-700">
                                                            Item {index + 1}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                removeDetailItem(
                                                                    index
                                                                )
                                                            }
                                                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                                            Item Name*
                                                        </label>
                                                        <input
                                                            type="text"
                                                            placeholder="e.g., Coffee, Notebook"
                                                            value={
                                                                detail.item_name
                                                            }
                                                            onChange={(e) =>
                                                                updateDetailItem(
                                                                    index,
                                                                    "item_name",
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#058743] focus:border-transparent"
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                                Quantity*
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                placeholder="1"
                                                                value={
                                                                    detail.quantity
                                                                }
                                                                onChange={(e) =>
                                                                    updateDetailItem(
                                                                        index,
                                                                        "quantity",
                                                                        e.target
                                                                            .value
                                                                    )
                                                                }
                                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#058743] focus:border-transparent"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                                Price*
                                                            </label>
                                                            <input
                                                                type="text"
                                                                placeholder="0"
                                                                value={formatNumberWithDots(
                                                                    detail.item_price
                                                                )}
                                                                onChange={(
                                                                    e
                                                                ) => {
                                                                    const rawValue =
                                                                        parseFormattedNumber(
                                                                            e
                                                                                .target
                                                                                .value
                                                                        );
                                                                    updateDetailItem(
                                                                        index,
                                                                        "item_price",
                                                                        rawValue
                                                                    );
                                                                }}
                                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#058743] focus:border-transparent"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="pt-2 border-t border-gray-300">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-xs text-gray-600">
                                                                Subtotal:
                                                            </span>
                                                            <span className="text-sm font-semibold text-gray-900">
                                                                Rp
                                                                {formatNumberWithDots(
                                                                    (Number(
                                                                        detail.quantity
                                                                    ) || 0) *
                                                                        (Number(
                                                                            parseFormattedNumber(
                                                                                detail.item_price
                                                                            )
                                                                        ) || 0)
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        )}

                                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-gray-700">
                                                    Total Amount:
                                                </span>
                                                <span className="text-lg font-bold text-[#058743]">
                                                    Rp
                                                    {formatNumberWithDots(
                                                        calculateTotalFromDetails()
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {transactionDetails.length === 0 && (
                                    <div className="text-center py-6 text-gray-500 text-sm bg-gray-50 rounded-lg border border-gray-200">
                                        No items added. Click "Add Item" to add
                                        transaction details.
                                    </div>
                                )}
                            </div>

                            {/* Amount (only show if no details) */}
                            {transactionDetails.length === 0 && (
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
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#058743] focus:border-transparent"
                                        required
                                    />
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
                                    disabled={loading}
                                    required
                                >
                                    <option value="">
                                        {loading
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
                            <div className="relative">
                                <DatePicker
                                    selected={formData.date ? new Date(formData.date) : null}
                                    onChange={(date) => {
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        const selectedDate = new Date(date);
                                        selectedDate.setHours(0, 0, 0, 0);
                                        
                                        if (selectedDate > today) {
                                            // Show warning for future dates
                                            setShowDateWarning(true);
                                            setTimeout(() => setShowDateWarning(false), 3000);
                                        } else {
                                            const year = date.getFullYear();
                                            const month = String(date.getMonth() + 1).padStart(2, '0');
                                            const day = String(date.getDate()).padStart(2, '0');
                                            setFormData({ ...formData, date: `${year}-${month}-${day}` });
                                        }
                                    }}
                                    dateFormat="dd/MM/yyyy"
                                    placeholderText="DD/MM/YYYY"
                                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#058743] focus:border-transparent cursor-pointer"
                                    calendarClassName="custom-calendar"
                                    wrapperClassName="w-full"
                                    showPopperArrow={false}
                                    required
                                    onChangeRaw={(e) => e.preventDefault()}
                                    onKeyDown={(e) => {
                                        // Prevent all keyboard input except Tab for accessibility
                                        if (e.key !== 'Tab') {
                                            e.preventDefault();
                                        }
                                    }}
                                />
                                {/* Calendar icon */}
                                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                                    <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            </div>
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
                        </form>
                    )}
                </div>

                {/* Footer - Sticky */}
                <div className="flex gap-4 p-6 border-t border-gray-200 bg-white rounded-b-lg sticky bottom-0 z-10">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting || loadingDetails}
                        className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                            submitting || loadingDetails
                                ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                                : "bg-[#058743] text-white hover:bg-[#046635]"
                        }`}
                    >
                        {submitting ? "Updating..." : "Update Transaction"}
                    </button>
                </div>
            </div>
            
            {/* DatePicker Custom Styles */}
            <style>{`
                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                .animate-slide-in-right {
                    animation: slideInRight 0.3s ease-out;
                }
                
                /* Base DatePicker Styles */
                .react-datepicker {
                    font-family: inherit !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15) !important;
                    border-radius: 16px !important;
                    padding: 16px !important;
                    background-color: white !important;
                }

                .react-datepicker__header {
                    background-color: white !important;
                    border-bottom: 1px solid #f0f0f0 !important;
                    padding: 16px 0 !important;
                    border-top-left-radius: 16px !important;
                    border-top-right-radius: 16px !important;
                }

                .react-datepicker__current-month {
                    font-size: 18px !important;
                    font-weight: 700 !important;
                    color: #1a1a1a !important;
                    margin-bottom: 12px !important;
                }

                .react-datepicker__day-names {
                    display: flex !important;
                    justify-content: space-between !important;
                    margin-top: 12px !important;
                }

                .react-datepicker__day-name {
                    color: #666 !important;
                    font-weight: 600 !important;
                    font-size: 13px !important;
                    width: 40px !important;
                    line-height: 40px !important;
                    margin: 0 !important;
                }

                .react-datepicker__month {
                    margin: 0 !important;
                    padding: 8px 0 !important;
                }

                .react-datepicker__week {
                    display: flex !important;
                    justify-content: space-between !important;
                }

                .react-datepicker__day {
                    width: 40px !important;
                    height: 40px !important;
                    line-height: 40px !important;
                    margin: 2px !important;
                    border-radius: 8px !important;
                    color: #1a1a1a !important;
                    font-weight: 500 !important;
                    transition: all 0.2s ease !important;
                }

                .react-datepicker__day:hover {
                    background-color: #f5f5f5 !important;
                    border-radius: 8px !important;
                }

                /* Selected date - Growth Green background with white text */
                .react-datepicker__day--selected {
                    background-color: #058743 !important;
                    color: white !important;
                    font-weight: 600 !important;
                }

                .react-datepicker__day--selected:hover {
                    background-color: #046d36 !important;
                }

                /* Remove keyboard-selected state to avoid "half pressed" appearance */
                .react-datepicker__day--keyboard-selected {
                    background-color: transparent !important;
                    color: inherit !important;
                }

                .react-datepicker__day--keyboard-selected:hover {
                    background-color: #f5f5f5 !important;
                }

                /* Today's date - Growth Green color with light background */
                .react-datepicker__day--today {
                    font-weight: 600 !important;
                    color: #058743 !important;
                    background-color: #d4eadf !important;
                }

                .react-datepicker__day--today:hover {
                    background-color: #c0e0cb !important;
                }

                /* Selected date overrides today styling - solid growth green */
                .react-datepicker__day--selected.react-datepicker__day--today {
                    background-color: #058743 !important;
                    color: white !important;
                    font-weight: 600 !important;
                }

                .react-datepicker__day--outside-month {
                    color: #d0d0d0 !important;
                }

                .react-datepicker__navigation {
                    top: 20px !important;
                }

                .react-datepicker__navigation-icon::before {
                    border-color: #666 !important;
                    border-width: 2px 2px 0 0 !important;
                }

                .react-datepicker__navigation:hover *::before {
                    border-color: #058743 !important;
                }

                /* Mobile adjustments */
                @media (max-width: 640px) {
                    .react-datepicker {
                        width: 100% !important;
                        max-width: none !important;
                        padding: 8px !important;
                    }

                    .react-datepicker__current-month {
                        font-size: 13px !important;
                    }

                    .react-datepicker__day-name,
                    .react-datepicker__day {
                        width: 28px !important;
                        height: 28px !important;
                        line-height: 28px !important;
                        font-size: 11px !important;
                    }

                    .react-datepicker__header {
                        padding: 10px 0 !important;
                    }

                    .react-datepicker__month {
                        padding: 6px 0 !important;
                    }
                }
            `}</style>
        </div>
    );
}
