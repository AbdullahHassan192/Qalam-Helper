//Shared helper functions

const QalamHelper = {
    _numRegex: /[^0-9.-]/g,

    /*Parse number from text, handling various formats*/
    parseNumber(text) {
        if (typeof text === 'number') return text;
        if (!text) return 0;
        
        const str = typeof text === 'string' ? text : text.toString();
        const cleaned = str.replace(this._numRegex, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    },

    /*Format percentage with specified decimal places*/
    formatPercent(value, decimals = 2) {
        if (value === null || value === undefined || isNaN(value)) return '0.00';
        return value.toFixed(decimals);
    },

    /*Create element with class name*/
    createElement(tag, className) {
        const elem = document.createElement(tag);
        if (className) elem.className = className;
        return elem;
    },

    /*Detect current page type*/
    detectPage() {
        const url = window.location.href;
        if (url.includes('/student/course/gradebook/')) return 'gradebook';
        if (url.includes('/student/results/')) return 'results';
        if (url.includes('/student/course/attendance/')) return 'attendance-detail';
        if (url.includes('/student/attendance')) return 'attendance-overview';
        if (url.includes('/student/dashboard') || url === 'https://qalam.nust.edu.pk/' || url === 'https://qalam.nust.edu.pk') return 'dashboard';
        return 'unknown';
    }
};
