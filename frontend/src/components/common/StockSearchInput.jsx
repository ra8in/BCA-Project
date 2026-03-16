import { useState, useEffect, useRef } from 'react';
import { stockService } from '../../services/stockService';

// Debounce Hook
const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
};

const StockSearchInput = ({ onSelect, onEnterFilter, onTypingFilter, initialValue = '', placeholder = "Search Stock (e.g. NABIL)", disablePopup = false, className = "" }) => {
    const [searchTerm, setSearchTerm] = useState(initialValue);
    const [results, setResults] = useState([]);
    const [showResults, setShowResults] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef(null);
    const isSelectionRef = useRef(false); // Ref to track if change is due to selection

    // Update internal state if initialValue changes (e.g. reset from parent)
    useEffect(() => {
        if (initialValue && initialValue !== searchTerm) {
            setSearchTerm(initialValue);
            isSelectionRef.current = true; // Mark as selection to prevent re-search
        }
    }, [initialValue]);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowResults(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const debouncedSearch = useDebounce(searchTerm, 300);

    useEffect(() => {
        const search = async () => {
            // If empty, clear results and stop
            if (!debouncedSearch) {
                setResults([]);
                setLoading(false);
                // Reset filter when search is cleared
                if (onTypingFilter) {
                    onTypingFilter(null);
                }
                return;
            }

            // Skip search if marked as selection
            if (isSelectionRef.current) {
                isSelectionRef.current = false; // Reset flag
                return;
            }

            // Skip if likely just a selection (exact match with initial) - Optional safety
            if (debouncedSearch === initialValue && initialValue !== '') {
                return;
            }

            setLoading(true);
            try {
                const data = await stockService.search(debouncedSearch);
                setResults(data);
                setShowResults(true);
                // Call typing filter callback if provided
                if (onTypingFilter) {
                    onTypingFilter(data);
                }
            } catch (error) {
                // Console error is too noisy if it's just a cancellation or small network blip
                setResults([]);
            } finally {
                setLoading(false);
            }
        };

        search();
    }, [debouncedSearch]);

    const handleSelect = (stock) => {
        isSelectionRef.current = true; // Mark as selection
        setSearchTerm(stock.symbol);
        setShowResults(false);
        if (onSelect) {
            onSelect(stock);
        }
    };

    const handleChange = (e) => {
        isSelectionRef.current = false; // User typing, allow search
        setSearchTerm(e.target.value.toUpperCase());
        setShowResults(true);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            setShowResults(false);

            // Priority: Navigate to top result if available
            if (results.length > 0 && onSelect) {
                handleSelect(results[0]);
            }
            // Fallback: Filter table (if legacy behavior needed, though user said enter -> stock page)
            else if (onEnterFilter && results.length > 0) {
                onEnterFilter(results);
            } else if (onEnterFilter && searchTerm === '') {
                onEnterFilter(null);
            }
        }
        if (e.key === 'Escape') {
            setShowResults(false);
        }
    };

    return (
        <div ref={wrapperRef} className="relative w-full z-10">
            <div className="relative">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => { if (results.length > 0) setShowResults(true); }}
                    placeholder={placeholder}
                    className={`w-full bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 font-bold text-gray-800 dark:text-white focus:border-blue-500 outline-none uppercase transition-colors ${className}`}
                />
                {loading && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                    </div>
                )}
            </div>

            {/* Dropdown Results - Only show if not disabled */}
            {!disablePopup && showResults && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 max-h-60 overflow-y-auto">
                    <ul>
                        {results.map((stock) => (
                            <li
                                key={stock.id}
                                onClick={() => handleSelect(stock)}
                                className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-50 dark:border-gray-700 last:border-0 transition-colors"
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-gray-800 dark:text-gray-200">{stock.symbol}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{stock.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-gray-900 dark:text-white">Rs. {parseFloat(stock.last_price).toLocaleString()}</p>
                                        <p className={`text-xs font-bold ${parseFloat(stock.change_percent) > 0
                                            ? 'text-green-500'
                                            : parseFloat(stock.change_percent) < 0
                                                ? 'text-red-500'
                                                : 'text-blue-500'
                                            }`}>
                                            {parseFloat(stock.change_percent) > 0 ? '+' : ''}{parseFloat(stock.change_percent).toFixed(2)}%
                                        </p>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {showResults && results.length === 0 && debouncedSearch && !loading && debouncedSearch !== initialValue && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl p-4 text-center text-gray-500 border border-gray-100 dark:border-gray-700">
                    No stocks found
                </div>
            )}
        </div>
    );
};

export default StockSearchInput;
