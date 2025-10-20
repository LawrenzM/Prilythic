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

function drawChart(id, historical, months) {  // Only sanitized IDs
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

    // Find price key (everything except date)
    const priceKey = Object.keys(hist[0]).find(k => k !== "price_date");

    window[`chart_${id}`] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hist.map(h => h.price_date),
            datasets: [{
                label: id.replace(/_/g, " ").replace(/-/g, "/") + " Price",
                data: hist.map(h => h[priceKey]),
                borderColor: 'rgba(54,162,235,1)',
                backgroundColor: 'rgba(54,162,235,0.2)',
                borderWidth: 2,
                fill: true,
                tension: 0.25,
                pointRadius: 3
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
                tooltip: { enabled: true }
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
