// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
// If a copy of the MPL was not distributed with this file, You can obtain one at
// https://mozilla.org/MPL/2.0/.

// Generates the C++ API reference (src/content/docs/reference/cpp/) from the public headers in
// include/elg/. Each declaration gets a page: its comment, the first sentence as its summary, and
// the declaration itself; View's members get one each too. Each header gets a page listing what it
// declares. Implementation details are left out: `detail` namespaces, private and protected
// members, the bodies of function templates, and internal macros.
//
// scripts/cpp-topics.mjs says which guide lists each declaration; the site shows it under that
// guide (src/generated/cpp-api.json). Run by `npm run dev` and `npm run build`; the output isn't
// checked in.

import fs from 'node:fs';
import path from 'node:path';

import { eleganceDir, root } from './paths.mjs';
import topics from './cpp-topics.mjs';

const includeDir = path.join(eleganceDir, 'include/elg');
const outDir = path.join(root, 'src/content/docs/reference/cpp');
const generatedDir = path.join(root, 'src/generated');

// One line per header for the index, in reading order.
const headers = [
	['elegance.h', 'The umbrella header: includes everything below.'],
	['app.h', 'App, windows, and the event loop.'],
	['window.h', 'The window a view is in; custom title bars and window controls.'],
	['view.h', 'View, the modifier methods, and the layout value types.'],
	['views.h', 'Stacks, controls, If, ForEach, scroll views, lists, and menus.'],
	['text.h', 'Text.'],
	['font.h', 'Fonts, weights, text styles, and custom fonts.'],
	['color.h', 'Color.'],
	['theme.h', 'Themes and semantic colors.'],
	['reactive.h', 'State, Binding, Computed, effects, and batching.'],
	['prop.h', 'Reactive arguments.'],
	['environment.h', 'Environment values and keys.'],
	['layout.h', 'The layout protocol, cached layouts, and the stack layouts.'],
	['grid.h', 'Grids: VGrid and HGrid tracks, and Grid tables of GridRows.'],
	['modifier.h', 'The modifier protocols, for custom modifiers.'],
	['modifiers/layout.h', 'Built-in layout modifiers.'],
	['modifiers/decoration.h', 'Built-in decoration modifiers.'],
	['modifiers/effects.h', 'Built-in effect modifiers.'],
	['modifiers/environment.h', 'Built-in environment modifiers.'],
	['modifiers/events.h', 'Built-in event modifiers.'],
	['shapes.h', 'Shapes: rectangles, circles, capsules, paths, and custom shapes.'],
	['path.h', 'Vector paths and stroke styles.'],
	['gradient.h', 'Linear and radial gradients, and ShapeStyle.'],
	['graphics_context.h', 'Immediate-mode drawing in a Canvas.'],
	['geometry.h', 'Point, Size, Rect, and corner radii.'],
	['styles.h', 'Button, toggle, and text field styles.'],
	['animation.h', 'Animations and transitions.'],
	['events.h', 'Pointer, keyboard, and text input events; custom event handlers.'],
	['gestures.h', 'Drags, long presses, and trackpad gestures.'],
	['navigation.h', 'Split views, sidebars, and navigation stacks.'],
	['timer.h', 'Timers: actions after a delay or at an interval.'],
	['platform.h', 'The platform the app runs on.'],
	['image.h', 'Images, icons, icon sets, and AsyncImage.'],
	['audio.h', 'Sound effects and audio playback.'],
	['video.h', 'Video playback.'],
	['capture.h', 'Recording from the microphone and the camera.'],
	['desktop.h', 'File dialogs, notifications, and the tray icon.'],
	['hot_reload.h', 'Hot reload and previews.'],
	['error.h', 'The exceptions Elegance throws.'],
];

const slugOf = (header) => header.replace(/\.h$/, '').replace(/\//g, '-');

// --- Small C++ scanning helpers ---

// The line without its // comment and string or character literals (for counting braces).
function codeOnly(line) {
	let out = '';
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (c === '/' && line[i + 1] === '/') break;
		if (c === '"' || c === "'") {
			// R"x(...)x" raw strings don't occur in the public headers.
			const quote = c;
			i++;
			while (i < line.length && line[i] !== quote) {
				if (line[i] === '\\') i++;
				i++;
			}
			continue;
		}
		out += c;
	}
	return out;
}

const braceDelta = (line) => {
	const code = codeOnly(line);
	return (code.match(/\{/g) || []).length - (code.match(/\}/g) || []).length;
};

const isComment = (line) => line.trim().startsWith('//');

// --- Cleaning a header ---

function clean(text) {
	let lines = text.replace(/\r\n/g, '\n').split('\n');

	// The license header, include guard, includes, and pragmas.
	while (lines.length && lines[0].startsWith('//')) lines.shift();
	lines = lines.filter(
		(l) =>
			!/^#(ifndef|define) ELG_\w+_H\s*$/.test(l) &&
			!/^#endif \/\/ ELG_\w+_H/.test(l) &&
			!/^#include /.test(l) &&
			!/^#pragma /.test(l),
	);

	const out = [];
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		// Blocks that are implementation: `namespace detail { ... }`.
		if (/^namespace detail \{/.test(trimmed)) {
			let depth = braceDelta(line);
			while (depth > 0 && ++i < lines.length) depth += braceDelta(lines[i]);
			continue;
		}
		// Platform and compiler conditionals (export macros, warning pragmas).
		if (/^#if(def)? (_MSC_VER|defined\(_WIN32\)|ELG_VIEW_EXTENSIONS)/.test(trimmed)) {
			let nesting = 1;
			while (nesting > 0 && ++i < lines.length) {
				if (/^#if/.test(lines[i].trim())) nesting++;
				if (/^#endif/.test(lines[i].trim())) nesting--;
			}
			continue;
		}
		// Macros: public ones by their first line only; internal ones (ending in _ or
		// CONCAT/EXPORT) not at all.
		if (/^#define /.test(trimmed)) {
			const name = trimmed.match(/^#define (\w+)/)[1];
			const internal = /_$|CONCAT|EXPORT/.test(name);
			let first = line.replace(/\s*\\$/, '');
			while (lines[i].trimEnd().endsWith('\\') && i + 1 < lines.length) i++;
			if (!internal) out.push(first.replace(/^(#define \w+(\([^)]*\))?).*$/, '$1'));
			continue;
		}
		// Namespace lines themselves (the content stays).
		if (/^namespace elg(::\w+)? \{$/.test(trimmed) || /^\} \/\/ namespace elg/.test(trimmed)) continue;
		if (/ELG_PRIVATE_MEMBERS_(BEGIN|END)/.test(trimmed)) continue;
		if (/^static_assert\(/.test(trimmed)) {
			while (!lines[i].trimEnd().endsWith(';') && i + 1 < lines.length) i++;
			continue;
		}
		out.push(line.replace(/\bELG_API /g, ''));
	}
	return stripPrivate(out);
}

// Removes private and protected sections and friend declarations from class bodies.
function stripPrivate(lines) {
	const out = [];
	let depth = 0;
	let skipping = -1; // the depth whose private section is being skipped
	for (const line of lines) {
		const trimmed = line.trim();
		if (skipping >= 0) {
			if (depth === skipping && trimmed === 'public:') {
				skipping = -1;
				out.push(line);
			} else if (depth + braceDelta(line) < skipping) {
				skipping = -1;
				out.push(line); // the class's closing brace
			}
			depth += braceDelta(line);
			continue;
		}
		if (depth > 0 && (trimmed === 'private:' || trimmed === 'protected:')) {
			skipping = depth;
			// Drop comments that introduced the section.
			while (out.length && isComment(out[out.length - 1])) out.pop();
			continue;
		}
		if (/^friend (struct|class) /.test(trimmed) && trimmed.endsWith(';')) continue;
		out.push(line);
		depth += braceDelta(line);
	}
	// Empty `public:` right before a closing brace, and blank lines before closing braces.
	return out.filter((line, i) => !(line.trim() === '' && out[i + 1] && /^\s*\};?/.test(out[i + 1])));
}

// --- Splitting into documented items ---

// Blocks separated by blank lines at namespace level.
function blocks(lines) {
	const result = [];
	let current = [];
	let depth = 0;
	for (const line of lines) {
		if (line.trim() === '' && depth === 0) {
			if (current.length) result.push(current);
			current = [];
			continue;
		}
		current.push(line);
		depth += braceDelta(line);
	}
	if (current.length) result.push(current);
	return result;
}

// Declarations without function bodies, at any depth: a class keeps its fields, types and
// comments, and each function (a member's too) ends at its signature, without a constructor's
// initializer list. Leaves alone requires-expressions, braced initializers and default arguments.
function withoutBodies(code) {
	const text = code.join('\n');
	let out = '';
	let statement = ''; // the current declaration's code so far, comments and strings left out
	let start = 0; // where it starts in `out`
	let parens = 0;
	const restart = () => {
		statement = '';
		start = out.length;
	};
	// Whether a `{` here opens a function's body.
	const opensBody = () => {
		const s = statement.replace(/^\s*template\s*<[^{};]*?>(?=\s*(class|struct|union|requires|[\w:~]))/, '').replace(/operator\s*[^\s(]+/g, 'operator');
		if (/^\s*(class|struct|union|enum|namespace)\b/.test(s) || !/\)/.test(s)) return false;
		if (/\brequires\s*\([^()]*(\([^()]*\)[^()]*)*\)\s*$/.test(s)) return false; // requires(...) { ... }
		let top = s; // without what's in parentheses
		while (top !== (top = top.replace(/\([^()]*\)/g, '')));
		return !/(^|[^=!<>])=(?!=)/.test(top); // = {...}, = [] {...}
	};
	// A member's braced initializer in a constructor's initializer list: `: a(v), b{2} {`.
	const initializesMember = () => !/^\s*(template\s*<[^]*?>\s*)?(class|struct|union|enum)\b/.test(statement) && /\)[^]*?(?<!:):(?!:)[^]*[\w>]\s*$/.test(statement);
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		// Comments, strings and preprocessor lines go through untouched.
		let skip = null;
		if (text.startsWith('//', i)) skip = text.indexOf('\n', i);
		else if (text.startsWith('/*', i)) skip = text.indexOf('*/', i) + 1;
		else if (c === '#' && /(^|\n)\s*$/.test(out)) {
			skip = i;
			while ((skip = text.indexOf('\n', skip + 1)) >= 0 && text[skip - 1] === '\\');
		}
		else if (c === '"' || c === "'") {
			let j = i + 1;
			while (j < text.length && text[j] !== c) j += text[j] === '\\' ? 2 : 1;
			statement += text.slice(i, j + 1);
			skip = j;
		}
		if (skip !== null) {
			const end = skip < 0 ? text.length - 1 : c === '/' && text[i + 1] === '/' || c === '#' ? skip - 1 : skip;
			out += text.slice(i, end + 1);
			i = end;
			if (statement.trim() === '') restart(); // a declaration starts after its comment
			continue;
		}
		if (c === '(') parens++;
		if (c === ')') parens--;
		if (c === '{' && parens === 0 && initializesMember()) {
			let depth = 0;
			let j = i;
			for (; j < text.length; j++) if (text[j] === '{') depth++; else if (text[j] === '}' && --depth === 0) break;
			out += text.slice(i, j + 1);
			statement += text.slice(i, j + 1);
			i = j;
			continue;
		}
		if (c === '{' && parens === 0 && opensBody()) {
			// Skip the body.
			let depth = 0;
			let j = i;
			for (; j < text.length; j++) {
				if (text.startsWith('//', j)) j = text.indexOf('\n', j);
				else if (text.startsWith('/*', j)) j = text.indexOf('*/', j) + 1;
				else if (text[j] === '"' || text[j] === "'") { const q = text[j]; j++; while (text[j] !== q) j += text[j] === '\\' ? 2 : 1; }
				else if (text[j] === '{') depth++;
				else if (text[j] === '}' && --depth === 0) break;
			}
			// And a constructor's initializer list: the first lone `:` after its parameters.
			let signature = out.slice(start);
			const close = signature.search(/\)/);
			const colon = signature.slice(close).search(/(?<!:):(?!:)/);
			if (close >= 0 && colon >= 0) signature = signature.slice(0, close + colon);
			out = out.slice(0, start) + signature.replace(/\s+$/, '') + ';';
			i = j;
			restart();
			continue;
		}
		out += c;
		if (c === ';' || c === '{' || c === '}') restart();
		else if (/\b(public|private|protected)\s*:$/.test(statement + c) && parens === 0) { statement = ''; start = out.length; }
		else statement += c;
	}
	return out.split('\n');
}

function headingOf(code) {
	for (const raw of code) {
		const line = raw.trim();
		if (line === '' || line.startsWith('template') || line.startsWith('requires')) continue;
		let m;
		if ((m = line.match(/^#define (\w+)/))) return m[1];
		if ((m = line.match(/^(?:enum class|enum|class|struct)\s+(\w+)/))) return m[1];
		if ((m = line.match(/^using (\w+) =/))) return m[1];
		if ((m = line.match(/^inline (?:constexpr |const )+\w+ (\w+)::\w+/))) return `${m[1]} constants`;
		const paren = line.indexOf('(');
		const equals = line.indexOf('=');
		if (equals >= 0 && (paren < 0 || equals < paren)) {
			if ((m = line.slice(0, equals).match(/(\w+)\s*$/))) return m[1];
		}
		if ((m = line.replace(/^decltype\(auto\)\s*/, '').match(/(operator\S+?|~?\w+)\s*\(/))) return m[1];
		return line.replace(/[;{].*$/, '').trim();
	}
	return null;
}

// What a declaration is, for the label above its name.
function kindOf(code) {
	for (const raw of code) {
		const line = raw.trim();
		if (line === '' || line.startsWith('template') || line.startsWith('requires') || line.startsWith('[[')) continue;
		if (line.startsWith('#define')) return 'macro';
		if (/^enum\b/.test(line)) return 'enum';
		if (/^class\b/.test(line)) return 'class';
		if (/^struct\b/.test(line)) return 'struct';
		if (/^concept\b/.test(line)) return 'concept';
		if (/^using \w+ =/.test(line)) return 'type';
		if (/^(inline )?(constexpr|const)\b[^(]*=/.test(line)) return 'constant';
		if (line.includes('(')) return 'function';
		return 'declaration';
	}
	return 'declaration';
}

// --- Markdown ---

// Pointers into design.md (the design document in the repository) mean nothing on the web.
const withoutDesignRefs = (text) =>
	text
		.replace(/\s*\((?:see )?(?:design\.md )?§[\d.]+(?:, rule \d+)?\)/g, '') // "(design.md §8)", "(§13.2)"
		.replace(/,?\s*(?:see )?design\.md §[\d.]+(?:, rule \d+)?/g, ''); // "..., design.md §9.5)"
const escapeProse = (text) =>
	withoutDesignRefs(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A comment block as Markdown: paragraphs, lists, and indented lines as C++ examples.
function commentToMarkdown(comments) {
	const out = [];
	let paragraph = [];
	let code = [];
	const flushParagraph = () => {
		if (paragraph.length) out.push(escapeProse(paragraph.join(' ')), '');
		paragraph = [];
	};
	const flushCode = () => {
		if (code.length) {
			const indent = Math.min(...code.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
			out.push('```cpp', ...code.map((l) => l.slice(indent)), '```', '');
		}
		code = [];
	};
	for (const raw of comments) {
		const text = raw.trim().replace(/^\/\/ ?/, '');
		if (/^ {2,}\S/.test(text)) {
			flushParagraph();
			code.push(text);
		} else if (text.trim() === '') {
			flushParagraph();
			flushCode();
		} else if (/^(\s*)- /.test(text)) {
			flushParagraph();
			flushCode();
			paragraph.push(text.trim());
			flushParagraph();
			out.pop(); // list items stay together
		} else {
			flushCode();
			paragraph.push(text.trim());
		}
	}
	flushParagraph();
	flushCode();
	return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// --- Symbols ---

// The kind of a symbol, as its page names it.
const KIND_NAMES = {
	class: 'Class',
	struct: 'Structure',
	enum: 'Enumeration',
	function: 'Function',
	concept: 'Concept',
	type: 'Type Alias',
	constant: 'Constant',
	macro: 'Macro',
	declaration: 'Declaration',
};

// Classes whose members get pages of their own: View's modifier methods are most of the API.
const EXPLODED = new Set(['view.h:View']);

// A forward declaration (`class Animation;`, `enum class Weight : int;`) or a preprocessor line
// documents nothing itself.
function isForwardDeclaration(code) {
	const lines = code.filter((l) => l.trim() && !/^\s*template\b/.test(l));
	return lines.length > 0 && lines.every((l) => /^((class|struct)\s+\w+;|enum( class)? \w+( : [\w:]+)?;|#undef\b)/.test(l.trim()));
}

// A section's name from its `// --- Name (where) ---` marker.
const sectionName = (text) =>
	({ 'The one entry point for modifiers': 'Applying modifiers' })[
		(text = text.replace(/\s*\(.*?\)/g, '').replace(/[:;].*$/, '').replace(/\.$/, '').trim())
	] ?? text;

// A name as a URL segment, unique in its folder.
const segmentOf = (name) =>
	name
		.replace(/\|/g, '-bar')
		.replace(/&/g, '-amp')
		.replace(/==/g, '-eq')
		.replace(/!/g, '-not')
		.replace(/</g, '-lt')
		.replace(/>/g, '-gt')
		.replace(/~/g, 'destroy-')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

// The first sentence of a comment, as plain text.
function firstSentence(comments) {
	const text = comments
		.map((l) => l.replace(/^\s*\/\/\/?\s?/, ''))
		.filter((l) => !/^ {2,}\S/.test(l)) // examples
		.join(' ')
		.replace(/\s+/g, ' ')
		.trim();
	// A sentence ends where the next starts with a capital, so "e.g. a style's" doesn't end one.
	const sentence = text.match(/^(.+?[.!?])(?=\s+[A-Z`"(]|$)/);
	return withoutDesignRefs(sentence ? sentence[1] : text);
}

const dedent = (lines) => {
	const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
	return lines.map((l) => l.slice(indent));
};

// Lines at one level (a header's, or a class body's) as items: the comment above some code and
// the code, in the section a `// --- Name ---` marker started. A comment with no code under it
// before a blank line is a note about what follows, not an item's.
function itemsOf(lines, section) {
	const items = [];
	let comments = [];
	let code = [];
	let depth = 0;
	const flush = () => {
		if (code.length) items.push({ section, comments, code });
		comments = [];
		code = [];
	};
	for (const line of lines) {
		const trimmed = line.trim();
		if (depth > 0) {
			code.push(line);
			depth += braceDelta(line);
			continue;
		}
		if (trimmed === 'public:') continue;
		if (trimmed === '') {
			flush();
			continue;
		}
		const marker = trimmed.match(/^\/\/ --- (.+?) ---$/);
		if (marker) {
			flush();
			section = sectionName(marker[1]);
			continue;
		}
		if (isComment(line)) {
			if (code.length) flush();
			comments.push(line);
			continue;
		}
		code.push(line);
		depth += braceDelta(line);
	}
	flush();
	return items;
}

// An item's code as separate declarations: each ends at a `;` outside braces (a macro, at its
// line).
function declarationsOf(code) {
	const declarations = [];
	let current = [];
	let depth = 0;
	for (const line of code) {
		current.push(line);
		depth += braceDelta(line);
		if (depth === 0 && (/;\s*(\/\/.*)?$/.test(line.trim()) || /^#/.test(line.trim()))) {
			declarations.push(current);
			current = [];
		}
	}
	if (current.length) declarations.push(current);
	return declarations;
}

// Items as named entries: overloads, and declarations that repeat a name, share one. An item's
// comment goes with its first declaration.
function collect(items, nameOf, entries = new Map()) {
	for (const item of items) {
		declarationsOf(item.code).forEach((declaration, i) => {
			if (isForwardDeclaration(declaration)) return;
			const name = nameOf(declaration);
			if (!name) return;
			if (!entries.has(name)) entries.set(name, { name, section: item.section, comments: [], code: [] });
			const entry = entries.get(name);
			if (i === 0 && item.comments.length) {
				if (entry.comments.length) entry.comments.push('//');
				entry.comments.push(...item.comments);
			}
			if (entry.code.length) entry.code.push('');
			entry.code.push(...declaration);
		});
	}
	return entries;
}

// A class's members, each with its comment and the section it's in.
function membersOf(declaration, className) {
	const start = declaration.findIndex((l) => new RegExp(`^(class|struct) ${className}\\b`).test(l.trim()));
	const items = itemsOf(declaration.slice(start + 1, -1), 'Creating a view').map((item) => ({ ...item, code: withoutBodies(dedent(item.code)) }));
	return [...collect(items, memberName).values()];
}

function memberName(declaration) {
	for (const raw of declaration) {
		const line = raw.trim();
		if (/^(template|requires|\{|\}|&&|\|\||:|\/\/)/.test(line)) continue;
		const m = line.replace(/^decltype\(auto\)\s*/, '').match(/(operator\S+?|~?\w+)\s*\(/);
		if (m) return m[1];
	}
	return null;
}

// Everything a header declares: its introduction, its other notes, and its symbols.
function parse(header) {
	const source = fs.readFileSync(path.join(includeDir, header), 'utf8');
	const intro = [];
	const notes = [];
	const entries = new Map();
	let section = null;
	blocks(clean(source)).forEach((block, index) => {
		if (block.every(isComment)) {
			const marker = block.length === 1 && block[0].match(/^\/\/ --- (.+) ---$/);
			if (marker) section = sectionName(marker[1]);
			else (index === 0 ? intro : notes).push({ section, markdown: commentToMarkdown(block) });
			return;
		}
		const items = itemsOf(block, section).map((item) => ({ ...item, code: withoutBodies(item.code) }));
		collect(items, headingOf, entries);
	});
	const symbols = [...entries.values()].map((entry) => ({
		...entry,
		header,
		kind: /constants$/.test(entry.name) ? 'Constants' : KIND_NAMES[kindOf(entry.code)],
	}));
	return { intro, notes, symbols };
}

// --- Where each symbol is listed: its guide (scripts/cpp-topics.mjs), or else its header ---

function assign(all) {
	// Selectors, most specific first: "header:Name", "header:Class#Section", "header#Section",
	// "header".
	const matches = [
		(sel, s) => sel === `${s.header}:${s.qualified}`,
		(sel, s) => s.owner && sel === `${s.header}:${s.owner}#${s.section}`,
		(sel, s) => !s.owner && sel === `${s.header}#${s.section}`,
		(sel, s) => !s.owner && sel === s.header,
	];
	const placed = new Map(); // symbol id -> { guide, group, rank }
	for (const match of matches) {
		for (const [guide, groups] of Object.entries(topics)) {
			groups.forEach(([group, selectors]) => {
				selectors.forEach((selector, rank) => {
					for (const symbol of all) {
						if (!placed.has(symbol.id) && match(selector, symbol)) placed.set(symbol.id, { guide, group, rank });
					}
				});
			});
		}
	}
	// Selectors that matched nothing are typos.
	for (const [guide, groups] of Object.entries(topics)) {
		for (const [, selectors] of groups) {
			for (const selector of selectors) {
				if (!matches.some((match) => all.some((s) => match(selector, s)))) {
					console.warn(`gen-reference: "${selector}" (${guide}) matches nothing`);
				}
			}
		}
	}
	return placed;
}

// --- Pages ---

const BASE = (process.env.DOCS_BASE ?? '').replace(/\/$/, '');
const href = (id) => `${BASE}/${id}/`;
const html = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Prose with `code` in it, as HTML.
const inlineHtml = (text) => html(text).replace(/`([^`]+)`/g, '<code>$1</code>');

// Groups of symbols as a topics list: each group's name beside its symbols and their summaries.
function topicsHtml(groups) {
	const lines = ['<div class="elg-topic-groups not-content">'];
	for (const [title, symbols] of groups) {
		lines.push('<section class="elg-topic-group">', `<h3>${html(title)}</h3>`, '<ul>');
		for (const s of symbols) {
			const summary = s.summary ? `<p>${inlineHtml(s.summary)}</p>` : '';
			lines.push(`<li><a href="${href(s.id)}"><code>${html(s.title)}</code></a>${summary}</li>`);
		}
		lines.push('</ul>', '</section>');
	}
	lines.push('</div>');
	return lines.join('\n');
}

const tidy = (line) => {
	const comment = line.indexOf('//');
	return comment < 0 ? line : line.slice(0, comment) + withoutDesignRefs(line.slice(comment));
};

const RUST_NOTE = [
	'<div class="elg-only-rust">',
	'',
	`This page shows the C++ declaration. The Rust crates have the same API under the same names, spelled the Rust way; see the [Rust reference](${href('reference/rust')}).`,
	'',
	'</div>',
	'',
];

function frontmatter({ title, description, kind, parent }) {
	return [
		'---',
		`title: ${JSON.stringify(title)}`,
		...(description ? [`description: ${JSON.stringify(description)}`] : []),
		'editUrl: false',
		'sidebar:',
		'  hidden: true',
		'symbol:',
		`  kind: ${JSON.stringify(kind)}`,
		`  parent: ${JSON.stringify(parent)}`,
		'---',
		'',
	];
}

function symbolPage(symbol, members) {
	const out = frontmatter({ title: symbol.title, description: symbol.summary, kind: symbol.kind, parent: symbol.parent });
	out.push(`<!-- Generated by scripts/gen-reference.mjs from Elegance's include/elg/${symbol.header}. Edit the header, not this page. -->`, '');
	out.push('## Declaration', '', '```cpp');
	out.push(...(members ? [`class ${symbol.name};`] : symbol.code.map(tidy)));
	out.push('```', '');
	out.push(...RUST_NOTE);
	// The comment, after the first sentence (that's the page's summary, above).
	let overview = symbol.comments.length ? commentToMarkdown(symbol.comments) : '';
	const first = escapeProse(symbol.summary ?? '');
	if (first && overview.startsWith(first)) overview = overview.slice(first.length).trim();
	if (overview) out.push('## Overview', '', overview, '');
	if (members) {
		const groups = new Map();
		for (const member of members) {
			if (!groups.has(member.section)) groups.set(member.section, []);
			groups.get(member.section).push(member);
		}
		out.push('## Topics', '', topicsHtml([...groups]), '');
	}
	return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

function headerPage(header, description, { intro, notes, symbols }) {
	const out = [
		'---',
		`title: "<elg/${header}>"`,
		`description: ${JSON.stringify(description)}`,
		'editUrl: false',
		'---',
		'',
		`<!-- Generated by scripts/gen-reference.mjs from Elegance's include/elg/${header}. Edit the header, not this page. -->`,
		'',
		'```cpp',
		`#include <elg/${header}>`,
		'```',
		'',
	];
	for (const { markdown } of intro) out.push(markdown, '');
	for (const { section, markdown } of notes) {
		if (section) out.push(`**${escapeProse(section)}**`, '');
		out.push(markdown, '');
	}
	if (symbols.length) {
		const groups = new Map();
		for (const symbol of symbols) {
			const title = symbol.section ?? 'Declarations';
			if (!groups.has(title)) groups.set(title, []);
			groups.get(title).push(symbol);
		}
		out.push('## Topics', '', topicsHtml([...groups]), '');
	}
	return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

// --- Writing it all ---

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const parsed = new Map();
const all = [];
for (const [header] of headers) {
	if (!fs.existsSync(path.join(includeDir, header))) throw new Error(`missing header ${header}`);
	const result = parse(header);
	parsed.set(header, result);
	const folder = `reference/cpp/${slugOf(header)}`;
	const used = new Set();
	const unique = (segment, kind) => {
		let name = segment;
		if (used.has(name)) name = `${segment}-${segmentOf(kind)}`;
		used.add(name);
		return name;
	};
	for (const symbol of result.symbols) {
		const isFunction = symbol.kind === 'Function';
		symbol.qualified = symbol.name;
		symbol.title = isFunction ? `${symbol.name}()` : symbol.name;
		symbol.label = symbol.title;
		symbol.id = `${folder}/${unique(segmentOf(symbol.name), symbol.kind)}`;
		symbol.summary = symbol.comments.length ? firstSentence(symbol.comments) : '';
		all.push(symbol);
		if (!EXPLODED.has(`${header}:${symbol.name}`)) continue;
		symbol.members = membersOf(symbol.code, symbol.name);
		const memberUsed = new Set();
		for (const member of symbol.members) {
			const constructor = member.name === symbol.name;
			Object.assign(member, {
				header,
				owner: symbol.name,
				qualified: `${symbol.name}::${member.name}`,
				kind: constructor ? 'Initializer' : 'Instance Method',
				title: constructor ? `${symbol.name}()` : `${symbol.name}::${member.name}()`,
				label: `${member.name}()`,
				summary: member.comments.length ? firstSentence(member.comments) : '',
			});
			let segment = constructor ? 'init' : segmentOf(member.name);
			if (memberUsed.has(segment)) segment += '-2';
			memberUsed.add(segment);
			member.id = `${symbol.id}/${segment}`;
			member.parentSymbol = symbol;
			all.push(member);
		}
	}
}

// Each symbol's home: the guide that lists it, or else its class's page or its header's.
const placed = assign(all);
// What each page lists, by group: a guide its symbols, a header everything it declares, a class
// its members. The sidebar shows these under the page; a guide's Topics are its list.
const children = {}; // page id -> [[group, [{ symbol, rank }]]]
const addChild = (parent, group, symbol, rank = 0) => {
	children[parent] ??= [];
	let entry = children[parent].find(([title]) => title === group);
	if (!entry) children[parent].push((entry = [group, []]));
	entry[1].push({ symbol, rank });
};
for (const symbol of all) {
	const place = placed.get(symbol.id);
	const owner = symbol.parentSymbol ? symbol.parentSymbol.id : `reference/cpp/${slugOf(symbol.header)}`;
	symbol.parent = place ? place.guide : owner;
	if (place) addChild(place.guide, place.group, symbol, place.rank);
	addChild(owner, symbol.section ?? 'Declarations', symbol);
}
// A guide's groups in the order it lists them; within a group, in the order of its selectors.
const groupOrder = (guide) => (topics[guide] ?? []).map(([title]) => title);
for (const [parent, groups] of Object.entries(children)) {
	const order = groupOrder(parent);
	groups.sort(([a], [b]) => (order.indexOf(a) + 1 || Infinity) - (order.indexOf(b) + 1 || Infinity));
	for (const group of groups) group[1].sort((a, b) => a.rank - b.rank);
}

for (const symbol of all) {
	const file = path.join(root, 'src/content/docs', `${symbol.id}.md`);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, symbolPage(symbol, symbol.members));
}

const index = [
	'---',
	'title: API reference',
	'description: Every public header of Elegance, generated from the headers themselves.',
	'editUrl: false',
	'sidebar:',
	'  order: 0',
	'  label: Overview',
	'---',
	'',
	'These pages are generated from the public headers in `include/elg/`, so they always match the',
	'code. Each header has a page listing what it declares, and each declaration a page of its own',
	'with the comments written above it; private members and implementation details are left out.',
	'Include `<elg/elegance.h>` to get everything.',
	'',
	'| Header | Contents |',
	'| --- | --- |',
];
let order = 1;
for (const [header, description] of headers) {
	const page = headerPage(header, description, parsed.get(header)).replace(
		'editUrl: false\n',
		`editUrl: false\nsidebar:\n  order: ${order++}\n  label: "${header}"\n`,
	);
	fs.writeFileSync(path.join(outDir, `${slugOf(header)}.md`), page);
	index.push(`| [\`<elg/${header}>\`](./${slugOf(header)}/) | ${description} |`);
}

// What the site needs to show symbols under their guides (src/scripts/api.ts): each symbol's
// label, kind, and home, and what each page lists.
fs.mkdirSync(generatedDir, { recursive: true });
fs.writeFileSync(
	path.join(generatedDir, 'cpp-api.json'),
	JSON.stringify(
		{
			symbols: Object.fromEntries(all.map((s) => [s.id, { label: s.label, kind: s.kind, parent: s.parent }])),
			children: Object.fromEntries(
				Object.entries(children).map(([parent, groups]) => [parent, groups.map(([title, list]) => [title, list.map(({ symbol }) => symbol.id)])]),
			),
		},
		null,
		'\t',
	) + '\n',
);

// Every header should be listed above.
const listed = new Set(headers.map(([h]) => h));
// Headers apps don't include themselves: the export macros, the C interface the Rust crate binds
// to, and a polyfill.
const INTERNAL = new Set(['export.h', 'gpu_image.h', 'move_only_function.h']);
for (const entry of fs.readdirSync(includeDir, { recursive: true })) {
	const header = entry.replace(/\\/g, '/');
	if (header.endsWith('.h') && !INTERNAL.has(header) && !listed.has(header)) {
		console.warn(`gen-reference: ${header} isn't in the list; add it to scripts/gen-reference.mjs`);
	}
}
const unplaced = all.filter((s) => !placed.has(s.id));
if (unplaced.length && process.env.SHOW_UNPLACED) {
	console.warn(`gen-reference: not in any guide:\n  ${unplaced.map((s) => `${s.header}:${s.qualified} [${s.section ?? ''}]`).join('\n  ')}`);
}

fs.writeFileSync(path.join(outDir, 'index.md'), index.join('\n') + '\n');

// The page above both languages' references.
fs.writeFileSync(
	path.join(outDir, '..', 'index.mdx'),
	`---
title: API reference
description: Every type, function, and modifier in Elegance, for C++ and Rust.
editUrl: false
---

import { LinkCard, CardGrid } from '@astrojs/starlight/components';

Each page lists what a header or module declares, with the documentation written next to it in
the code. The guides explain how the pieces fit together; come here when you know what you're
looking for and want the details.

<CardGrid>
	<LinkCard title="C++" description="One page per header in include/elg/, from the comments above each declaration." href="${(process.env.DOCS_BASE ?? '').replace(/\/$/, '')}/reference/cpp/" />
	<LinkCard title="Rust" description="One page per module of the elegance crates, from their doc comments." href="${(process.env.DOCS_BASE ?? '').replace(/\/$/, '')}/reference/rust/" />
</CardGrid>

Both describe the same library: the Rust crates bind to the C++ one, so a view, modifier, or
type usually has the same name in each (\`Text\`, \`.padding()\`, \`State\`), spelled the way the
language spells things.
`,
);
console.log(`gen-reference: ${headers.length} headers, ${all.length} symbols (${placed.size} in guides) -> ${path.relative(process.cwd(), outDir)}`);
