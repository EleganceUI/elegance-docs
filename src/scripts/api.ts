// The C++ API's pages and where each is listed (src/generated/cpp-api.json, from
// scripts/gen-reference.mjs): the sidebar, breadcrumbs, Topics, and See Also read it.
import data from '../generated/cpp-api.json';

// Groups of page ids under their heading.
export type Groups = [string, string[]][];

export const api = data as {
	symbols: Record<string, { label: string; kind: string; parent: string }>;
	children: Record<string, Groups>;
};

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export const hrefOf = (id: string) => `${base}/${id}/`;
export const idOf = (href: string) => href.slice(base.length).replace(/^\/|\/$/g, '');

// The pages a symbol is listed under: its guide (or class, or header), that one's, and so on.
export function ancestorsOf(id: string): string[] {
	const out: string[] = [];
	for (let parent = api.symbols[id]?.parent; parent; parent = api.symbols[parent]?.parent) out.push(parent);
	return out;
}

// Prose with `code` in it, as HTML.
export const inlineHtml = (text: string) =>
	text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/`([^`]+)`/g, '<code>$1</code>');
