// Enhanced simulation functionality with debugging
document.addEventListener('DOMContentLoaded', function() {
    console.log('Simulation module loaded');
    console.log('Available products:', window.products);
    
    // Log all historical data for debugging
    if (window.products) {
        window.products.forEach(productId => {
            console.log(`Historical data for ${productId}:`, window[`historical_${productId}`]);
        });
    }
});

function simulateProduct(productId) {
    console.log(`=== STARTING SIMULATION FOR: ${productId} ===`);
    
    // Get current prediction
    const predictedElement = document.getElementById(`predicted-${productId}`);
    if (!predictedElement) {
        console.error(`❌ Predicted element not found for: ${productId}`);
        return;
    }
    
    const currentPrediction = parseFloat(predictedElement.textContent);
    if (isNaN(currentPrediction)) {
        console.error(`❌ Invalid prediction value for ${productId}: ${predictedElement.textContent}`);
        return;
    }
    
    console.log(`📊 Current prediction: ${currentPrediction}`);
    
    // Add visual feedback
    const card = document.getElementById(`product-${productId}`);
    if (card) {
        card.style.border = '2px solid #28a745';
        setTimeout(() => card.style.border = '', 1000);
    }
    
    // Generate new prediction
    const newPrediction = generateNewPrediction(productId, currentPrediction);
    console.log(`🎯 New prediction: ${newPrediction}`);
    
    // Update displayed prediction
    predictedElement.textContent = newPrediction.toFixed(2);
    
    // Update next month display
    const nextMonthElement = document.getElementById(`next-month-${productId}`);
    if (nextMonthElement) {
        const newMonth = getNextMonthText(nextMonthElement.textContent);
        nextMonthElement.textContent = newMonth;
        console.log(`📅 Updated month to: ${newMonth}`);
    }
    
    // Update the global predicted value
    window[`predicted_${productId}`] = newPrediction;
    
    // Add to historical data for chart updates
    addToHistoricalData(productId, newPrediction);
    
    // Force chart update
    updateChartAfterSimulation(productId);
    
    console.log(`✅ Simulation complete for ${productId}`);
}

function addToHistoricalData(productId, newPrice) {
    console.log(`📈 Adding to historical data for ${productId}`);
    
    if (!window[`historical_${productId}`]) {
        console.warn(`❌ No historical data found for ${productId}`);
        // Create empty array if none exists
        window[`historical_${productId}`] = [];
    }
    
    const historicalData = window[`historical_${productId}`];
    console.log(`Current historical data length: ${historicalData.length}`, historicalData);
    
    const newDate = getNextMonthFromLast(historicalData);
    const newEntry = {
        date: newDate,
        price: newPrice,
        price_date: newDate,
        simulated: true
    };
    
    historicalData.push(newEntry);
    console.log(`➕ Added new entry:`, newEntry);
    console.log(`📊 Updated historical data length: ${historicalData.length}`);
}

function getNextMonthFromLast(historicalData) {
    if (!historicalData || historicalData.length === 0) {
        const defaultDate = new Date().toISOString().slice(0, 7);
        console.log(`📅 No historical data, using default date: ${defaultDate}`);
        return defaultDate;
    }
    
    const lastEntry = historicalData[historicalData.length - 1];
    console.log(`📅 Last entry:`, lastEntry);
    
    let lastDate = lastEntry.price_date || lastEntry.date;
    
    if (!lastDate) {
        console.warn('❌ No date found in last entry, using current date');
        return new Date().toISOString().slice(0, 7);
    }
    
    console.log(`📅 Parsing date: ${lastDate}`);
    
    // Handle different date formats
    let year, month;
    
    if (lastDate.includes('-')) {
        [year, month] = lastDate.split('-').map(Number);
    } else if (lastDate.includes('/')) {
        const parts = lastDate.split('/');
        if (parts.length === 3) {
            // Handle MM/DD/YYYY or DD/MM/YYYY
            if (parts[0].length === 4) { // YYYY/MM/DD
                [year, month] = [parseInt(parts[0]), parseInt(parts[1])];
            } else { // MM/DD/YYYY or DD/MM/YYYY
                [month, , year] = parts.map(Number);
            }
        }
    }
    
    if (!year || !month) {
        console.warn(`❌ Could not parse date: ${lastDate}`);
        return new Date().toISOString().slice(0, 7);
    }
    
    let nextMonth = month + 1;
    let nextYear = year;
    
    if (nextMonth > 12) {
        nextMonth = 1;
        nextYear++;
    }
    
    const nextDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}`;
    console.log(`📅 Next date: ${nextDate}`);
    
    return nextDate;
}

function updateChartAfterSimulation(productId) {
    console.log(`🔄 Attempting to update chart for: ${productId}`);
    
    // Check if updateChart function exists
    if (typeof updateChart === 'function') {
        console.log(`✅ updateChart function found, calling with productId: ${productId}`);
        updateChart(productId, 12);
    } else {
        console.error('❌ updateChart function not found!');
        // Try to manually update the chart
        manualChartUpdate(productId);
    }
}

function manualChartUpdate(productId) {
    console.log(`🔄 Manual chart update for: ${productId}`);
    
    const canvas = document.getElementById(`priceChart-${productId}`);
    if (!canvas) {
        console.error(`❌ Canvas not found for: ${productId}`);
        return;
    }
    
    const chart = Chart.getChart(canvas);
    if (!chart) {
        console.error(`❌ Chart instance not found for: ${productId}`);
        return;
    }
    
    const historicalData = window[`historical_${productId}`];
    if (!historicalData) {
        console.error(`❌ No historical data for manual update: ${productId}`);
        return;
    }
    
    // Prepare chart data
    const labels = historicalData.map(entry => entry.date || entry.price_date);
    const prices = historicalData.map(entry => entry.price);
    
    console.log(`📊 Manual update data - Labels:`, labels);
    console.log(`📊 Manual update data - Prices:`, prices);
    
    // Update chart data
    chart.data.labels = labels;
    chart.data.datasets[0].data = prices;
    
    // Add prediction dataset if it exists, or create it
    const predictedPrice = window[`predicted_${productId}`];
    if (predictedPrice) {
        if (chart.data.datasets.length > 1) {
            // Update existing prediction dataset
            chart.data.datasets[1].data = [prices[prices.length - 1], predictedPrice];
        } else {
            // Add new prediction dataset
            chart.data.datasets.push({
                label: 'Predicted',
                data: [prices[prices.length - 1], predictedPrice],
                borderColor: 'red',
                borderDash: [5, 5],
                fill: false,
                tension: 0.1
            });
        }
    }
    
    chart.update();
    console.log(`✅ Manual chart update complete for: ${productId}`);
}

function generateNewPrediction(productId, currentPrice) {
    console.log(`🔮 Generating prediction for: ${productId} from ${currentPrice}`);
    
    // Simple prediction algorithm - you can enhance this later
    const volatility = 0.1; // 10% volatility
    const trend = Math.random() > 0.3 ? 1 : -1; // 70% chance of increase
    const randomFactor = (Math.random() - 0.5) * 2;
    
    const change = currentPrice * volatility * trend * randomFactor;
    const newPrice = Math.max(currentPrice * 0.5, currentPrice + change);
    
    console.log(`🔮 Prediction details - Volatility: ${volatility}, Trend: ${trend}, Change: ${change.toFixed(2)}, New Price: ${newPrice.toFixed(2)}`);
    
    return parseFloat(newPrice.toFixed(2));
}

function getNextMonthText(currentText) {
    console.log(`📅 Getting next month from: "${currentText}"`);
    
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    
    let currentMonth = -1;
    let currentYear = new Date().getFullYear();
    
    // Find current month
    for (let i = 0; i < months.length; i++) {
        if (currentText.toLowerCase().includes(months[i].toLowerCase())) {
            currentMonth = i;
            break;
        }
    }
    
    // Extract year
    const yearMatch = currentText.match(/\b(20\d{2})\b/);
    if (yearMatch) {
        currentYear = parseInt(yearMatch[1]);
    }
    
    console.log(`📅 Current month: ${currentMonth}, year: ${currentYear}`);
    
    // Calculate next month
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    
    if (nextMonth >= 12) {
        nextMonth = 0;
        nextYear++;
    }
    
    const result = `${months[nextMonth]} ${nextYear}`;
    console.log(`📅 Next month: ${result}`);
    
    return result;
}

function simulateAllProducts() {
    console.log('🚀 SIMULATING ALL PRODUCTS');
    
    if (window.products && window.products.length > 0) {
        window.products.forEach((productId, index) => {
            setTimeout(() => {
                console.log(`\n--- Simulating product ${index + 1}/${window.products.length} ---`);
                simulateProduct(productId);
            }, index * 1000);
        });
    } else {
        console.warn('❌ No products found in window.products');
    }
}

// Make functions globally available
window.simulateProduct = simulateProduct;
window.simulateAllProducts = simulateAllProducts;