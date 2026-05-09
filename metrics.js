let apiUsageCount = 0;

module.exports = {
    getCount: () => apiUsageCount,
    increment: (amount = 1) => {
        apiUsageCount += amount;
    }
};