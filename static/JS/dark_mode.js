// Function to toggle dark mode
function toggleDarkMode() {
    const isDark = document.body.classList.contains('dark-mode');
    if (isDark) {
        localStorage.setItem('darkMode', 'false');
        document.body.classList.remove('dark-mode');
    } else {
        localStorage.setItem('darkMode', 'true');
        document.body.classList.add('dark-mode');
    }
    updateDarkModeButton();
}

// Function to apply dark mode
function applyDarkMode() {
    document.body.classList.add('dark-mode');
}

// Function to update button text
function updateDarkModeButton() {
    const darkModeButton = document.getElementById('darkModeBtn');
    if (darkModeButton) {
        const darkMode = localStorage.getItem('darkMode');
        darkModeButton.textContent = darkMode === 'true' ? 'Disable Dark Mode' : 'Enable Dark Mode';
    }
}

// Load saved preference
function loadDarkModePreference() {
    if (localStorage.getItem('darkMode') === 'true') {
        applyDarkMode();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadDarkModePreference();
    updateDarkModeButton();

    const darkModeButton = document.getElementById('darkModeBtn');
    if (darkModeButton) {
        darkModeButton.addEventListener('click', toggleDarkMode);
    }
});
