(() => {
  const root = document.documentElement;
  const key = 'yanyu-color-theme';
  const preference = window.matchMedia('(prefers-color-scheme: dark)');
  let saved;
  let button;
  try {
    saved = localStorage.getItem(key);
  } catch {
    // Browsers can deny storage. The switch still works in the current tab.
  }

  function apply() {
    const theme = saved === 'light' || saved === 'dark'
      ? saved
      : preference.matches ? 'dark' : 'light';
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#15191f' : '#fafaf8');
    if (button) {
      button.setAttribute('aria-label', theme === 'dark' ? '切换浅色模式' : '切换深色模式');
    }
  }

  apply();
  preference.addEventListener('change', apply);
  document.addEventListener('DOMContentLoaded', () => {
    button = document.getElementById('theme-toggle');
    if (!button) return;
    button.addEventListener('click', () => {
      saved = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(key, saved);
      } catch {
        // Keep the choice in memory when storage is unavailable.
      }
      apply();
    });
    apply();
    button.hidden = false;
  });
})();
