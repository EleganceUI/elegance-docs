// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
// If a copy of the MPL was not distributed with this file, You can obtain one at
// https://mozilla.org/MPL/2.0/.

// Compiles the Rust samples in the guides against elegance-rs, so they don't drift from the API.
//
//   npm run check-rust                 # generate the crate and run cargo check
//   node scripts/check-rust-samples.mjs --generate   # only generate it (to check elsewhere)
//
// Every ```rust block in src/content/docs (except the generated reference) becomes one file of a
// scratch crate in .rust-check/, which depends on elegance-rs (ELEGANCE_RS_DIR; see paths.mjs):
//
// - A block with `fn main` is a whole program and is checked as it is.
// - Any other block goes in a function body, so it can mix items (#[component] fn, struct) and
//   statements. A block that's only DSL (`HStack { ... }` with no `elg!`), such as a list of
//   alternatives, is wrapped in `elg! { VStack { ... } }`; set-up lines go before it.
// - Lines starting with "# " are set-up the sample needs but readers don't (variables it uses),
//   as in rustdoc; the site leaves them out (src/plugins/remark-language-pairs.mjs).
// - ```rust ignore blocks, and fragments that start with a modifier (`.padding(8)`), are skipped.
//
// Errors are reported against the page and line they came from.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { rustDir } from './paths.mjs';

const root = path.resolve(import.meta.dirname, '..');
const docsDir = path.join(root, 'src/content/docs');
const outDir = path.join(root, '.rust-check');
const generateOnly = process.argv.includes('--generate');

const pages = fs
	.readdirSync(docsDir, { recursive: true })
	.map((f) => f.replace(/\\/g, '/'))
	.filter((f) => /\.mdx?$/.test(f) && !f.startsWith('reference/'));

const samples = [];
for (const page of pages) {
	const lines = fs.readFileSync(path.join(docsDir, page), 'utf8').split('\n');
	for (let i = 0; i < lines.length; i++) {
		const open = lines[i].match(/^(\s*)```rust(.*)$/);
		if (!open) continue;
		const indent = open[1].length;
		const meta = open[2];
		const start = i + 1;
		let end = start;
		while (end < lines.length && !/^\s*```\s*$/.test(lines[end])) end++;
		const body = lines.slice(start, end).map((l) => l.slice(Math.min(indent, l.length - l.trimStart().length)));
		i = end;
		if (/\bignore\b/.test(meta) || /title="Cargo/.test(meta)) continue;
		samples.push({ page, line: start + 1, body });
	}
}

// What kind of sample: a program, DSL to wrap in elg!, code for a function body, or a fragment.
function shape(body) {
	const code = body.filter((l) => l.trim() && !/^\s*\/\//.test(l) && !/^\s*#( |$)/.test(l));
	if (!code.length || code[0].trim().startsWith('.')) return 'skip';
	const text = code.join('\n');
	if (/\bfn main\s*\(/.test(text)) return 'program';
	if (!/elg!/.test(text) && /^[A-Z]\w*\s*[({]/.test(code[0].trim()) && !/^[A-Z]\w*::/.test(code[0].trim())) return 'dsl';
	return 'body';
}

fs.rmSync(path.join(outDir, 'src'), { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'src'), { recursive: true });
fs.writeFileSync(
	path.join(outDir, 'Cargo.toml'),
	`[package]
name = "rust-samples"
version = "0.0.0"
edition = "2024"
publish = false

[dependencies]
elegance = { path = ${JSON.stringify(path.join(process.env.RUST_CHECK_ELEGANCE_RS ?? rustDir, 'elegance'))} }

[workspace]
`,
);

const HEADER = '#![allow(unused, non_snake_case, dead_code, unreachable_code, clippy::all)]\nuse elegance::prelude::*;\n';
const map = new Map(); // file -> { page, line, offset }
const mods = [];
let skipped = 0;
samples.forEach((sample, n) => {
	const kind = shape(sample.body);
	if (kind === 'skip') {
		skipped++;
		return;
	}
	const name = `s${String(n).padStart(3, '0')}`;
	// Hidden lines lose their "# " so they compile.
	const code = sample.body.map((l) => l.replace(/^(\s*)#( |$)/, '$1'));
	let before;
	let after;
	if (kind === 'program') {
		before = HEADER;
		after = '';
	} else if (kind === 'dsl') {
		const setup = code.filter((_, i) => /^\s*#( |$)/.test(sample.body[i]));
		const dsl = code.map((l, i) => (/^\s*#( |$)/.test(sample.body[i]) ? '' : l));
		code.splice(0, code.length, ...dsl);
		before = `${HEADER}fn __sample() {\n${setup.join('\n')}\nlet _ = elg! { VStack {\n`;
		after = '\n} };\n}\n';
	} else {
		before = `${HEADER}fn __sample() {\nlet _ = {\n`;
		after = '\n};\n}\n';
	}
	fs.writeFileSync(path.join(outDir, 'src', `${name}.rs`), before + code.join('\n') + after);
	map.set(`${name}.rs`, { ...sample, offset: before.split('\n').length - 1 });
	mods.push(`#[path = "${name}.rs"] mod ${name};`);
});
fs.writeFileSync(path.join(outDir, 'src', 'main.rs'), `${mods.join('\n')}\nfn main() {}\n`);
console.log(`check-rust-samples: ${mods.length} samples (${skipped} fragments skipped) -> ${path.relative(process.cwd(), outDir)}`);

// Turns "src/s012.rs:14:5: error: ..." into "guides/state.mdx:88: error: ...".
export function translate(output) {
	return output.replace(/(?:\/work\/|[^\s]*\.rust-check\/)?src\/(s\d+\.rs):(\d+):(\d+)/g, (match, file, line) => {
		const sample = map.get(file);
		if (!sample) return match;
		return `${sample.page}:${sample.line + Number(line) - 1 - sample.offset}`;
	});
}

if (generateOnly) {
	fs.writeFileSync(path.join(outDir, 'map.json'), JSON.stringify(Object.fromEntries(map)));
} else {
	const result = spawnSync('cargo', ['check', '--quiet', '--message-format=short'], { cwd: outDir, encoding: 'utf8' });
	const output = translate(`${result.stdout}${result.stderr}`);
	const errors = output.split('\n').filter((l) => /\berror\b/.test(l));
	console.log(errors.join('\n') || output);
	console.log(result.status === 0 ? 'check-rust-samples: all samples compile' : `check-rust-samples: ${errors.length} errors`);
	process.exit(result.status ?? 1);
}
