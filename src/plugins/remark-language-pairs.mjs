// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
// If a copy of the MPL was not distributed with this file, You can obtain one at
// https://mozilla.org/MPL/2.0/.

// The same code in C++ and Rust: a ```cpp block followed directly by a ```rust block becomes one
// sample with a C++/Rust switch. The reader's choice (the sidebar's picker, or these tabs) applies
// to every sample on every page; see src/scripts/language.mjs.
//
//   ```cpp
//   const State<int> count(0);
//   ```
//   ```rust
//   let count = State::new(0);
//   ```

const LANGUAGES = [
	['cpp', 'C++'],
	['rust', 'Rust'],
];

const element = (tagName, properties, children = []) => ({
	type: 'elgElement',
	data: { hName: tagName, hProperties: properties },
	children,
});

// Rust lines starting with "# " are set-up the sample needs to compile (scripts/check-rust-samples.mjs)
// but readers don't, as in rustdoc: they're left out of the page.
const hideSetup = (node) => {
	if (node.type === 'code' && node.lang === 'rust') {
		node.value = node.value
			.split('\n')
			.filter((line) => !/^\s*#( |$)/.test(line))
			.join('\n');
	}
};

export default function remarkLanguagePairs() {
	return (tree) => {
		const visit = (node) => {
			hideSetup(node);
			if (!node.children) return;
			const out = [];
			for (let i = 0; i < node.children.length; i++) {
				const first = node.children[i];
				const second = node.children[i + 1];
				if (first.type === 'code' && first.lang === 'cpp' && second?.type === 'code' && second.lang === 'rust') {
					const tabs = element(
						'div',
						{ className: ['elg-lang-tabs'], role: 'group', ariaLabel: 'Language' },
						LANGUAGES.map(([id, label]) =>
							element('button', { type: 'button', dataSetLang: id, className: ['elg-lang-tab'] }, [{ type: 'text', value: label }]),
						),
					);
					hideSetup(first);
					hideSetup(second);
					out.push(element('div', { className: ['elg-lang-pair'] }, [tabs, first, second]));
					i++;
					continue;
				}
				visit(first);
				out.push(first);
			}
			node.children = out;
		};
		visit(tree);
	};
}
