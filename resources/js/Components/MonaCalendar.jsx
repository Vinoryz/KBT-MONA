import { useState, useEffect, useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

export default function MonaCalendar({ selected, onChange, maxDate = null, initialYearsBack = 0 }) {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState("day"); // 'day', 'month', or 'year'
    
    // Calculate initial date: if selected exists use it, otherwise go back initialYearsBack years
    const getInitialDate = () => {
        if (selected) return selected;
        const date = new Date();
        date.setFullYear(date.getFullYear() - initialYearsBack);
        return date;
    };
    
    const initialDate = getInitialDate();
    const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());
    const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
    const [yearRangeStart, setYearRangeStart] = useState(Math.floor(initialDate.getFullYear() / 16) * 16);
    const calendarRef = useRef(null);
    const [positionAbove, setPositionAbove] = useState(false);

    const monthNames = ["January", "February", "March", "April", "May", "June", 
                       "July", "August", "September", "October", "November", "December"];
    const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    // Close calendar when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (calendarRef.current && !calendarRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    // Calculate position when calendar opens or on scroll
    useEffect(() => {
        const calculatePosition = () => {
            if (calendarRef.current) {
                const rect = calendarRef.current.getBoundingClientRect();
                const calendarHeight = 400; // Approximate height of calendar
                const spaceBelow = window.innerHeight - rect.bottom;
                const spaceAbove = rect.top;

                // Show above if not enough space below and more space above
                setPositionAbove(spaceBelow < calendarHeight && spaceAbove > spaceBelow);
            }
        };

        if (isOpen) {
            calculatePosition();
            window.addEventListener("scroll", calculatePosition, true);
            window.addEventListener("resize", calculatePosition);
        }

        return () => {
            window.removeEventListener("scroll", calculatePosition, true);
            window.removeEventListener("resize", calculatePosition);
        };
    }, [isOpen]);

    const formatDate = (date) => {
        if (!date) return "";
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const getDaysInMonth = (month, year) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (month, year) => {
        return new Date(year, month, 1).getDay();
    };

    const isToday = (day, month, year) => {
        const today = new Date();
        return day === today.getDate() && 
               month === today.getMonth() && 
               year === today.getFullYear();
    };

    const isSelected = (day, month, year) => {
        if (!selected) return false;
        return day === selected.getDate() && 
               month === selected.getMonth() && 
               year === selected.getFullYear();
    };

    const isDisabled = (day, month, year) => {
        if (!maxDate) return false;
        const date = new Date(year, month, day);
        return date > maxDate;
    };

    const handleDayClick = (day) => {
        if (isDisabled(day, currentMonth, currentYear)) return;
        const newDate = new Date(currentYear, currentMonth, day);
        onChange(newDate);
        setIsOpen(false);
    };

    const handleMonthClick = (monthIndex) => {
        setCurrentMonth(monthIndex);
        setView("day");
    };

    const handleYearClick = (year) => {
        setCurrentYear(year);
        setView("month");
    };

    const handlePrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const handleNextMonth = () => {
        const today = new Date();
        const todayYear = today.getFullYear();
        const todayMonth = today.getMonth();
        
        // Don't allow navigating to future months
        if (currentYear === todayYear && currentMonth === todayMonth) {
            return;
        }
        
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    const handlePrevYearRange = () => {
        setYearRangeStart(yearRangeStart - 16);
    };

    const handleNextYearRange = () => {
        const currentYear = new Date().getFullYear();
        const nextStart = yearRangeStart + 16;
        // Don't allow scrolling past current year
        if (nextStart <= currentYear) {
            setYearRangeStart(nextStart);
        }
    };

    const handleHeaderClick = () => {
        if (view === "day") {
            setView("month");
        } else if (view === "month") {
            setView("year");
        }
    };

    const renderDayView = () => {
        const daysInMonth = getDaysInMonth(currentMonth, currentYear);
        const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
        const days = [];

        // Empty cells for days before the first day of the month
        for (let i = 0; i < firstDay; i++) {
            days.push(
                <div key={`empty-${i}`} className="calendar-day calendar-day-empty"></div>
            );
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const today = isToday(day, currentMonth, currentYear);
            const selectedDay = isSelected(day, currentMonth, currentYear);
            const disabled = isDisabled(day, currentMonth, currentYear);

            days.push(
                <button
                    key={day}
                    type="button"
                    onClick={() => handleDayClick(day)}
                    disabled={disabled}
                    className={`calendar-day ${today ? 'calendar-day-today' : ''} ${selectedDay ? 'calendar-day-selected' : ''} ${disabled ? 'calendar-day-disabled' : ''}`}
                >
                    {day}
                </button>
            );
        }

        return (
            <div className="calendar-grid">
                {dayNames.map(day => (
                    <div key={day} className="calendar-day-name">{day}</div>
                ))}
                {days}
            </div>
        );
    };

    const renderMonthView = () => {
        const today = new Date();
        const todayYear = today.getFullYear();
        const todayMonth = today.getMonth();

        return (
            <div className="calendar-month-grid">
                {monthNamesShort.map((month, index) => {
                    const isCurrentMonth = index === currentMonth;
                    // Disable future months in current year
                    const isFutureMonth = currentYear === todayYear && index > todayMonth;
                    
                    return (
                        <button
                            key={month}
                            type="button"
                            onClick={() => handleMonthClick(index)}
                            disabled={isFutureMonth}
                            className={`calendar-month-item ${isCurrentMonth ? 'calendar-month-selected' : ''} ${isFutureMonth ? 'calendar-month-disabled' : ''}`}
                        >
                            {month}
                        </button>
                    );
                })}
            </div>
        );
    };

    const renderYearView = () => {
        const years = [];
        const today = new Date();
        const todayYear = today.getFullYear();
        const endYear = Math.min(yearRangeStart + 16, todayYear + 1);

        for (let year = yearRangeStart; year < endYear; year++) {
            const isCurrentYear = year === currentYear;
            const isFutureYear = year > todayYear;
            
            years.push(
                <button
                    key={year}
                    type="button"
                    onClick={() => handleYearClick(year)}
                    disabled={isFutureYear}
                    className={`calendar-year-item ${isCurrentYear ? 'calendar-year-selected' : ''} ${isFutureYear ? 'calendar-year-disabled' : ''}`}
                >
                    {year}
                </button>
            );
        }

        return (
            <div className="calendar-year-grid">
                {years}
            </div>
        );
    };

    const getHeaderText = () => {
        if (view === "day") {
            return `${monthNames[currentMonth]} ${currentYear}`;
        } else if (view === "month") {
            return currentYear;
        } else {
            const today = new Date();
            const todayYear = today.getFullYear();
            const endYear = Math.min(yearRangeStart + 15, todayYear);
            return `${yearRangeStart} - ${endYear}`;
        }
    };

    const handlePrevClick = () => {
        if (view === "day") {
            handlePrevMonth();
        } else if (view === "year") {
            handlePrevYearRange();
        }
    };

    const handleNextClick = () => {
        if (view === "day") {
            handleNextMonth();
        } else if (view === "year") {
            handleNextYearRange();
        }
    };

    return (
        <div className="relative w-full" ref={calendarRef}>
            {/* Input Field */}
            <div className="relative">
                <input
                    type="text"
                    value={formatDate(selected)}
                    onClick={() => setIsOpen(!isOpen)}
                    readOnly
                    placeholder="DD/MM/YYYY"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg cursor-pointer focus:ring-2 focus:ring-[#058743] focus:border-transparent"
                />
                {/* Calendar Icon */}
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                    </svg>
                </div>
            </div>

            {/* Calendar Dropdown */}
            {isOpen && (
                <div className={`mona-calendar ${positionAbove ? 'mona-calendar-above' : ''}`}>
                    {/* Header */}
                    <div className="calendar-header">
                        <button
                            type="button"
                            onClick={handlePrevClick}
                            className="calendar-nav-button"
                            disabled={view === "month" || (view === "year" && yearRangeStart <= 1900)}
                        >
                            <ChevronLeftIcon className="w-5 h-5" />
                        </button>
                        
                        <button
                            type="button"
                            onClick={handleHeaderClick}
                            className="calendar-header-text"
                        >
                            {getHeaderText()}
                        </button>
                        
                        <button
                            type="button"
                            onClick={handleNextClick}
                            className="calendar-nav-button"
                            disabled={
                                view === "month" || 
                                (view === "year" && yearRangeStart + 16 > new Date().getFullYear()) ||
                                (view === "day" && currentYear === new Date().getFullYear() && currentMonth === new Date().getMonth())
                            }
                        >
                            <ChevronRightIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Calendar Body */}
                    <div className="calendar-body">
                        {view === "day" && renderDayView()}
                        {view === "month" && renderMonthView()}
                        {view === "year" && renderYearView()}
                    </div>
                </div>
            )}

            <style jsx>{`
                .mona-calendar {
                    position: absolute;
                    top: calc(100% + 8px);
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 9999;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
                    padding: 16px;
                    min-width: 320px;
                    font-family: inherit;
                }

                .mona-calendar-above {
                    top: auto;
                    bottom: calc(100% + 8px);
                    left: 50%;
                    transform: translateX(-50%);
                }

                .calendar-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 16px;
                }

                .calendar-nav-button {
                    padding: 8px;
                    border-radius: 8px;
                    transition: background-color 0.15s;
                    color: #1a1a1a;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                }

                .calendar-nav-button:hover:not(:disabled) {
                    background-color: #e8f5ee;
                }

                .calendar-nav-button:disabled {
                    opacity: 0;
                    cursor: default;
                }

                .calendar-header-text {
                    flex: 1;
                    font-size: 16px;
                    font-weight: 600;
                    color: #1a1a1a;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    padding: 8px 16px;
                    border-radius: 8px;
                    transition: background-color 0.15s;
                    text-align: center;
                }

                .calendar-header-text:hover {
                    background-color: #e8f5ee;
                }

                .calendar-body {
                    min-height: 260px;
                }

                /* Day View */
                .calendar-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 2px;
                }

                .calendar-day-name {
                    text-align: center;
                    font-size: 13px;
                    font-weight: 600;
                    color: #666;
                    padding: 8px 0;
                }

                .calendar-day {
                    aspect-ratio: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    color: #1a1a1a;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: all 0.15s;
                    min-height: 36px;
                }

                .calendar-day-empty {
                    cursor: default;
                }

                .calendar-day:not(.calendar-day-empty):not(.calendar-day-disabled):hover {
                    background-color: #f5f5f5;
                }

                .calendar-day-today {
                    background-color: #d4eadf;
                    color: #058743;
                    font-weight: 600;
                }

                .calendar-day-today:hover {
                    background-color: #c0e0cb;
                }

                .calendar-day-selected {
                    background-color: #058743 !important;
                    color: white !important;
                    font-weight: 600;
                }

                .calendar-day-selected:hover {
                    background-color: #046d36 !important;
                }

                .calendar-day-disabled {
                    color: #d0d0d0;
                    cursor: not-allowed;
                }

                /* Month View */
                .calendar-month-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 8px;
                }

                .calendar-month-item {
                    padding: 16px 12px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    color: #1a1a1a;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: all 0.15s;
                    text-align: center;
                }

                .calendar-month-item:hover {
                    background-color: #e8f5ee;
                }

                .calendar-month-selected {
                    background-color: #058743 !important;
                    color: white !important;
                    font-weight: 600;
                }

                .calendar-month-selected:hover {
                    background-color: #046d36 !important;
                }

                /* Year View */
                .calendar-year-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 8px;
                }

                .calendar-year-item {
                    padding: 16px 12px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    color: #1a1a1a;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    transition: all 0.15s;
                    text-align: center;
                }

                .calendar-year-item:hover {
                    background-color: #e8f5ee;
                }

                .calendar-year-selected {
                    background-color: #058743 !important;
                    color: white !important;
                    font-weight: 600;
                }

                .calendar-year-selected:hover {
                    background-color: #046d36 !important;
                }

                .calendar-month-disabled,
                .calendar-year-disabled {
                    color: #d0d0d0;
                    cursor: not-allowed;
                }

                .calendar-month-disabled:hover,
                .calendar-year-disabled:hover {
                    background-color: transparent !important;
                }

                /* Mobile Responsive */
                @media (max-width: 640px) {
                    .mona-calendar {
                        min-width: 280px;
                        padding: 12px;
                    }

                    .calendar-header-text {
                        font-size: 14px;
                    }

                    .calendar-day {
                        font-size: 13px;
                        min-height: 32px;
                    }

                    .calendar-day-name {
                        font-size: 12px;
                    }

                    .calendar-month-item,
                    .calendar-year-item {
                        padding: 12px 8px;
                        font-size: 13px;
                    }
                }
            `}</style>
        </div>
    );
}
