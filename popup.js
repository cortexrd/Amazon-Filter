document.addEventListener('DOMContentLoaded', function () {
    const keepWordsTextarea = document.getElementById('keepWords');
    const removeWordsTextarea = document.getElementById('removeWords');
    const applyButton = document.getElementById('applyFilter');
    const clearButton = document.getElementById('clearFilter');
    const statusDiv = document.getElementById('status');

    // Load saved words from storage
    chrome.storage.local.get(['keepWords', 'removeWords'], function (result) {
        keepWordsTextarea.value = result.keepWords || '';
        removeWordsTextarea.value = result.removeWords || '';
    });

    // Add keyboard shortcuts
    document.addEventListener('keydown', function (e) {
        // Ctrl+Enter to apply filter
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            applyButton.click();
        }
        // Ctrl+Delete to clear filter
        if (e.key === 'Delete' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            clearButton.click();
        }
    });

    // Apply filter
    applyButton.addEventListener('click', async function () {
        const keepWords = keepWordsTextarea.value.split('\n').filter(word => word.trim() !== '');
        const removeWords = removeWordsTextarea.value.split('\n').filter(word => word.trim() !== '');

        // Save to storage
        await chrome.storage.local.set({
            keepWords: keepWordsTextarea.value,
            removeWords: removeWordsTextarea.value
        });

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Try to send message to content script first
            try {
                const response = await chrome.tabs.sendMessage(tab.id, {
                    action: "applyFilter",
                    config: {
                        selector: 'div[data-asin]',
                        keepWords: keepWords,
                        removeWords: removeWords,
                        removeSelectors: ['.AdHolder.s-flex-full-width', '[data-asin]:not([data-component-type="s-search-result"])']
                    }
                });

                // Get the count of visible items
                const visibleCount = await chrome.tabs.sendMessage(tab.id, {
                    action: "getVisibleCount"
                });

                showStatus(`Filter applied successfully! (${visibleCount} items shown)`, 'success');
            } catch (messageError) {
                // If messaging fails, inject and execute the script directly
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });

                // Try sending the message again after injection
                await chrome.tabs.sendMessage(tab.id, {
                    action: "applyFilter",
                    config: {
                        selector: 'div[data-asin]',
                        keepWords: keepWords,
                        removeWords: removeWords,
                        removeSelectors: ['[data-asin]:not([data-component-type="s-search-result"])']
                    }
                });

                // Get the count of visible items
                const visibleCount = await chrome.tabs.sendMessage(tab.id, {
                    action: "getVisibleCount"
                });

                showStatus(`Filter applied successfully! (${visibleCount} items shown)`, 'success');
            }
        } catch (error) {
            showStatus(`Error: ${error.message}. Please refresh the page and try again.`, 'error');
        }
    });

    // Clear filter
    clearButton.addEventListener('click', async function () {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            try {
                await chrome.tabs.sendMessage(tab.id, {
                    action: "clearFilter"
                });
            } catch (messageError) {
                // If messaging fails, inject and execute the script directly
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });

                // Try sending the message again after injection
                await chrome.tabs.sendMessage(tab.id, {
                    action: "clearFilter"
                });
            }

            showStatus('Filter cleared successfully!', 'success');
        } catch (error) {
            showStatus(`Error: ${error.message}. Please refresh the page and try again.`, 'error');
        }
    });

    // Update the showStatus function in popup.js
    function showStatus(message, type) {
        if (message.includes('items shown')) {
            // Split the message and wrap the count part in <strong> tags
            const [mainMessage, countPart] = message.split('(');
            statusDiv.innerHTML = `${mainMessage}<strong>(${countPart}</strong>`;
        } else {
            // For other messages (like errors), use regular text
            statusDiv.textContent = message;
        }

        statusDiv.className = 'status ' + type;
        statusDiv.style.display = 'block';
    }
});