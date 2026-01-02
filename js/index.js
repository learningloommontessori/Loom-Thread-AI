// js/landing.js

document.addEventListener('DOMContentLoaded', () => {
    // Function to handle the loading animation and navigation
    const handleNavClick = (event) => {
        event.preventDefault(); // Stop the link from navigating immediately
        
        const button = event.currentTarget;
        const text = button.querySelector('.btn-text');
        const loader = button.querySelector('.btn-loader');
        const destination = button.href;

        // Disable button and show loader
        button.style.pointerEvents = 'none';
        text.style.display = 'none';
        loader.style.display = 'inline-block';

        // Wait a short moment before navigating to allow the animation to be seen
        setTimeout(() => {
            window.location.href = destination;
        }, 500); // 0.5 second delay
    };

    // Attach the event listener to all three main navigation buttons
    const signInBtn = document.getElementById('signin-btn');
    const signUpBtn = document.getElementById('signup-btn');
    const startInspiringBtn = document.getElementById('start-inspiring-btn');

    if (signInBtn) {
        signInBtn.addEventListener('click', handleNavClick);
    }
    if (signUpBtn) {
        signUpBtn.addEventListener('click', handleNavClick);
    }
    if (startInspiringBtn) {
        startInspiringBtn.addEventListener('click', handleNavClick);
    }
});
