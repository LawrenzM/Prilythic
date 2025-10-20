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

// Function to disable dark mode
function disableDarkMode() {
    localStorage.setItem('darkMode', 'false');
    document.body.classList.remove('dark-mode');
}

// Function to apply dark mode
function applyDarkMode() {
    document.body.classList.add('dark-mode');
}

// Function to update dark mode button text
function updateDarkModeButton() {
    const darkModeButton = document.querySelector('.pref_but2');
    if (darkModeButton) {
        const darkMode = localStorage.getItem('darkMode');
        if (darkMode === 'true') {
            darkModeButton.textContent = 'Disable';
        } else {
            darkModeButton.textContent = 'Enable';
        }
    }
}

// Function to load saved dark mode preference
function loadDarkModePreference() {
    const darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'true') {
        applyDarkMode();
    }
}

// Initialize dark mode on every page
document.addEventListener('DOMContentLoaded', () => {
    loadDarkModePreference();
    updateDarkModeButton();
    
    // Add click event listener to dark mode button if on preferences page
    const darkModeButton = document.querySelector('.pref_but2');
    if (darkModeButton) {
        darkModeButton.addEventListener('click', toggleDarkMode);
    }
});
