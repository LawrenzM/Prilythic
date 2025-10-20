window.simulateProduct = function(productId) {
    console.log(`=== STARTING SIMULATION FOR: ${productId} ===`);
    
    // Get the CURRENT PREDICTED PRICE (what's already displayed)
    const predictedElement = document.getElementById(`predicted-${productId}`);
    if (!predictedElement) {
        console.error(`❌ Predicted element not found for: ${productId}`);
        return;
    }
    
    const currentPredictedPrice = parseFloat(predictedElement.textContent);
    if (isNaN(currentPredictedPrice)) {
        console.error(`❌ Invalid predicted price for ${productId}: ${predictedElement.textContent}`);
        return;
    }
    
    console.log(`📊 Using current predicted price as new actual price: ${currentPredictedPrice}`);
    
    // Add visual feedback
    const card = document.getElementById(`product-${productId}`);
    if (card) {
        card.style.border = '2px solid #28a745';
        setTimeout(() => card.style.border = '', 1000);
    }
    
    // ADD THE CURRENT PREDICTED PRICE TO HISTORICAL DATA (as today's price)
    addToHistoricalData(productId, currentPredictedPrice);
    
    // GENERATE A NEW PREDICTION for next month
    const newPrediction = generateNewPrediction(productId, currentPredictedPrice);
    console.log(`🎯 New prediction for next month: ${newPrediction}`);
    
    // Update displayed prediction with the NEW prediction
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
    
    // Update chart with current time range
    if (typeof updateChart === 'function') {
        // Get current months from active button or default to current view
        // Try to find which time range button is active
        const buttons = document.querySelectorAll(`button[onclick*="${productId}"]`);
        let currentMonths = 12;
        
        for (let button of buttons) {
            if (button.textContent.includes('M') || button.textContent.includes('Y')) {
                if (button.classList.contains('btn-primary') || 
                    button.classList.contains('active') ||
                    button.style.backgroundColor !== '') {
                    // Extract months from button text
                    if (button.textContent.includes('3')) currentMonths = 3;
                    else if (button.textContent.includes('6')) currentMonths = 6;
                    else if (button.textContent.includes('9')) currentMonths = 9;
                    else if (button.textContent.includes('1Y')) currentMonths = 12;
                    break;
                }
            }
        }
        
        console.log(`🔄 Updating chart with ${currentMonths} months view`);
        updateChart(productId, currentMonths);
    }
    
    console.log(`✅ Simulation complete for ${productId}`);
};

// NEW FUNCTION: Get the currently selected time range for a product
function getCurrentTimeRange(productId) {
    // Find the active button for this product
    const activeButton = document.querySelector(`[data-product="${productId}"].btn-primary`);
    if (activeButton) {
        const months = parseInt(activeButton.getAttribute('data-months'));
        console.log(`📅 Found active time range: ${months} months`);
        return months;
    }
    
    // Fallback: check which button has the active class
    const buttons = document.querySelectorAll(`[data-product="${productId}"]`);
    for (let button of buttons) {
        if (button.classList.contains('btn-primary') || button.classList.contains('active')) {
            const months = parseInt(button.getAttribute('data-months'));
            console.log(`📅 Found active time range via class: ${months} months`);
            return months;
        }
    }
    
    // Default to 12 months if no active button found
    console.log(`📅 No active time range found, defaulting to 12 months`);
    return 12;
}
function generateNewPrediction(productId, currentPrice) {
    console.log(`🔮 Generating prediction for: ${productId} from ${currentPrice}`);
    
    // Product-specific volatility based on your CSV data patterns
    const productVolatility = {
        'beans': 0.08,
        'cabbage': 0.15,
        'carrots': 0.12,
        'eggs': 0.06,
        'meat_beef_chops': 0.10,
        'meat_chicken_whole': 0.07,
        'meat_pork': 0.09,
        'onions': 0.20,
        'potatoes': 0.18,
        'rice': 0.05,
        'tomatoes': 0.25
    };
    
    // Find matching product volatility
    let volatility = 0.1; // default
    for (const [key, value] of Object.entries(productVolatility)) {
        if (productId.toLowerCase().includes(key)) {
            volatility = value;
            break;
        }
    }
    
    // Generate realistic price movement
    const randomChange = (Math.random() - 0.5) * 2 * volatility;
    const newPrice = currentPrice * (1 + randomChange);
    
    // Ensure reasonable minimum price
    const finalPrice = Math.max(newPrice, currentPrice * 0.3);
    
    console.log(`🔮 Prediction details - Volatility: ${volatility}, Change: ${(randomChange * 100).toFixed(1)}%, New Price: ${finalPrice.toFixed(2)}`);
    
    return parseFloat(finalPrice.toFixed(2));
}

function addToHistoricalData(productId, newPrice) {
    console.log(`📈 Adding to historical data for ${productId}`);
    
    if (!window[`historical_${productId}`]) {
        console.warn(`❌ No historical data found for ${productId}`);
        window[`historical_${productId}`] = [];
    }
    
    const historicalData = window[`historical_${productId}`];
    console.log(`Current historical data length: ${historicalData.length}`);
    
    // Use CURRENT month for the simulated price (not next month)
    const currentDate = getCurrentMonth();
    console.log(`📅 Adding simulated price for current month: ${currentDate}`);
    
    // CREATE DATA IN THE SAME FORMAT AS YOUR CSV
    const sampleEntry = historicalData[0];
    let priceField = 'price';
    
    if (sampleEntry) {
        // Try to find the correct price field name used in your CSV
        const possibleFields = ['c_' + productId.toLowerCase(), 'o_' + productId.toLowerCase(), 'price'];
        for (let field of possibleFields) {
            if (sampleEntry[field] !== undefined) {
                priceField = field;
                break;
            }
        }
        console.log(`🔍 Using price field: ${priceField}`);
    }
    
    // Create new entry in the same format as your original data
    const newEntry = {
        price_date: currentDate,
        date: currentDate,
        [priceField]: newPrice, // Use the correct field name
        simulated: true
    };
    
    // Copy other fields from the last entry to maintain structure
    if (sampleEntry) {
        Object.keys(sampleEntry).forEach(key => {
            if (!newEntry[key] && key !== 'price_date' && key !== 'date') {
                newEntry[key] = sampleEntry[key]; // Copy other fields
            }
        });
    }
    
    historicalData.push(newEntry);
    console.log(`➕ Added new entry:`, newEntry);
}

// NEW FUNCTION: Get current month in YYYY-MM format
function getCurrentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
}
function getNextMonthFromLast(historicalData) {
    if (!historicalData || historicalData.length === 0) {
        return new Date().toISOString().slice(0, 7);
    }
    
    const lastEntry = historicalData[historicalData.length - 1];
    let lastDate = lastEntry.price_date || lastEntry.date;
    
    if (!lastDate) {
        return new Date().toISOString().slice(0, 7);
    }
    
    let year, month;
    
    if (lastDate.includes('-')) {
        [year, month] = lastDate.split('-').map(Number);
    } else if (lastDate.includes('/')) {
        const parts = lastDate.split('/');
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                [year, month] = [parseInt(parts[0]), parseInt(parts[1])];
            } else {
                [month, , year] = parts.map(Number);
            }
        }
    }
    
    if (!year || !month) {
        return new Date().toISOString().slice(0, 7);
    }
    
    let nextMonth = month + 1;
    let nextYear = year;
    
    if (nextMonth > 12) {
        nextMonth = 1;
        nextYear++;
    }
    
    return `${nextYear}-${nextMonth.toString().padStart(2, '0')}`;
}

function getNextMonthText(currentText) {
    console.log(`📅 Getting next month from: "${currentText}"`);
    
    // If currentText is a date like "2025-02-01", parse it
    if (currentText.includes('-')) {
        const dateMatch = currentText.match(/(\d{4})-(\d{2})/);
        if (dateMatch) {
            const year = parseInt(dateMatch[1]);
            const month = parseInt(dateMatch[2]);
            
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
            
            let nextMonth = month;
            let nextYear = year;
            
            if (nextMonth >= 12) {
                nextMonth = 1;
                nextYear++;
            } else {
                nextMonth++;
            }
            
            const result = `${months[nextMonth - 1]} ${nextYear}`;
            console.log(`📅 Next month: ${result}`);
            return result;
        }
    }
    
    // Fallback: increment from current display
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    
    let currentMonth = -1;
    let currentYear = new Date().getFullYear();
    
    for (let i = 0; i < months.length; i++) {
        if (currentText.toLowerCase().includes(months[i].toLowerCase())) {
            currentMonth = i;
            break;
        }
    }
    
    const yearMatch = currentText.match(/\b(20\d{2})\b/);
    if (yearMatch) currentYear = parseInt(yearMatch[1]);
    
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    if (nextMonth >= 12) {
        nextMonth = 0;
        nextYear++;
    }
    
    return `${months[nextMonth]} ${nextYear}`;
}

document.addEventListener("DOMContentLoaded", function() {
    // Wait until Flask injects the products list
    if (!window.products || window.products.length === 0) {
        console.warn("No products found — check Flask injection or session data.");
        return;
    }

    console.log("Loaded products from Flask:", window.products);

    window.products.forEach(function(id) {  // Only sanitized IDs
        const historical = window['historical_' + id] || [];
        if (historical.length === 0) {
            console.warn(`No historical data found for product ${id}`);
            return;
        }
        drawChart(id, historical, 3);
    });
});

window.updateChart = function(id, months) {  // Only sanitized IDs
    const data = window['historical_' + id] || [];
    if (data.length === 0) {
        console.warn(`Cannot update chart — no data for ${id}`);
        return;
    }
    drawChart(id, data, months);
};

function drawChart(id, historical, months) {
    const chartElem = document.getElementById(`priceChart-${id}`);
    if (!chartElem) {
        console.warn(`No canvas found for product: ${id}`);
        return;
    }

    if (!historical || historical.length === 0) {
        console.warn(`No historical data for product ${id}`);
        return;
    }

    const actualMonths = Math.min(months, historical.length);
    const hist = historical.slice(-actualMonths);
    const ctx = chartElem.getContext("2d");

    // Destroy existing chart to avoid overlap
    if (window[`chart_${id}`]) window[`chart_${id}`].destroy();

    // DEBUG: Log what we're about to chart
    console.log(`📊 Drawing chart for ${id} with ${hist.length} data points`);
    console.log('Sample data point:', hist[0]);

    // Find the correct price field - handle both CSV format and simulated data
    let priceKey = null;
    
    // First, try to find product-specific fields (c_beans, o_beans, etc.)
    const productName = id.toLowerCase().replace('_', '');
    const possibleFields = [
        'c_' + productName,  // Central price
        'o_' + productName,  // Observed price  
        'price',             // Simulated data
        'beans', 'cabbage', 'carrots', 'eggs', 'meat_beef_chops', 
        'meat_chicken_whole', 'meat_pork', 'onions', 'potatoes', 'rice', 'tomatoes'
    ];
    
    for (let field of possibleFields) {
        if (hist[0][field] !== undefined) {
            priceKey = field;
            console.log(`🔍 Found price key: ${priceKey}`);
            break;
        }
    }
    
    if (!priceKey) {
        // Last resort: find any numeric field that's not a date
        for (let field in hist[0]) {
            if (field !== 'price_date' && field !== 'date' && field !== 'simulated' && 
                typeof hist[0][field] === 'number') {
                priceKey = field;
                console.log(`🔍 Using numeric field as price: ${priceKey}`);
                break;
            }
        }
    }
    
    if (!priceKey) {
        console.error(`❌ No price field found in data:`, hist[0]);
        return;
    }

    // Prepare chart data
    const labels = hist.map(h => {
        const date = h.price_date || h.date;
        // Format date for better display
        if (date && date.includes('-')) {
            const [year, month] = date.split('-');
            return `${month}/${year}`;
        }
        return date;
    });
    
    const prices = hist.map(h => h[priceKey]);

    console.log(`📈 Chart data - Labels:`, labels);
    console.log(`📈 Chart data - Prices:`, prices);

    window[`chart_${id}`] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: id.replace(/_/g, " ").replace(/-/g, "/") + " Price",
                data: prices,
                borderColor: 'rgba(54,162,235,1)',
                backgroundColor: 'rgba(54,162,235,0.2)',
                borderWidth: 2,
                fill: true,
                tension: 0.25,
                pointRadius: 3,
                pointBackgroundColor: function(context) {
                    // Color simulated points differently
                    const index = context.dataIndex;
                    const originalIndex = historical.length - hist.length + index;
                    return historical[originalIndex]?.simulated ? 'red' : 'rgba(54,162,235,1)';
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: { display: true, text: 'Date' },
                    ticks: { autoSkip: true, maxTicksLimit: 10 }
                },
                y: {
                    title: { display: true, text: 'Price' },
                    beginAtZero: false
                }
            },
            plugins: {
                legend: { display: true },
                tooltip: { 
                    enabled: true,
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const originalIndex = historical.length - hist.length + index;
                            const isSimulated = historical[originalIndex]?.simulated;
                            return `${context.dataset.label}: ${context.parsed.y} ${isSimulated ? '(simulated)' : ''}`;
                        }
                    }
                }
            }
        }
    });
}

// Keep your logout confirmation intact
function confirmLogout() {
    if (confirm("Are you sure you want to log out?")) {
        window.location.href = '/logout';
    }
}
