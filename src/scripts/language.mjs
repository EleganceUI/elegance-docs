// The reader's language (C++ or Rust), remembered across pages and visits. <html data-lang> says
// which one is showing; CSS hides the other's code and prose. Set before the page paints (inline in
// the head, from astro.config.mjs), and changed by any [data-set-lang] button.

export const languageScript = `
(() => {
	const key = 'elegance-language';
	const apply = (lang) => {
		document.documentElement.dataset.lang = lang;
		for (const button of document.querySelectorAll('[data-set-lang]')) {
			button.setAttribute('aria-pressed', String(button.dataset.setLang === lang));
		}
	};
	let lang = 'cpp';
	try { lang = new URLSearchParams(location.search).get('lang') || localStorage.getItem(key) || 'cpp'; } catch {}
	if (lang !== 'cpp' && lang !== 'rust') lang = 'cpp';
	document.documentElement.dataset.lang = lang;
	document.addEventListener('DOMContentLoaded', () => {
		// "On this page" lists headings of both languages: give each entry its heading's language,
		// so the same CSS hides it.
		for (const link of document.querySelectorAll('starlight-toc a[href^="#"], mobile-starlight-toc a[href^="#"]')) {
			const only = document.getElementById(decodeURIComponent(link.hash.slice(1)))?.closest('.elg-only-cpp, .elg-only-rust');
			if (only) link.parentElement.classList.add(only.classList.contains('elg-only-cpp') ? 'elg-only-cpp' : 'elg-only-rust');
		}
		apply(document.documentElement.dataset.lang);
	});
	document.addEventListener('click', (event) => {
		const button = event.target.closest && event.target.closest('[data-set-lang]');
		if (!button) return;
		// Keep what the reader was looking at in place while the code above it changes height.
		const top = button.getBoundingClientRect().top;
		apply(button.dataset.setLang);
		try { localStorage.setItem(key, button.dataset.setLang); } catch {}
		window.scrollBy(0, button.getBoundingClientRect().top - top);
	});
})();
`;
