// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
// If a copy of the MPL was not distributed with this file, You can obtain one at
// https://mozilla.org/MPL/2.0/.

// Generates the Rust API reference (src/content/docs/reference/rust/) from rustdoc's JSON output
// for the elegance-rs crates. Each public module becomes a page: the module's documentation, a
// summary of what's in it, then every item with its declaration, its documentation, and (for
// types) its methods and the traits it implements. Intra-doc links point into these pages.
//
// The JSON comes from a nightly toolchain (rustdoc's JSON output is unstable):
//   RUSTDOCFLAGS="-Z unstable-options --output-format json" cargo +nightly doc --no-deps -p elegance
// in elegance-rs (`npm run rust-json` does it for each crate). RUST_DOC_JSON_DIR says where the
// .json files are; by default elegance-rs's target/doc. Without them, the Rust reference is a
// page saying how to make them.

import fs from 'node:fs';
import path from 'node:path';

import { root, rustDir } from './paths.mjs';

const jsonDir = path.resolve(root, process.env.RUST_DOC_JSON_DIR || path.join(rustDir, 'target/doc'));
const outDir = path.join(root, 'src/content/docs/reference/rust');
// Links are absolute, under the site's base path (DOCS_BASE, as in astro.config.mjs).
const base = `${(process.env.DOCS_BASE || '').replace(/\/$/, '')}/reference/rust`;

// The crates documented, in sidebar order, each under a page prefix.
const crates = [
	{ file: 'elegance.json', name: 'elegance', title: 'elegance', slug: '' },
	{ file: 'elegance_macros.json', name: 'elegance_macros', title: 'elegance-macros', slug: 'macros' },
	{ file: 'elegance_wgpu.json', name: 'elegance_wgpu', title: 'elegance-wgpu', slug: 'wgpu' },
];

// rustdoc's JSON changes between nightlies; this is the format the generator was written for.
const FORMAT_VERSION = 61;

// --- Pages and anchors ---

const PRIMITIVES = new Set(['bool', 'char', 'str', 'f32', 'f64', 'i8', 'i16', 'i32', 'i64', 'i128', 'isize', 'u8', 'u16', 'u32', 'u64', 'u128', 'usize']);
const kindOrder = ['macro', 'proc_macro', 'struct', 'enum', 'trait', 'function', 'type_alias', 'constant', 'static', 'union'];
const kindTitle = {
	macro: 'Macros',
	proc_macro: 'Macros',
	struct: 'Structs',
	enum: 'Enums',
	trait: 'Traits',
	function: 'Functions',
	type_alias: 'Type aliases',
	constant: 'Constants',
	static: 'Statics',
	union: 'Unions',
};
const kindWord = {
	macro: 'macro',
	proc_macro: 'macro',
	struct: 'struct',
	enum: 'enum',
	trait: 'trait',
	function: 'fn',
	type_alias: 'type',
	constant: 'const',
	static: 'static',
	union: 'union',
};

const kindOf = (item) => Object.keys(item.inner)[0];

// A heading's id, as Starlight's slugger makes it from the heading's text.
const slug = (text) =>
	text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s_-]/gu, '')
		.trim()
		.replace(/\s/g, '-');

// --- Rendering types and signatures ---

function makePrinter(crate) {
	const { index, paths } = crate.json;

	// The URL of an item (ours, the standard library's, or none).
	function urlOf(id) {
		const entry = paths[id];
		if (entry && entry.crate_id === 0 && crate.pages.has(id)) {
			return crate.pages.get(id);
		}
		for (const other of crates) {
			if (other === crate || !other.json || !entry) continue;
			const external = crate.json.external_crates[entry.crate_id];
			if (external && external.name === other.name) {
				const target = other.byPath.get(entry.path.join('::'));
				if (target !== undefined) return other.pages.get(target);
			}
		}
		if (entry) {
			const external = crate.json.external_crates[entry.crate_id];
			if (external && ['std', 'core', 'alloc'].includes(external.name)) {
				const folder = entry.path.slice(0, -1).join('/');
				const name = entry.path[entry.path.length - 1];
				const prefix = { struct: 'struct', enum: 'enum', trait: 'trait', function: 'fn', type_alias: 'type', macro: 'macro' }[entry.kind];
				if (prefix) return `https://doc.rust-lang.org/std/${folder.replace(/^(std|core|alloc)\/?/, '')}${folder.includes('/') ? '/' : ''}${prefix}.${name}.html`.replace('/std//', '/std/');
			}
		}
		return null;
	}

	const lifetime = (l) => l;

	function genericArgs(args) {
		if (!args) return '';
		if (args.angle_bracketed) {
			const parts = [];
			for (const arg of args.angle_bracketed.args) {
				if (arg.lifetime) parts.push(lifetime(arg.lifetime));
				else if (arg.type) parts.push(type(arg.type));
				else if (arg.const) parts.push(arg.const.expr ?? '_');
				else if (arg === 'infer') parts.push('_');
			}
			for (const c of args.angle_bracketed.constraints ?? []) {
				const name = c.name + genericArgs(c.args);
				if (c.binding?.equality) parts.push(`${name} = ${term(c.binding.equality)}`);
				else if (c.binding?.constraint) parts.push(`${name}: ${bounds(c.binding.constraint)}`);
			}
			return parts.length ? `<${parts.join(', ')}>` : '';
		}
		if (args.parenthesized) {
			const out = args.parenthesized.output ? ` -> ${type(args.parenthesized.output)}` : '';
			return `(${args.parenthesized.inputs.map(type).join(', ')})${out}`;
		}
		return '';
	}

	const term = (t) => (t.type ? type(t.type) : t.constant?.expr ?? '_');

	function pathName(p) {
		// The last segment is enough: `State`, not `crate::reactive::State`.
		const name = p.path.split('::').pop();
		return name + genericArgs(p.args);
	}

	function bound(b) {
		if (b.trait_bound) {
			const hrtb = b.trait_bound.generic_params?.length
				? `for<${b.trait_bound.generic_params.map((g) => g.name).join(', ')}> `
				: '';
			const modifier = b.trait_bound.modifier === 'maybe' ? '?' : b.trait_bound.modifier === 'maybe_const' ? '~const ' : '';
			return hrtb + modifier + pathName(b.trait_bound.trait);
		}
		if (b.outlives) return b.outlives;
		if (b.use) return `use<${b.use.map((u) => u.lifetime ?? u.param ?? u).join(', ')}>`;
		return '_';
	}

	const bounds = (list) => list.map(bound).join(' + ');

	function type(t) {
		if (t === 'infer' || t == null) return '_';
		if (t.resolved_path) return pathName(t.resolved_path);
		if (t.generic !== undefined) return t.generic;
		if (t.primitive !== undefined) return t.primitive;
		if (t.borrowed_ref) {
			const r = t.borrowed_ref;
			return `&${r.lifetime ? r.lifetime + ' ' : ''}${r.is_mutable ? 'mut ' : ''}${type(r.type)}`;
		}
		if (t.raw_pointer) return `*${t.raw_pointer.is_mutable ? 'mut' : 'const'} ${type(t.raw_pointer.type)}`;
		if (t.tuple) return t.tuple.length === 1 ? `(${type(t.tuple[0])},)` : `(${t.tuple.map(type).join(', ')})`;
		if (t.slice) return `[${type(t.slice)}]`;
		if (t.array) return `[${type(t.array.type)}; ${t.array.len}]`;
		if (t.impl_trait) return `impl ${bounds(t.impl_trait)}`;
		if (t.dyn_trait) {
			const traits = t.dyn_trait.traits.map((p) => pathName(p.trait));
			if (t.dyn_trait.lifetime) traits.push(t.dyn_trait.lifetime);
			return `dyn ${traits.join(' + ')}`;
		}
		if (t.qualified_path) {
			const q = t.qualified_path;
			const self = type(q.self_type);
			// rustdoc leaves the trait's path empty when the source said `Self::Item` or `S::Key`.
			const trait = q.trait ? pathName(q.trait) : '';
			return trait ? `<${self} as ${trait}>::${q.name}` : `${self}::${q.name}`;
		}
		if (t.function_pointer) {
			const f = t.function_pointer;
			const out = f.sig.output ? ` -> ${type(f.sig.output)}` : '';
			return `fn(${f.sig.inputs.map(([, it]) => type(it)).join(', ')})${out}`;
		}
		if (t.pat) return type(t.pat.type);
		return '_';
	}

	function genericParams(generics) {
		const params = generics.params.filter((p) => !(p.kind.type && p.kind.type.is_synthetic));
		if (!params.length) return '';
		return `<${params
			.map((p) => {
				if (p.kind.lifetime) return p.kind.lifetime.outlives?.length ? `${p.name}: ${p.kind.lifetime.outlives.join(' + ')}` : p.name;
				if (p.kind.const) return `const ${p.name}: ${type(p.kind.const.type)}`;
				const b = p.kind.type.bounds?.length ? `: ${bounds(p.kind.type.bounds)}` : '';
				const d = p.kind.type.default ? ` = ${type(p.kind.type.default)}` : '';
				return p.name + b + d;
			})
			.join(', ')}>`;
	}

	function whereClause(generics) {
		const preds = generics.where_predicates
			.map((w) => {
				if (w.bound_predicate) {
					const bp = w.bound_predicate;
					if (!bp.bounds.length) return null;
					return `${type(bp.type)}: ${bounds(bp.bounds)}`;
				}
				if (w.lifetime_predicate) return `${w.lifetime_predicate.lifetime}: ${w.lifetime_predicate.outlives.join(' + ')}`;
				if (w.eq_predicate) return `${type(w.eq_predicate.lhs)} = ${term(w.eq_predicate.rhs)}`;
				return null;
			})
			.filter(Boolean);
		return preds.length ? `\nwhere\n${preds.map((p) => `    ${p},`).join('\n')}` : '';
	}

	function fnSig(name, fn, visibility = 'pub ') {
		const h = fn.header;
		const quals = `${h.is_const ? 'const ' : ''}${h.is_async ? 'async ' : ''}${h.is_unsafe ? 'unsafe ' : ''}`;
		const args = fn.sig.inputs.map(([n, t]) => {
			if (n === 'self') {
				if (t.generic === 'Self') return 'self';
				if (t.borrowed_ref?.type?.generic === 'Self') {
					const r = t.borrowed_ref;
					return `&${r.lifetime ? r.lifetime + ' ' : ''}${r.is_mutable ? 'mut ' : ''}self`;
				}
			}
			return `${n}: ${type(t)}`;
		});
		const out = fn.sig.output ? ` -> ${type(fn.sig.output)}` : '';
		const head = `${visibility}${quals}fn ${name}${genericParams(fn.generics)}(`;
		const oneLine = head + args.join(', ') + ')' + out;
		const sig = oneLine.length <= 96 ? oneLine : `${head}\n${args.map((a) => `    ${a},`).join('\n')}\n)${out}`;
		return sig + whereClause(fn.generics);
	}

	return { type, bounds, genericParams, whereClause, fnSig, urlOf };
}

// --- Documentation text ---

// Rustdoc markdown to the site's: intra-doc links resolved, code fences made Rust, hidden doctest
// lines dropped, headings moved below the item's own.
function docsToMarkdown(crate, item, printer, depth) {
	let text = item.docs || '';
	if (!text) return '';
	const links = item.links || {};
	const resolve = (target) => {
		const id = links[target] ?? links[`\`${target}\``];
		return id !== undefined ? printer.urlOf(id) : null;
	};
	const lines = text.split('\n');
	const out = [];
	let fence = null;
	for (const line of lines) {
		const open = line.match(/^(\s*)(```+|~~~+)(.*)$/);
		if (open && !fence) {
			const info = open[3].trim().split(',').map((s) => s.trim());
			const lang = info.find((s) => s && !['ignore', 'no_run', 'should_panic', 'compile_fail', 'edition2021', 'edition2024'].includes(s));
			const isRust = !lang || lang === 'rust';
			fence = { marker: open[2], rust: isRust };
			out.push(`${open[1]}${open[2]}${isRust ? 'rust' : lang}`);
			continue;
		}
		if (fence) {
			if (line.trim().startsWith(fence.marker)) {
				fence = null;
				out.push(line);
				continue;
			}
			if (fence.rust && /^\s*#(\s|$)/.test(line) && !/^\s*#\[/.test(line)) continue; // hidden line
			out.push(line);
			continue;
		}
		let prose = line;
		// Headings inside docs go below the item's heading.
		const heading = prose.match(/^(#{1,6})\s+(.*)$/);
		if (heading) prose = `${'#'.repeat(Math.min(6, heading[1].length + depth))} ${heading[2]}`;
		prose = outsideCode(prose, (text) =>
			text
				// [text](target) where target is an intra-doc path.
				.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, target) => {
					if (/^(https?:|#|\/|mailto:)/.test(target)) return match;
					const url = resolve(target);
					return url ? `[${label}](${url})` : label;
				})
				// [`Name`] and [Name] shortcuts.
				.replace(/\[(`?)([^\]`]+)\1\](?![(\[:])/g, (match, tick, name) => {
					const url = resolve(name);
					return url ? `[${tick}${name}${tick}](${url})` : `${tick}${name}${tick}`;
				}),
		);
		out.push(prose);
	}
	return out.join('\n').trim();
}

// The first sentence, for summaries. Periods inside code spans and "e.g." don't end it.
function summaryOf(docs) {
	if (!docs) return '';
	const paragraph = docs.split(/\n\s*\n/)[0].replace(/\n/g, ' ').trim();
	if (paragraph.startsWith('```') || paragraph.startsWith('|') || paragraph.startsWith('#')) return '';
	const sentence = paragraph.match(/^(?:`[^`]*`|e\.g\.|i\.e\.|[^`])+?[.!?](?=\s|$)/);
	return outsideCode(sentence ? sentence[0] : paragraph, (text) =>
		text.replace(/\[(`?)([^\]`]+)\1\]\([^)]*\)/g, '$1$2$1').replace(/\[(`?)([^\]`]+)\1\]/g, '$1$2$1'),
	);
}

// Applies `change` to text and to links around code (`[`Name`]`), but not inside other code
// spans, where brackets are code: `#[component]`.
function outsideCode(text, change) {
	return text
		.split(/(\[`[^`]+`\](?:\([^)\s]*\))?|`[^`]*`)/)
		.map((part) => (part.startsWith('`') ? part : change(part)))
		.join('');
}

const escapeCell = (text) => text.replace(/\|/g, '\\|');

// --- Items ---

function declaration(crate, item, printer) {
	const { index } = crate.json;
	const kind = kindOf(item);
	const inner = item.inner[kind];
	const name = item.name;
	switch (kind) {
		case 'function':
			return printer.fnSig(name, inner);
		case 'struct': {
			const g = printer.genericParams(inner.generics);
			const w = printer.whereClause(inner.generics);
			if (inner.kind === 'unit') return `pub struct ${name}${g}${w};`;
			if (inner.kind.tuple) {
				const fields = inner.kind.tuple.map((id) => (id === null ? '_' : `pub ${printer.type(index[id].inner.struct_field)}`));
				return `pub struct ${name}${g}(${fields.join(', ')})${w};`;
			}
			const fields = inner.kind.plain.fields.map((id) => index[id]).filter((f) => f.visibility === 'public');
			if (!fields.length) return `pub struct ${name}${g}${w} { /* private fields */ }`;
			const lines = fields.map((f) => `    pub ${f.name}: ${printer.type(f.inner.struct_field)},`);
			if (inner.kind.plain.has_stripped_fields) lines.push('    /* private fields */');
			return `pub struct ${name}${g}${w} {\n${lines.join('\n')}\n}`;
		}
		case 'enum': {
			const g = printer.genericParams(inner.generics);
			const variants = inner.variants.map((id) => {
				const v = index[id];
				const k = v.inner.variant.kind;
				if (k === 'plain') return `    ${v.name}${v.inner.variant.discriminant ? ` = ${v.inner.variant.discriminant.expr}` : ''},`;
				if (k.tuple) return `    ${v.name}(${k.tuple.map((f) => (f === null ? '_' : printer.type(index[f].inner.struct_field))).join(', ')}),`;
				const fields = k.struct.fields.map((f) => `${index[f].name}: ${printer.type(index[f].inner.struct_field)}`);
				return `    ${v.name} { ${fields.join(', ')} },`;
			});
			return `pub enum ${name}${g}${printer.whereClause(inner.generics)} {\n${variants.join('\n')}\n}`;
		}
		case 'trait': {
			const g = printer.genericParams(inner.generics);
			const supers = inner.bounds.length ? `: ${printer.bounds(inner.bounds)}` : '';
			const members = inner.items
				.map((id) => index[id])
				.filter(Boolean)
				.map((m) => {
					const mk = kindOf(m);
					if (mk === 'function') return `    ${printer.fnSig(m.name, m.inner.function, '')};`;
					if (mk === 'assoc_type') {
						const b = m.inner.assoc_type.bounds?.length ? `: ${printer.bounds(m.inner.assoc_type.bounds)}` : '';
						return `    type ${m.name}${b};`;
					}
					if (mk === 'assoc_const') return `    const ${m.name}: ${printer.type(m.inner.assoc_const.type)};`;
					return null;
				})
				.filter(Boolean);
			const unsafe = inner.is_unsafe ? 'unsafe ' : '';
			return `pub ${unsafe}trait ${name}${g}${supers}${printer.whereClause(inner.generics)} {\n${members.join('\n')}\n}`;
		}
		case 'type_alias':
			return `pub type ${name}${printer.genericParams(inner.generics)} = ${printer.type(inner.type)};`;
		case 'constant':
			return `pub const ${name}: ${printer.type(inner.type)} = ${inner.const?.expr ?? '…'};`;
		case 'static':
			return `pub static ${inner.is_mutable ? 'mut ' : ''}${name}: ${printer.type(inner.type)};`;
		case 'macro':
			return inner.replace(/\{[\s\S]*\}\s*$/, '{ … }').trim() || `macro_rules! ${name} { … }`;
		case 'proc_macro': {
			if (inner.kind === 'attr') return `#[${name}]`;
			if (inner.kind === 'derive') return `#[derive(${name})]`;
			return `${name}! { … }`;
		}
		default:
			return `pub ${kind} ${name}`;
	}
}

// Inherent methods and implemented traits of a struct, enum or union.
function implsOf(crate, item) {
	const { index } = crate.json;
	const inner = item.inner[kindOf(item)];
	const methods = [];
	const traits = new Set();
	for (const id of inner.impls ?? []) {
		const impl = index[id]?.inner.impl;
		if (!impl || impl.is_synthetic || impl.blanket_impl) continue;
		if (impl.trait) {
			traits.add(impl.trait.path.split('::').pop());
			continue;
		}
		for (const mid of impl.items) {
			const m = index[mid];
			if (m && m.visibility === 'public' && kindOf(m) === 'function') methods.push(m);
			// Associated constants: Color::WHITE, Alignment::TOP.
			else if (m && m.visibility === 'public' && ['constant', 'assoc_const'].includes(kindOf(m))) methods.push(m);
		}
	}
	return { methods, traits: [...traits].sort() };
}

function renderItem(crate, item, printer) {
	const kind = kindOf(item);
	const out = [];
	const title = kind === 'macro' || (kind === 'proc_macro' && item.inner.proc_macro.kind === 'bang') ? `${item.name}!` : item.name;
	out.push(`### ${title}`, '');
	out.push(`<p class="elg-kind">${kindWord[kind]}</p>`, '');
	out.push('```rust', declaration(crate, item, printer), '```', '');
	const docs = docsToMarkdown(crate, item, printer, 3);
	if (docs) out.push(docs, '');

	if (kind === 'enum') {
		const documented = item.inner.enum.variants.map((id) => crate.json.index[id]).filter((v) => v.docs);
		if (documented.length) {
			out.push('<dl class="elg-members">', '');
			for (const v of documented) {
				out.push(`<dt><code>${v.name}</code></dt>`, '<dd>', '', docsToMarkdown(crate, v, printer, 4), '', '</dd>', '');
			}
			out.push('</dl>', '');
		}
	}
	if (kind === 'struct' || kind === 'enum' || kind === 'union') {
		const { methods, traits } = implsOf(crate, item);
		if (methods.length) {
			// Constants first, then methods, as in the source.
			methods.sort((a, b) => (kindOf(a) === 'function') - (kindOf(b) === 'function'));
			const constants = methods.filter((m) => kindOf(m) !== 'function').length;
			const label =
				constants === methods.length ? 'Constants' : constants ? 'Constants and methods' : 'Methods';
			out.push(`<details class="elg-methods"${methods.length <= 12 ? ' open' : ''}>`, `<summary>${label} (${methods.length})</summary>`, '');
			for (const m of methods) {
				const sig =
					kindOf(m) === 'function'
						? printer.fnSig(m.name, m.inner.function)
						: `pub const ${m.name}: ${printer.type((m.inner.constant ?? m.inner.assoc_const).type)};`;
				out.push('```rust', sig, '```', '');
				const docs = docsToMarkdown(crate, m, printer, 4);
				if (docs) out.push(docs, '');
			}
			out.push('</details>', '');
		}
		if (traits.length) {
			out.push(`<p class="elg-traits"><span>Implements</span> ${traits.map((t) => `<code>${t}</code>`).join(' ')}</p>`, '');
		}
	}
	if (kind === 'trait') {
		const impls = item.inner.trait.implementations
			.map((id) => crate.json.index[id]?.inner.impl)
			.filter((impl) => impl && !impl.blanket_impl)
			.map((impl) => printer.type(impl.for))
			// The elg! DSL's leading-dot names (`accent`, `bold`, ...) are types too; they'd bury
			// the implementors that matter.
			.filter((t) => t !== '_' && !(/^[a-z_][a-z0-9_]*$/.test(t) && !PRIMITIVES.has(t)));
		if (impls.length) {
			const unique = [...new Set(impls)].sort();
			out.push(`<p class="elg-traits"><span>Implemented by</span> ${unique.map((t) => `<code>${t.replace(/</g, '&lt;')}</code>`).join(' ')}</p>`, '');
		}
	}
	return out.join('\n');
}

// --- Crates to pages ---

function load(crate) {
	const file = path.join(jsonDir, crate.file);
	if (!fs.existsSync(file)) return false;
	crate.json = JSON.parse(fs.readFileSync(file, 'utf8'));
	if (crate.json.format_version !== FORMAT_VERSION) {
		console.warn(
			`gen-rust-reference: ${crate.file} is rustdoc JSON format ${crate.json.format_version}; this script reads ${FORMAT_VERSION}. Pages may be missing details.`,
		);
	}
	return true;
}

// Where each public item is documented: the public module a user imports it from. Walks the
// module tree from the crate root, following re-exports (`pub use inner::*` from private modules),
// public submodules first so the crate root's re-exports don't take everything.
function plan(crate) {
	const { index, paths } = crate.json;
	crate.pages = new Map();
	crate.byPath = new Map();
	crate.modules = new Map(); // module path -> { module item, items }
	for (const [id, entry] of Object.entries(paths)) {
		if (entry.crate_id === 0) crate.byPath.set(entry.path.join('::'), id);
	}
	const placed = new Set();
	const moduleOf = (key) => {
		if (!crate.modules.has(key)) crate.modules.set(key, { module: null, items: [] });
		return crate.modules.get(key);
	};
	const place = (key, item) => {
		if (placed.has(item.id) || !kindOrder.includes(kindOf(item))) return;
		placed.add(item.id);
		moduleOf(key).items.push(item);
	};
	// The items a module shows: its own, and what it re-exports (globs expanded).
	const contents = (module, seen = new Set()) => {
		const out = [];
		if (seen.has(module.id)) return out;
		seen.add(module.id);
		for (const id of module.inner.module.items) {
			const item = index[id];
			if (!item) continue;
			if (kindOf(item) === 'use') {
				const use = item.inner.use;
				const target = use.id !== null && use.id !== undefined ? index[use.id] : null;
				if (!target || item.visibility !== 'public') continue;
				if (use.is_glob && kindOf(target) === 'module') out.push(...contents(target, seen));
				else out.push(target);
			} else if (item.visibility === 'public') {
				out.push(item);
			}
		}
		return out;
	};
	const visit = (module, key) => {
		const mod = moduleOf(key);
		mod.module = module;
		const items = contents(module);
		for (const item of items) {
			if (kindOf(item) === 'module' && item.name !== 'prelude') visit(item, key ? `${key}::${item.name}` : item.name);
		}
		for (const item of items) place(key, item);
	};
	visit(index[crate.json.root], '');

	for (const [key, mod] of crate.modules) {
		if (!mod.items.length) {
			crate.modules.delete(key);
			continue;
		}
		const page = pageSlug(crate, key);
		const anchors = anchorsOf(mod);
		for (const item of mod.items) crate.pages.set(String(item.id), `${base}/${page}/#${anchors.get(item)}`);
		// Methods and variants link to their type.
		for (const item of mod.items) {
			const inner = item.inner[kindOf(item)];
			const members = [...(inner.variants ?? []), ...(inner.items ?? [])];
			for (const implId of inner.impls ?? []) members.push(...(index[implId]?.inner.impl?.items ?? []));
			for (const mid of members) {
				if (!crate.pages.has(String(mid))) crate.pages.set(String(mid), crate.pages.get(String(item.id)));
			}
		}
	}
}

const itemTitle = (item) =>
	kindOf(item) === 'macro' || (kindOf(item) === 'proc_macro' && item.inner.proc_macro.kind === 'bang') ? `${item.name}!` : item.name;

// A module page's items, by kind (structs, then enums, ...) and name: the order of the page.
function groupsOf(mod) {
	const groups = new Map();
	for (const item of mod.items) {
		const group = kindTitle[kindOf(item)];
		if (!groups.has(group)) groups.set(group, []);
		groups.get(group).push(item);
	}
	const sorted = [...groups.entries()].sort(
		(a, b) => kindOrder.findIndex((k) => kindTitle[k] === a[0]) - kindOrder.findIndex((k) => kindTitle[k] === b[0]),
	);
	for (const [, items] of sorted) items.sort((a, b) => a.name.localeCompare(b.name));
	return sorted;
}

// Each item's heading id, as the site will make it: a repeated slug (the struct Computed and the
// function computed) gets -1, -2, ... in page order.
function anchorsOf(mod) {
	const used = new Map();
	const take = (text) => {
		const base = slug(text);
		const count = used.get(base) ?? 0;
		used.set(base, count + 1);
		return count ? `${base}-${count}` : base;
	};
	const anchors = new Map();
	for (const [group, items] of groupsOf(mod)) {
		take(group);
		for (const item of items) anchors.set(item, take(itemTitle(item)));
	}
	return anchors;
}

function pageSlug(crate, moduleKey) {
	const parts = [crate.slug, ...moduleKey.split('::').filter(Boolean)].filter(Boolean);
	return parts.length ? parts.join('/') : 'crate';
}

function moduleTitle(crate, key) {
	return key ? `${crate.name.replace(/_/g, '-') === 'elegance' ? 'elegance' : crate.title}::${key}` : crate.title;
}

function render(crate, key, mod, order) {
	const printer = makePrinter(crate);
	const title = moduleTitle(crate, key);
	const summary = mod.module ? summaryOf(mod.module.docs) : '';
	const out = [
		'---',
		`title: ${JSON.stringify(title)}`,
		`description: ${JSON.stringify(summary || `The ${title} module.`)}`,
		'editUrl: false',
		'sidebar:',
		`  order: ${order}`,
		`  label: ${JSON.stringify(key ? key.replace(/::/g, '::') : crate.title)}`,
		'---',
		'',
		`<!-- Generated by scripts/gen-rust-reference.mjs from elegance-rs (rustdoc JSON). Edit the crate's doc comments, not this page. -->`,
		'',
		'```rust',
		`use ${crate.name}::${key ? key + '::' : ''}*;`,
		'```',
		'',
	];
	if (mod.module?.docs) {
		out.push(docsToMarkdown(crate, mod.module, printer, 1), '');
	}
	const sortedGroups = groupsOf(mod);
	const anchors = anchorsOf(mod);

	// Topics: everything on the page at a glance.
	if (mod.items.length > 1) {
		out.push('<div class="elg-topics">', '');
		for (const [group, items] of sortedGroups) {
			out.push(`**${group}**`, '', '| | |', '| --- | --- |');
			for (const item of items) {
				out.push(`| [\`${itemTitle(item)}\`](#${anchors.get(item)}) | ${escapeCell(summaryOf(item.docs))} |`);
			}
			out.push('');
		}
		out.push('</div>', '');
	}
	for (const [group, items] of sortedGroups) {
		out.push(`## ${group}`, '');
		for (const item of items) out.push(renderItem(crate, item, printer), '');
	}
	return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const loaded = crates.filter(load);
if (!loaded.length) {
	fs.writeFileSync(
		path.join(outDir, 'index.md'),
		[
			'---',
			'title: Rust API',
			'description: The elegance-rs crates.',
			'editUrl: false',
			'sidebar:',
			'  order: 0',
			'  label: Overview',
			'---',
			'',
			"The Rust reference wasn't generated for this build: it needs rustdoc's JSON output for the",
			'elegance-rs crates. Run `npm run rust-json` (needs a nightly toolchain), or set',
			'`RUST_DOC_JSON_DIR` to a folder holding `elegance.json`.',
			'',
		].join('\n'),
	);
	console.warn(`gen-rust-reference: no rustdoc JSON in ${jsonDir}; wrote a placeholder`);
} else {
	for (const crate of loaded) plan(crate);
	const index = [
		'---',
		'title: Rust API',
		'description: Every public item of the elegance-rs crates, generated from their documentation.',
		'editUrl: false',
		'sidebar:',
		'  order: 0',
		'  label: Overview',
		'---',
		'',
		'These pages are generated from the doc comments of the',
		'[elegance-rs](https://github.com/EleganceUI/elegance-rs) crates, so they match the code. Most',
		'apps only need `use elegance::prelude::*;`, which brings in everything for writing views.',
		'',
	];
	let order = 1;
	for (const crate of loaded) {
		index.push(`## ${crate.title}`, '', '| Module | Contents |', '| --- | --- |');
		const keys = [...crate.modules.keys()].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)));
		for (const key of keys) {
			const mod = crate.modules.get(key);
			if (!mod.items.length) continue;
			const page = pageSlug(crate, key);
			const file = path.join(outDir, `${page}.md`);
			fs.mkdirSync(path.dirname(file), { recursive: true });
			fs.writeFileSync(file, render(crate, key, mod, order++));
			const summary = mod.module ? summaryOf(mod.module.docs) : '';
			index.push(`| [\`${moduleTitle(crate, key)}\`](${base}/${page}/) | ${escapeCell(summary)} |`);
		}
		index.push('');
	}
	fs.writeFileSync(path.join(outDir, 'index.md'), index.join('\n'));
	console.log(`gen-rust-reference: ${loaded.map((c) => c.title).join(', ')} -> ${path.relative(process.cwd(), outDir)}`);
}
