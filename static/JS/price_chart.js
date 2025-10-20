const products = window.products;

// Initial rendering for each product chart
products.forEach(product => {
    // Use the global historical data for each product
    const historical = window['historical_' + product] || [];
    // Default to show past 3 months
    drawChart(product, historical, 3);
});

// Handler for updating charts dynamically
window.updateChart = function(product, months) {
    const data = window['historical_' + product] || [];
    // Clamp months to available data length
    const actualMonths = Math.min(months, data.length);
    drawChart(product, data, actualMonths);
};

// Draw a single product chart
function drawChart(product, historical, months) {
    // Handle no data gracefully
    if (!historical || historical.length === 0) {
        console.warn(`No historical data for ${product}`);
        return;
    }

    // Clamp months to available data
    const actualMonths = Math.min(months, historical.length);
    const hist = historical.slice(-actualMonths);

    // Get the target chart context, ensure element exists
    const chartElem = document.getElementById(`priceChart-${product}`);
    if (!chartElem) {
        console.warn(`No canvas element found for product chart: ${product}`);
        return;
    }
    const ctx = chartElem.getContext("2d");

    // Destroy previous chart instance if it exists
    if (window[`chart_${product}`]) {
        window[`chart_${product}`].destroy();
    }

    // Create new chart instance
    window[`chart_${product}`] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hist.map(h => h.price_date),
            datasets: [{
                label: `${product} Price`,
                data: hist.map(h => h[product]),
                borderColor: 'blue',
                backgroundColor: 'rgba(0,123,255,0.2)', // optional: light blue fill under line
                fill: false,
                tension: 0.25,  // optional: smooths the line
                pointRadius: 2, // smaller points for clarity
            }]
        },
        options: {
            responsive: true, // recommended for Bootstrap layouts
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
                tooltip: { enabled: true }
            }
        }
    });
}
