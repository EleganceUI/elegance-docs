// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
// If a copy of the MPL was not distributed with this file, You can obtain one at
// https://mozilla.org/MPL/2.0/.

// The headings that start a page's sections, ruled off from what's above them (the elg-section
// class): on a guide, an "Overview" heading over the text before its first heading, as an article
// on Apple's developer site has; on the home page and in the reference, every ## heading. A guide's
// own ## headings are subsections of its overview and aren't ruled.

const section = (node) => {
	node.data = { ...node.data, hProperties: { ...node.data?.hProperties, className: ['elg-section'] } };
	return node;
};

// Imports and frontmatter come before a page's content but aren't part of it.
const SETUP = new Set(['mdxjsEsm', 'yaml', 'toml']);

export default function remarkSections() {
	return (tree, file) => {
		const path = (file.path ?? file.history?.[0] ?? '').replaceAll('\\', '/');
		if (!path.includes('/src/content/docs/')) return;

		if (path.includes('/docs/reference/') || /\/docs\/index\.mdx?$/.test(path)) {
			for (const node of tree.children) if (node.type === 'heading' && node.depth === 2) section(node);
			return;
		}

		const first = tree.children.findIndex((node) => !SETUP.has(node.type));
		if (first === -1 || tree.children[first].type === 'heading') return;
		tree.children.splice(first, 0, section({ type: 'heading', depth: 2, children: [{ type: 'text', value: 'Overview' }] }));
	};
}
