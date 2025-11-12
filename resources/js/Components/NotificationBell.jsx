import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export default function NotificationBell() {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [shouldShake, setShouldShake] = useState(false);
    const dropdownRef = useRef(null);
    const prevCountRef = useRef(0);

    // Fetch notifications
    const fetchNotifications = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get('/api/notifications');
            if (response.data.status === 'success') {
                const newCount = response.data.data.unread_count;
                
                // Trigger shake animation if count increased
                if (newCount > prevCountRef.current && prevCountRef.current > 0) {
                    setShouldShake(true);
                    setTimeout(() => setShouldShake(false), 500);
                }
                
                prevCountRef.current = newCount;
                setNotifications(response.data.data.notifications);
                setUnreadCount(newCount);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch notifications on mount and every 30 seconds for instant updates
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30 * 1000); // 30 seconds
        return () => clearInterval(interval);
    }, []);

    // Listen for custom events to refresh notifications instantly
    useEffect(() => {
        const handleRefresh = () => {
            fetchNotifications();
        };

        // Listen for transaction and budget changes
        window.addEventListener('transaction-created', handleRefresh);
        window.addEventListener('transaction-updated', handleRefresh);
        window.addEventListener('transaction-deleted', handleRefresh);
        window.addEventListener('budget-created', handleRefresh);
        window.addEventListener('budget-updated', handleRefresh);
        window.addEventListener('budget-deleted', handleRefresh);

        return () => {
            window.removeEventListener('transaction-created', handleRefresh);
            window.removeEventListener('transaction-updated', handleRefresh);
            window.removeEventListener('transaction-deleted', handleRefresh);
            window.removeEventListener('budget-created', handleRefresh);
            window.removeEventListener('budget-updated', handleRefresh);
            window.removeEventListener('budget-deleted', handleRefresh);
        };
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
        if (!isOpen && unreadCount > 0) {
            // Optionally mark as read when opening
            // For now, we'll just keep the count
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'critical':
                return (
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                );
            case 'warning':
                return (
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                );
            case 'info':
            default:
                return (
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                );
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // Get color based on percentage (matching Budget page logic)
    const getProgressColor = (percentage) => {
        if (percentage >= 100) {
            return 'text-red-600'; // Over budget
        } else if (percentage >= 85) {
            return 'text-amber-600'; // Warning
        }
        return 'text-green-600'; // Safe
    };

    const getProgressBarColor = (percentage) => {
        if (percentage >= 100) {
            return 'bg-red-600'; // Over budget
        } else if (percentage >= 85) {
            return 'bg-amber-600'; // Warning
        }
        return 'bg-[#058743]'; // Safe
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Icon Button */}
            <button
                onClick={toggleDropdown}
                className={`relative p-2 text-gray-700 hover:text-[#058743] hover:bg-gray-100 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#6FB386] focus:ring-offset-1 ${shouldShake ? 'animate-bellShake' : ''}`}
                aria-label="Notifications"
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
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                </svg>
                
                {/* Notification Badge */}
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 rounded-full transform translate-x-1/4 -translate-y-1/4 animate-pulse-slow">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 max-[425px]:w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[32rem] overflow-hidden flex flex-col animate-slideDown">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-[#058743] to-[#6FB386]">
                        <h3 className="text-lg font-semibold text-white">Notifications</h3>
                        {unreadCount > 0 && (
                            <p className="text-sm text-white/90 mt-0.5">
                                You have {unreadCount} notification{unreadCount !== 1 ? 's' : ''}
                            </p>
                        )}
                    </div>

                    {/* Notifications List */}
                    <div className="overflow-y-auto flex-1">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#058743]"></div>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4">
                                <svg className="w-16 h-16 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-gray-500 text-center font-medium">All caught up!</p>
                                <p className="text-gray-400 text-sm text-center mt-1">No new notifications</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className="px-4 py-3 hover:bg-gray-50 transition-colors duration-150"
                                    >
                                        <div className="flex gap-3">
                                            {getNotificationIcon(notification.type)}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {notification.category}
                                                    </p>
                                                </div>
                                                <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                                                    {notification.message}
                                                </p>
                                                
                                                {/* Additional Details */}
                                                {notification.data && notification.data.percentage !== undefined && (
                                                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                                                        <div className="flex justify-between text-gray-600 mb-1">
                                                            <span>Spent:</span>
                                                            <span className="font-medium text-gray-900">
                                                                {formatCurrency(notification.data.spent)}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between text-gray-600 mb-1">
                                                            <span>Budget:</span>
                                                            <span className="font-medium text-gray-900">
                                                                {formatCurrency(notification.data.budget)}
                                                            </span>
                                                        </div>
                                                        {notification.data.remaining > 0 && (
                                                            <div className="flex justify-between text-gray-600">
                                                                <span>Remaining:</span>
                                                                <span className={`font-medium ${getProgressColor(notification.data.percentage)}`}>
                                                                    {formatCurrency(notification.data.remaining)}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {/* Progress Bar */}
                                                        <div className="mt-2">
                                                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                                <div
                                                                    className={`h-1.5 rounded-full transition-all duration-300 ${getProgressBarColor(notification.data.percentage)}`}
                                                                    style={{
                                                                        width: `${Math.min(notification.data.percentage, 100)}%`
                                                                    }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {notification.data && notification.data.transaction_count !== undefined && (
                                                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                                                        <div className="flex justify-between text-gray-600">
                                                            <span>Transactions:</span>
                                                            <span className="font-medium text-gray-900">
                                                                {notification.data.transaction_count}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between text-gray-600 mt-1">
                                                            <span>Total Amount:</span>
                                                            <span className="font-medium text-gray-900">
                                                                {formatCurrency(notification.data.total_amount)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    window.location.href = '/budget';
                                }}
                                className="w-full text-center text-sm font-medium text-[#058743] hover:text-[#046835] transition-colors duration-150"
                            >
                                View Budget Page
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
