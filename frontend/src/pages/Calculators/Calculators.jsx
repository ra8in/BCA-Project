import { useState, useEffect, useCallback } from 'react';
import { calculatorService } from '../../services/calculatorService';

// --- SHARED COMPONENTS (Defined first to avoid hoisting issues) ---

const InputGroup = ({ label, value, onChange }) => (
    <div className="mb-4 last:mb-0">
        <label className="block text-xs font-bold uppercase text-gray-500 mb-1">{label}</label>
        <input
            type="number"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-blue-500 rounded-xl outline-none font-medium text-lg transition-colors"
        />
    </div>
);

const ToggleGroup = ({ label, options, active, onChange }) => (
    <div>
        {label && <label className="block text-xs font-bold uppercase text-gray-500 mb-2">{label}</label>}
        <div className="flex gap-2">
            {options.map(opt => (
                <button
                    key={opt.id}
                    onClick={() => onChange(opt.id)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${active === opt.id
                        ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-gray-700 dark:border-gray-600 dark:text-blue-400'
                        : 'border-gray-200 text-gray-500 dark:border-gray-700'
                        }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    </div>
);

const ResultCard = ({ label, amount, subLabel, subAmount, children }) => (
    <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col border-opacity-50 h-fit">
        <div className="mb-6 pb-6 border-b dark:border-gray-700">
            <h3 className="text-gray-500 text-sm font-medium mb-1">{label}</h3>
            <div className="text-4xl font-black text-blue-600 dark:text-blue-400">
                NPR {parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            {subLabel && (
                <div className="flex justify-between items-center mt-2 text-sm text-gray-400">
                    <span>{subLabel}</span>
                    <span className="font-bold">{parseFloat(subAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
            )}
        </div>
        <div className="space-y-3 flex-1">
            {children}
        </div>
    </div>
);

const Row = ({ label, value, isDeduction, isAddition, color, bold }) => (
    <div className="flex justify-between items-center text-sm">
        <span className={`${bold ? 'font-bold' : ''} text-gray-600 dark:text-gray-400`}>{label}</span>
        <span className={`font-semibold ${color ? color : (isDeduction ? 'text-red-500' : (isAddition ? 'text-green-500' : 'text-gray-800 dark:text-gray-200'))}`}>
            {isDeduction && '- '}{isAddition && '+ '}
            {typeof value === 'number' || !isNaN(parseFloat(value))
                ? parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : value}
        </span>
    </div>
);

const EmptyState = ({ message }) => (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-8 text-center text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 h-full flex items-center justify-center min-h-[300px]">
        <div>
            <div className="text-4xl mb-4">🧮</div>
            <p>{message}</p>
        </div>
    </div>
);

// Custom Hook for Debouncing
const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
};


// --- SUB-CALCULATORS ---

const BuySellCalculator = ({ data, update }) => {
    const { mode, buyQty, sellQty, buyPrice, sellPrice, purchasePrice, isWaccEntry, investorType, holdingPeriod } = data;
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const debouncedData = useDebounce(data, 500);

    useEffect(() => {
        const calculate = async () => {
            const qty = mode === 'buy' ? buyQty : sellQty;
            const price = mode === 'buy' ? buyPrice : sellPrice;

            if (!qty || !price || qty <= 0 || price <= 0) {
                setResult(null);
                return;
            }

            setLoading(true);

            try {
                const payload = {
                    mode: mode,
                    qty: parseInt(qty),
                    price: parseFloat(price),
                    is_wacc_entry: isWaccEntry,
                    purchase_price: purchasePrice ? parseFloat(purchasePrice) : 0,
                    investor_type: investorType,
                    holding_period: holdingPeriod
                };

                const res = await calculatorService.calculateBuySell(payload);
                setResult(res);
            } catch (err) {
                // Silent error
                console.warn("Calc Error", err);
            } finally {
                setLoading(false);
            }
        };

        calculate();
    }, [debouncedData]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
            {/* INPUTS */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm h-fit">
                <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl mb-6">
                    <button onClick={() => update('mode', 'buy')} className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${mode === 'buy' ? 'bg-white dark:bg-gray-700 shadow text-blue-600' : 'text-gray-500'}`}>Buy</button>
                    <button onClick={() => update('mode', 'sell')} className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${mode === 'sell' ? 'bg-white dark:bg-gray-700 shadow text-blue-600' : 'text-gray-500'}`}>Sell</button>
                </div>

                {mode === 'buy' ? (
                    <>
                        <InputGroup key="buyQty" label="Quantity" value={buyQty} onChange={v => update('buyQty', v)} />
                        <InputGroup key="buyPrice" label="Buying Price" value={buyPrice} onChange={v => update('buyPrice', v)} />
                    </>
                ) : (
                    <>
                        <InputGroup key="sellQty" label="Quantity" value={sellQty} onChange={v => update('sellQty', v)} />
                        <InputGroup key="sellPrice" label="Selling Price" value={sellPrice} onChange={v => update('sellPrice', v)} />
                    </>
                )}

                {mode === 'sell' && (
                    <div className="mt-6 pt-6 border-t dark:border-gray-700 space-y-4">
                        <ToggleGroup label="Cost Entry Mode"
                            options={[{ id: true, label: 'WACC' }, { id: false, label: 'Buy Price' }]}
                            active={isWaccEntry} onChange={v => update('isWaccEntry', v)}
                        />
                        <InputGroup label={isWaccEntry ? 'Your WACC' : 'Original Buy Price'} value={purchasePrice} onChange={v => update('purchasePrice', v)} />

                        <ToggleGroup label="Investor Type"
                            options={[{ id: 'individual', label: 'Individual' }, { id: 'institutional', label: 'Institutional' }]}
                            active={investorType} onChange={v => update('investorType', v)}
                        />

                        {investorType === 'individual' && (
                            <ToggleGroup label="Holding Period"
                                options={[{ id: 'short', label: 'Short Term (<1yr)' }, { id: 'long', label: 'Long Term (>1yr)' }]}
                                active={holdingPeriod} onChange={v => update('holdingPeriod', v)}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* RESULTS */}
            <div className="relative">
                {loading && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm z-10 rounded-2xl flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                )}

                {result ? (
                    <ResultCard
                        label={mode === 'buy' ? 'Total Cost' : 'Net Receivable'}
                        amount={mode === 'buy' ? result.total_cost : result.net_receivable}
                        subLabel={mode === 'buy' ? 'Effective Cost / Share' : 'Effective Return / Share'}
                        subAmount={mode === 'buy' ? result.effective_price : result.return_per_share}
                    >
                        <Row label="Share Amount" value={result.share_amount} />
                        <Row label="Broker Commission" value={result.commission} isDeduction={mode === 'sell'} isAddition={mode === 'buy'} />
                        <Row label="SEBON Fee" value={result.sebon_fee} isDeduction={mode === 'sell'} isAddition={mode === 'buy'} />
                        <Row label="DP Fee" value={result.dp_fee} isDeduction={mode === 'sell'} isAddition={mode === 'buy'} />
                        {mode === 'sell' && (
                            <>
                                <Row label={`CGT (${(result.cgt_rate * 100).toFixed(1)}%)`} value={result.cgt} isDeduction />
                                <div className="pt-4 mt-4 border-t border-dashed dark:border-gray-700">
                                    <Row label="Net Profit" value={result.net_profit} color={result.net_profit >= 0 ? 'text-green-500' : 'text-red-500'} bold />
                                </div>
                            </>
                        )}
                    </ResultCard>
                ) : (
                    <EmptyState message={mode === 'buy' ? "Enter Quantity and Price to calculate." : "Enter Quantity, Price, and WACC/Buy Price to see profit logic."} />
                )}
            </div>
        </div>
    );
};

const AdjustmentCalculator = ({ data, update }) => {
    const { bonusPrice, rightPrice, bonusPercent, rightPercent, paidup, type } = data;
    const [result, setResult] = useState(null);
    const debouncedData = useDebounce(data, 500);

    useEffect(() => {
        const calculate = async () => {
            const price = type === 'bonus' ? bonusPrice : rightPrice;
            const percent = type === 'bonus' ? bonusPercent : rightPercent;

            if (!price || !percent) {
                setResult(null);
                return;
            }

            try {
                const res = await calculatorService.calculateAdjustment({
                    type,
                    ltp: parseFloat(price),
                    percent: parseFloat(percent),
                    paid_up: parseFloat(paidup || 100)
                });
                setResult(res.adjusted_price);
            } catch (err) { }
        };
        calculate();
    }, [debouncedData]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm h-fit">
                <ToggleGroup label="Adjustment Type" options={[{ id: 'bonus', label: 'Bonus Share' }, { id: 'right', label: 'Right Share' }]} active={type} onChange={v => update('type', v)} />
                <div className="h-4"></div>

                {type === 'bonus' ? (
                    <InputGroup key="bonusPrice" label="Market Price Before Book Close (LTP)" value={bonusPrice} onChange={v => update('bonusPrice', v)} />
                ) : (
                    <InputGroup key="rightPrice" label="Market Price Before Book Close (LTP)" value={rightPrice} onChange={v => update('rightPrice', v)} />
                )}

                {type === 'bonus' ? (
                    <InputGroup key="bonus" label="Bonus Share %" value={bonusPercent} onChange={v => update('bonusPercent', v)} />
                ) : (
                    <InputGroup key="right" label="Right Share %" value={rightPercent} onChange={v => update('rightPercent', v)} />
                )}

                {type === 'right' && <InputGroup label="Paid Up Value (Usually 100)" value={paidup} onChange={v => update('paidup', v)} />}
            </div>

            {result ? (
                <div className="bg-blue-600 rounded-2xl p-8 text-white flex flex-col justify-center items-center shadow-lg h-fit self-start">
                    <h3 className="text-blue-100 font-bold uppercase tracking-widest text-sm mb-4">Adjusted Price</h3>
                    <div className="text-6xl font-black">
                        {parseFloat(result).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    <div className="mt-2 opacity-80 text-sm">per share</div>
                </div>
            ) : (
                <EmptyState message="Enter Market Price and % to calculate adjustment." />
            )}
        </div>
    );
};

const DividendCalculator = ({ data, update }) => {
    const { qty, bonusPercent, cashPercent, faceValue } = data;
    const [result, setResult] = useState(null);
    const debouncedData = useDebounce(data, 500);

    useEffect(() => {
        const calculate = async () => {
            if (!qty) { setResult(null); return; }
            if (!bonusPercent && !cashPercent) { setResult(null); return; }

            // Only calc if validation passes
            if (qty <= 0) return;

            try {
                const res = await calculatorService.calculateDividend({
                    qty: parseInt(qty),
                    bonus_percent: parseFloat(bonusPercent || 0),
                    cash_percent: parseFloat(cashPercent || 0),
                    face_value: parseFloat(faceValue || 100)
                });
                setResult(res);
            } catch (err) { }
        };
        calculate();
    }, [debouncedData]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4 h-fit">
                <InputGroup label="Quantity Held" value={qty} onChange={v => update('qty', v)} />
                <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Bonus Share %" value={bonusPercent} onChange={v => update('bonusPercent', v)} />
                    <InputGroup label="Cash Dividend %" value={cashPercent} onChange={v => update('cashPercent', v)} />
                </div>
                <InputGroup label="Face Value (Usually 100)" value={faceValue} onChange={v => update('faceValue', v)} />
            </div>

            {result ? (
                <div className="space-y-6">
                    <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg">
                        <h3 className="text-blue-100 font-bold uppercase tracking-widest text-xs mb-2">You Receive</h3>
                        <div className="flex justify-between items-end">
                            <div>
                                <div className="text-4xl font-black">{parseFloat(result.bonus_units).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                                <div className="text-sm opacity-80">Bonus Shares</div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold">NPR {parseFloat(result.net_cash_receivable).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                                <div className="text-sm opacity-80">Net Cash</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <h4 className="text-xs font-bold uppercase text-gray-400 mb-4">Tax & Adjustment Details</h4>
                        <div className="space-y-3">
                            <Row label="Gross Cash Dividend" value={result.gross_cash} />
                            <Row label="Tax on Cash (5%)" value={result.tax_on_cash} isDeduction />
                            <Row label="Tax on Bonus Shares (5%)" value={result.tax_on_bonus} isDeduction />
                            <div className="pt-3 mt-3 border-t dark:border-gray-700">
                                <div className="flex justify-between items-center text-sm font-bold">
                                    <span>{result.net_cash_receivable > 0 ? 'Net Cash Receivable' : 'Tax Payable by You'}</span>
                                    <span className={result.net_cash_receivable > 0 ? 'text-green-500' : 'text-red-500'}>
                                        NPR {parseFloat(result.net_cash_receivable || result.payable_by_user).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                {result.payable_by_user > 0 && (
                                    <p className="text-xs text-red-400 mt-1">* You must pay this amount to receive your bonus shares.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <EmptyState message="Enter Quantity and Dividend % to see receivable." />
            )}
        </div>
    );
};

const AveragingCalculator = ({ rows, setRows }) => {
    const [result, setResult] = useState(null);
    const debouncedRows = useDebounce(rows, 500);

    useEffect(() => {
        const calculate = async () => {
            const hasData = rows.some(r => r.qty && r.price);
            if (!hasData) { setResult(null); return; }

            try {
                const validRows = rows
                    .filter(r => r.qty > 0 && r.price > 0)
                    .map(r => ({ qty: parseInt(r.qty), price: parseFloat(r.price) }));
                if (validRows.length === 0) return;

                const res = await calculatorService.calculateAveraging(validRows);
                setResult(res);
            } catch (err) { }
        };
        calculate();
    }, [debouncedRows]);

    const addRow = () => {
        setRows([...rows, { id: Date.now(), qty: '', price: '' }]);
    };

    const removeRow = (id) => {
        if (rows.length > 1) {
            setRows(rows.filter(r => r.id !== id));
        }
    };

    const updateRow = (id, field, val) => {
        setRows(rows.map(r => r.id === id ? { ...r, [field]: val } : r));
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm h-fit">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs font-bold uppercase text-gray-500">Purchase History</h4>
                    <button onClick={addRow} className="text-blue-600 bg-blue-50 px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-100">+ Add Row</button>
                </div>

                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                    {rows.map((row, index) => (
                        <div key={row.id} className="flex gap-4 items-end">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Qty #{index + 1}</label>
                                <input
                                    type="number"
                                    value={row.qty}
                                    onChange={(e) => updateRow(row.id, 'qty', e.target.value)}
                                    className="w-full p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 outline-none"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Price #{index + 1}</label>
                                <input
                                    type="number"
                                    value={row.price}
                                    onChange={(e) => updateRow(row.id, 'price', e.target.value)}
                                    className="w-full p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 outline-none"
                                />
                            </div>
                            {rows.length > 1 && (
                                <button onClick={() => removeRow(row.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {result ? (
                <div className="space-y-6">
                    <div className="bg-indigo-600 rounded-2xl p-8 text-white flex flex-col justify-center items-center shadow-lg">
                        <h3 className="text-indigo-100 font-bold uppercase tracking-widest text-sm mb-4">New WACC</h3>
                        <div className="text-6xl font-black">
                            {parseFloat(result.average_wacc).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </div>
                        <div className="mt-2 opacity-80 text-sm">per share</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <h4 className="text-xs font-bold uppercase text-gray-400 mb-4">Total Summary</h4>
                        <Row label="Total Units" value={result.total_qty} />
                        <Row label="Total Investment" value={result.total_investment} />
                    </div>
                </div>
            ) : (
                <EmptyState message="Add purchase rows to calculate average WACC." />
            )}
        </div>
    );
};

// --- MAIN WRAPPER (DEFAULT EXPORT) ---

const Calculators = () => {
    const [mainTab, setMainTab] = useState('buysell');

    // --- STATE FOR PERSISTENCE ---
    const [buySell, setBuySell] = useState({
        mode: 'buy',
        buyQty: '',
        sellQty: '',
        buyPrice: '',
        sellPrice: '',
        purchasePrice: '',
        isWaccEntry: true,
        investorType: 'individual',
        holdingPeriod: 'short'
    });

    const [adj, setAdj] = useState({
        bonusPrice: '',
        rightPrice: '',
        bonusPercent: '',
        rightPercent: '',
        paidup: '100',
        type: 'bonus'
    });

    const [div, setDiv] = useState({
        qty: '',
        bonusPercent: '',
        cashPercent: '',
        faceValue: '100'
    });

    const [avgRows, setAvgRows] = useState([{ id: 1, qty: '', price: '' }]);

    const updateBuySell = (field, value) => setBuySell(prev => ({ ...prev, [field]: value }));
    const updateAdj = (field, value) => setAdj(prev => ({ ...prev, [field]: value }));
    const updateDiv = (field, value) => setDiv(prev => ({ ...prev, [field]: value }));

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <h2 className="text-3xl font-bold mb-2 text-gray-800 dark:text-gray-100">Financial Calculators</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm italic">Powered by Official NEPSE Backend Engine</p>

            {/* Main Navigation Tabs */}
            <div className="flex flex-wrap gap-2 mb-8 border-b dark:border-gray-700 pb-1">
                {[
                    { id: 'buysell', label: 'Buy / Sell' },
                    { id: 'adjustment', label: 'Price Adjustment' },
                    { id: 'dividend', label: 'Dividend' },
                    { id: 'averaging', label: 'Share Averaging' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setMainTab(tab.id)}
                        className={`px-6 py-3 font-bold text-sm rounded-t-lg transition-colors border-b-2 ${mainTab === tab.id
                            ? 'border-blue-600 text-blue-600 bg-blue-50 dark:bg-gray-800 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="min-h-[500px]">
                {mainTab === 'buysell' && <BuySellCalculator data={buySell} update={updateBuySell} />}
                {mainTab === 'adjustment' && <AdjustmentCalculator data={adj} update={updateAdj} />}
                {mainTab === 'dividend' && <DividendCalculator data={div} update={updateDiv} />}
                {mainTab === 'averaging' && <AveragingCalculator rows={avgRows} setRows={setAvgRows} />}
            </div>
        </div>
    );
};

export default Calculators;
