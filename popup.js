// Apply translations
document.querySelectorAll('[data-i18n]').forEach(el => {
  el.textContent = chrome.i18n.getMessage(el.dataset.i18n);
});

document.querySelectorAll('[data-i18n-title]').forEach(el => {
  const message = chrome.i18n.getMessage(el.dataset.i18nTitle);
  el.title = message;
  el.setAttribute('aria-label', message);
});

document.querySelectorAll('[data-ja-href]').forEach(el => {
  const locale = chrome.i18n.getMessage('@@ui_locale');
  if (locale.startsWith('ja')) {
    el.href = el.dataset.jaHref;
  }
});

const shared = globalThis.CatGatekeeperShared;

function mergeSettingsWithDefaults(settings) {
  return shared.normalizeSettings(settings);
}

function formatDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatUsage(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

function getClampedNumberValue(inputId, fallbackValue) {
  const input = document.getElementById(inputId);
  const parsedValue = Number.parseInt(input.value, 10);
  const minValue = Number.parseInt(input.min, 10);
  const maxValue = Number.parseInt(input.max, 10);

  if (Number.isNaN(parsedValue)) {
    return fallbackValue;
  }

  return Math.min(Math.max(parsedValue, minValue), maxValue);
}

const dismissBtn = document.getElementById('dismissBtn');
const resetUsageBtn = document.getElementById('resetUsageBtn');
const statusSection = document.getElementById('statusSection');
const statusTrackedValue = document.getElementById('statusTrackedValue');
const statusDomainValue = document.getElementById('statusDomainValue');
const statusUsageValue = document.getElementById('statusUsageValue');
const statusBreakRow = document.getElementById('statusBreakRow');
const statusBreakValue = document.getElementById('statusBreakValue');

function showActionMessage(messageKey) {
  const el = document.getElementById('actionMsg');
  el.textContent = chrome.i18n.getMessage(messageKey);
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 2000);
}

function refreshStatus() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs?.[0]?.id;
    if (!tabId) return;

    chrome.tabs.sendMessage(tabId, { type: 'GET_CAT_STATUS' }, (res) => {
      void chrome.runtime.lastError;
      if (!res) return;

      dismissBtn.style.display = res.catIsActive ? 'block' : 'none';

      statusSection.style.display = 'block';
      statusTrackedValue.textContent = res.isTracked
        ? chrome.i18n.getMessage('siteStatusTrackedYes')
        : chrome.i18n.getMessage('siteStatusTrackedNo');
      statusDomainValue.textContent = res.isTracked ? (res.trackedDomain || '-') : '-';
      statusUsageValue.textContent = res.isTracked ? formatUsage(res.usageSeconds) : '-';

      if (res.catIsActive && res.breakRemainingSeconds > 0) {
        statusBreakRow.style.display = 'flex';
        statusBreakValue.textContent = formatDuration(res.breakRemainingSeconds);
      } else {
        statusBreakRow.style.display = 'none';
      }

      resetUsageBtn.style.display = res.isTracked ? 'block' : 'none';
      resetUsageBtn.disabled = !res.isTracked;
    });
  });
}

refreshStatus();

dismissBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type: 'DISMISS_CAT' }, () => {
      void chrome.runtime.lastError;
    });
    dismissBtn.style.display = 'none';
  });
});

resetUsageBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs?.[0]?.id;
    if (!tabId) return;
    chrome.tabs.sendMessage(tabId, { type: 'RESET_USAGE' }, (res) => {
      void chrome.runtime.lastError;
      if (res?.ok) showActionMessage('resetUsageDoneMessage');
      refreshStatus();
    });
  });
});

const defaults = {
  ...shared.DEFAULT_SETTINGS,
};

// Load settings
chrome.storage.local.get(null, (settings) => {
  const mergedSettings = mergeSettingsWithDefaults(settings);

  document.getElementById('usageLimit').value = mergedSettings.usageLimit;
  document.getElementById('breakTime').value = mergedSettings.breakTime;
  document.getElementById('customDomains').value = mergedSettings.customDomains.join('\n');
  document.getElementById('catEnabled').checked = mergedSettings.catEnabled;
});

// Save settings
document.getElementById('saveBtn').addEventListener('click', () => {
  const settings = {
    catEnabled: document.getElementById('catEnabled').checked,
    usageLimit: getClampedNumberValue('usageLimit', defaults.usageLimit),
    breakTime: getClampedNumberValue('breakTime', defaults.breakTime),
    customDomains: shared.normalizeDomainList(document.getElementById('customDomains').value),
  };

  document.getElementById('usageLimit').value = settings.usageLimit;
  document.getElementById('breakTime').value = settings.breakTime;
  document.getElementById('customDomains').value = settings.customDomains.join('\n');

  chrome.storage.local.set(settings, () => {
    const msg = document.getElementById('savedMsg');
    msg.style.display = 'block';
    setTimeout(() => msg.style.display = 'none', 2000);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'UPDATE_SETTINGS', settings }, () => {
        void chrome.runtime.lastError;
      });
    });

    refreshStatus();
  });
});

