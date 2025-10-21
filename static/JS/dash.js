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
    
    // ADVANCE THE SIMULATION DATE FIRST
    window.simulationDate.setMonth(window.simulationDate.getMonth() + 1);
    const simulationDateStr = window.simulationDate.toISOString().slice(0, 7);
    console.log(`📅 ADVANCING to simulation month: ${simulationDateStr}`);
    
    // ADD THE CURRENT PREDICTED PRICE TO HISTORICAL DATA
    addToHistoricalData(productId, currentPredictedPrice, simulationDateStr);
    
    // GENERATE A NEW PREDICTION for next month
    const newPrediction = generateNewPrediction(productId, currentPredictedPrice);
    console.log(`🎯 New prediction for next month: ${newPrediction}`);
    
    // Update displayed prediction with the NEW prediction
    predictedElement.textContent = newPrediction.toFixed(2);
    
    // Update next month display
    const nextMonthElement = document.getElementById(`next-month-${productId}`);
    if (nextMonthElement) {
        const newMonth = getNextMonthText();
        nextMonthElement.textContent = newMonth;
        console.log(`📅 Updated month to: ${newMonth}`);
    }
    
    // Update the global predicted value
    window[`predicted_${productId}`] = newPrediction;
    
    // Update chart with current time range
    if (typeof updateChart === 'function') {
        const currentMonths = getCurrentTimeRange(productId);
        console.log(`🔄 Updating chart with ${currentMonths} months view`);
        updateChart(productId, currentMonths);
    }
    
    console.log(`✅ Simulation complete for ${productId}`);
};

// Get the currently selected time range for a product
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
    
    // Get historical data for this product
    const historicalData = window[`historical_${productId}`] || [];
    
    // Calculate volatility dynamically from historical data
    const volatility = calculateVolatility(historicalData, productId);
    
    // Generate realistic price movement
    const randomChange = (Math.random() - 0.5) * 2 * volatility;
    const newPrice = currentPrice * (1 + randomChange);
    
    // Ensure reasonable minimum price
    const finalPrice = Math.max(newPrice, currentPrice * 0.3);
    
    console.log(`🔮 Prediction details - Volatility: ${volatility.toFixed(4)}, Change: ${(randomChange * 100).toFixed(1)}%, New Price: ${finalPrice.toFixed(2)}`);
    
    return parseFloat(finalPrice.toFixed(2));
}

// Calculate volatility from historical data
function calculateVolatility(historicalData, productId = '') {
    if (!historicalData || historicalData.length < 2) return 0.1;
    
    // Extract prices using field detection
    const priceField = detectPriceField(historicalData[0], productId);
    const prices = historicalData.map(entry => entry[priceField]).filter(p => p !== undefined && p !== null);
    
    if (prices.length < 2) return 0.1;
    
    // Calculate percentage changes
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
        const change = (prices[i] - prices[i-1]) / prices[i-1];
        changes.push(change);
    }
    
    // Return standard deviation of changes as volatility
    const mean = changes.reduce((sum, change) => sum + change, 0) / changes.length;
    const variance = changes.reduce((sum, change) => sum + Math.pow(change - mean, 2), 0) / changes.length;
    const calculatedVolatility = Math.sqrt(variance);
    
    console.log(`Calculated volatility for ${productId}: ${calculatedVolatility.toFixed(4)} from ${changes.length} data points`);
    
    return Math.max(0.02, Math.min(0.5, calculatedVolatility)); // Clamp between 2% and 50%
}

// Better field detection
function detectPriceField(entry, productId = '') {
    if (!entry) {
        console.error('No entry provided for field detection');
        return null;
    }
    
    console.log(`Detecting price field for: ${productId}`, entry);
    
    // Strategy 1: Exact match
    if (entry[productId] !== undefined) {
        console.log(`Found exact match: ${productId}`);
        return productId;
    }
    
    // Strategy 2: Case-insensitive match
    const lowerProductId = productId.toLowerCase();
    for (let key in entry) {
        if (key.toLowerCase() === lowerProductId) {
            console.log(`Found case-insensitive match: ${key}`);
            return key;
        }
    }
    
    // Strategy 3: Common prefix patterns
    const prefixes = ['c_', 'o_', 'price_', 'val_', 'cost_', ''];
    for (let prefix of prefixes) {
        const fieldName = prefix + productId.toLowerCase();
        if (entry[fieldName] !== undefined) {
            console.log(`Found prefixed match: ${fieldName}`);
            return fieldName;
        }
    }
    
    // Strategy 4: Find any numeric field that's not a date
    for (let key in entry) {
        if (key !== 'price_date' && key !== 'date' && key !== 'month' && 
            key !== 'year' && key !== 'timestamp' &&
            typeof entry[key] === 'number') {
            console.log(`Using numeric field as price: ${key}`);
            return key;
        }
    }
    
    // Strategy 5: Last resort - any field with numeric value
    for (let key in entry) {
        if (!isNaN(parseFloat(entry[key])) && isFinite(entry[key])) {
            console.log(`Using parseable numeric field: ${key}`);
            return key;
        }
    }
    
    console.error(`No suitable price field found for: ${productId}`, entry);
    return null;
}

function addToHistoricalData(productId, newPrice, specificDate = null) {
    console.log(`📈 Adding to historical data for ${productId}`);
    
    if (!window[`historical_${productId}`]) {
        console.warn(`❌ No historical data found for ${productId}`);
        window[`historical_${productId}`] = [];
    }
    
    const historicalData = window[`historical_${productId}`];
    console.log(`Current historical data length: ${historicalData.length}`);
    
    // Use the provided specific date or current simulation date
    const dateToUse = specificDate || window.simulationDate.toISOString().slice(0, 7);
    console.log(`📅 Adding simulated price for: ${dateToUse}`);
    
    // CHECK FOR EXISTING ENTRY FOR THIS DATE FIRST
    const existingEntryIndex = historicalData.findIndex(entry => 
        (entry.price_date || entry.date) === dateToUse
    );
    
    // CREATE DATA IN THE SAME FORMAT AS YOUR CSV
    const sampleEntry = historicalData[0];
    let priceField = 'price';
    
    if (sampleEntry) {
        // Try to find the correct price field name
        const possibleFields = ['c_' + productId.toLowerCase(), 'o_' + productId.toLowerCase(), 'price'];
        for (let field of possibleFields) {
            if (sampleEntry[field] !== undefined) {
                priceField = field;
                break;
            }
        }
        console.log(`🔍 Using price field: ${priceField}`);
    }
    
    // Create new entry
    const newEntry = {
        price_date: dateToUse,
        date: dateToUse,
        [priceField]: newPrice,
        simulated: true
    };
    
    // Copy other fields from the last entry to maintain structure
    if (sampleEntry) {
        Object.keys(sampleEntry).forEach(key => {
            if (!newEntry[key] && key !== 'price_date' && key !== 'date') {
                newEntry[key] = sampleEntry[key];
            }
        });
    }
    
    // REPLACE existing entry or ADD new one
    if (existingEntryIndex !== -1) {
        console.log(`🔄 Replacing existing entry for ${dateToUse}`);
        historicalData[existingEntryIndex] = newEntry;
    } else {
        console.log(`➕ Adding new entry for ${dateToUse}`);
        historicalData.push(newEntry);
    }
    
    console.log(`✅ Historical data updated. New length: ${historicalData.length}`);
}

function getNextMonthText() {
    // Calculate the month AFTER the current simulation date
    const nextMonthDate = new Date(window.simulationDate);
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    
    const year = nextMonthDate.getFullYear();
    const month = nextMonthDate.getMonth(); // 0-11
    
    const result = `${months[month]} ${year}`;
    console.log(`📅 Displaying prediction for: ${result}`);
    return result;
}

function initializeDynamicTimeline(historicalData, productId) {
    if (!historicalData || historicalData.length === 0) {
        console.warn(`No historical data for ${productId}`);
        return historicalData;
    }
    
    console.log(`🔄 Creating dynamic timeline for ${productId}`);
    
    // Check if data already has valid dates
    const hasValidDates = historicalData.some(entry => 
        entry.price_date || entry.date
    );
    
    if (hasValidDates) {
        console.log(`Using existing dates from CSV for ${productId}`);
        // Ensure all entries have proper date format
        const fixedData = historicalData.map(entry => {
            const dateStr = entry.price_date || entry.date;
            return {
                ...entry,
                price_date: dateStr,
                date: dateStr
            };
        });
        return fixedData;
    }
    
    // Fallback: create timeline ending at current date
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - (historicalData.length - 1));
    
    const fixedData = [];
    historicalData.forEach((entry, index) => {
        const dataDate = new Date(startDate);
        dataDate.setMonth(startDate.getMonth() + index);
        
        const year = dataDate.getFullYear();
        const month = (dataDate.getMonth() + 1).toString().padStart(2, '0');
        const dateStr = `${year}-${month}`;
        
        fixedData.push({
            ...entry,
            price_date: dateStr,
            date: dateStr
        });
    });
    
    console.log(`📈 Dynamic timeline for ${productId}:`, {
        start: fixedData[0]?.price_date,
        end: fixedData[fixedData.length - 1]?.price_date,
        dataPoints: fixedData.length
    });
    
    return fixedData;
}

function setupDynamicSimulationDate() {
    // Try to get the last date from historical data
    if (window.products && window.products.length > 0) {
        const firstProduct = window.products[0];
        const historicalData = window[`historical_${firstProduct}`] || [];
        
        if (historicalData.length > 0) {
            const lastEntry = historicalData[historicalData.length - 1];
            const lastDate = lastEntry.price_date || lastEntry.date;
            
            if (lastDate) {
                const [year, month] = lastDate.split('-').map(Number);
                window.simulationDate = new Date(year, month - 1, 1);
                window.simulationDate.setMonth(window.simulationDate.getMonth() + 1); // Start from next month
                console.log('🎯 Dynamic simulation starts from:', window.simulationDate.toISOString().slice(0, 7));
                return;
            }
        }
    }
    
    // Fallback: start from current month
    window.simulationDate = new Date();
    window.simulationDate.setDate(1);
    console.log('🎯 Fallback simulation starts from:', window.simulationDate.toISOString().slice(0, 7));
}

document.addEventListener("DOMContentLoaded", function() {
    // Dynamic simulation date setup
    setupDynamicSimulationDate();

    // Method 1: Use window.products if available
    if (window.products && window.products.length > 0) {
        window.products.forEach(initializeProduct);
    } 
    // Method 2: Auto-detect from product cards
    else {
        const productCards = document.querySelectorAll('[id^="product-"]');
        if (productCards.length > 0) {
            productCards.forEach(card => {
                const id = card.id.replace('product-', '');
                initializeProduct(id);
            });
        }
    }

    function initializeProduct(id) {
        let historical = window['historical_' + id] || [];
        
        historical = initializeDynamicTimeline(historical, id);
        window['historical_' + id] = historical;
        
        if (historical.length === 0) {
            console.warn(`No historical data found for product ${id}`);
            return;
        }
        
        const priceField = detectPriceField(historical[0], id);
        if (!priceField) {
            console.error(`Cannot display ${id}: No price field detected`);
            return;
        }
        
        drawChart(id, historical, 12);
    }
});

window.updateChart = function(id, months) {
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

    // Destroy existing chart
    if (window[`chart_${id}`]) window[`chart_${id}`].destroy();

    // Find the correct price field
    const priceKey = detectPriceField(hist[0], id);
    if (!priceKey) {
        console.error(`No price field found for ${id}. Available fields:`, Object.keys(hist[0]));
        showChartError(chartElem, `No price data found for ${id}`);
        return;
    }

    const labels = hist.map(h => {
        const date = h.price_date || h.date;
        if (date && date.includes('-')) {
            const [year, month] = date.split('-');
            const monthNum = parseInt(month);
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthName = monthNames[monthNum - 1] || month;
            return `${monthName} ${year}`;
        }
        return date;
    });
    
    const prices = hist.map(h => h[priceKey]);

    console.log(`Chart for ${id}:`, { labels, prices, priceKey });

    // Create the chart
    window[`chart_${id}`] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: id + " Price",
                data: prices,
                borderColor: 'rgba(54,162,235,1)',
                backgroundColor: 'rgba(54,162,235,0.2)',
                borderWidth: 2,
                fill: true,
                tension: 0.25,
                pointRadius: 3,
                pointBackgroundColor: function(context) {
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
                x: { title: { display: true, text: 'Date' } },
                y: { title: { display: true, text: 'Price' }, beginAtZero: false }
            },
            plugins: {
                legend: { display: true },
                tooltip: { 
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

// Error display for charts 
function showChartError(canvasElement, message) {
    canvasElement.style.display = 'none';
    const errorDiv = document.createElement('div');
    errorDiv.className = 'chart-error';
    errorDiv.innerHTML = `<div class="alert alert-warning">${message}</div>`;
    canvasElement.parentNode.appendChild(errorDiv);
}

// Logout confirmation
function confirmLogout() {
    if (confirm("Are you sure you want to log out?")) {
        window.location.href = '/logout';
    }
}