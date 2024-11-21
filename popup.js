document.addEventListener('DOMContentLoaded', function () {
    const filterWordsTextarea = document.getElementById('filterWords');
    const applyButton = document.getElementById('applyFilter');
    const clearButton = document.getElementById('clearFilter');
    const statusDiv = document.getElementById('status');

    filterWordsTextarea.focus();

    chrome.storage.local.get(['filterWords'], function (result) {
        filterWordsTextarea.value = result.filterWords || '';
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            applyButton.click();
        }
        if (e.key === 'Delete' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            clearButton.click();
        }
    });

    applyButton.addEventListener('click', async function () {
        const words = filterWordsTextarea.value
            .split(/[\n\s]+/)
            .map(word => word.trim())
            .filter(word => word !== '');

        await chrome.storage.local.set({
            filterWords: filterWordsTextarea.value
        });

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            try {
                const response = await chrome.tabs.sendMessage(tab.id, {
                    action: "applyFilter",
                    config: {
                        selector: 'div[data-asin]',
                        words: words,
                        removeSelectors: ['.AdHolder.s-flex-full-width', '[data-asin]:not([data-component-type="s-search-result"])']
                    }
                });

                const visibleCount = await chrome.tabs.sendMessage(tab.id, {
                    action: "getVisibleCount"
                });

                showStatus(`Filter applied successfully! (${visibleCount} items shown)`, 'success');
            } catch (messageError) {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });

                await chrome.tabs.sendMessage(tab.id, {
                    action: "applyFilter",
                    config: {
                        selector: 'div[data-asin]',
                        words: words,
                        removeSelectors: ['[data-asin]:not([data-component-type="s-search-result"])']
                    }
                });

                const visibleCount = await chrome.tabs.sendMessage(tab.id, {
                    action: "getVisibleCount"
                });

                showStatus(`Filter applied successfully! (${visibleCount} items shown)`, 'success');
            }
        } catch (error) {
            showStatus(`Error: ${error.message}. Please refresh the page and try again.`, 'error');
        }
    });

    clearButton.addEventListener('click', async function () {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            try {
                await chrome.tabs.sendMessage(tab.id, {
                    action: "clearFilter"
                });
            } catch (messageError) {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });

                await chrome.tabs.sendMessage(tab.id, {
                    action: "clearFilter"
                });
            }

            showStatus('Filter cleared successfully!', 'success');
        } catch (error) {
            showStatus(`Error: ${error.message}. Please refresh the page and try again.`, 'error');
        }
    });

    function showStatus(message, type) {
        if (message.includes('items shown')) {
            const [mainMessage, countPart] = message.split('(');
            statusDiv.innerHTML = `${mainMessage}<strong>(${countPart}</strong>`;
        } else {
            statusDiv.textContent = message;
        }

        statusDiv.className = 'status ' + type;
        statusDiv.style.display = 'block';
    }
});