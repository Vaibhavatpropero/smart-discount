// app/utils/currency.js
const CURRENCY_SYMBOLS = {
    USD: "$",
    INR: "₹",
    EUR: "€",
    GBP: "£",
    CAD: "CA$",
    AUD: "A$",
};

export function getCurrencySymbol(currencyCode) {
    return CURRENCY_SYMBOLS[ currencyCode ] || currencyCode + " ";
}

export function formatCurrencyHint(currencyCode) {
    const symbol = getCurrencySymbol(currencyCode);
    return `Enter amount in ${currencyCode} (${symbol})`;
}