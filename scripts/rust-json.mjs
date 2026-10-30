// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
// If a copy of the MPL was not distributed with this file, You can obtain one at
// https://mozilla.org/MPL/2.0/.

// Runs rustdoc on the elegance-rs crates for their JSON (target/doc/<crate>.json), which
// gen-rust-reference.mjs turns into the Rust reference. Needs a nightly toolchain:
// `rustup toolchain install nightly`, or RUST_TOOLCHAIN for a specific one (CI pins a date).

import { execFileSync } from 'node:child_process';

import { rustDir } from './paths.mjs';

const toolchain = process.env.RUST_TOOLCHAIN || 'nightly';
for (const crate of ['elegance', 'elegance-macros', 'elegance-wgpu']) {
	execFileSync('cargo', [`+${toolchain}`, 'doc', '--no-deps', '-p', crate], {
		cwd: rustDir,
		stdio: 'inherit',
		env: { ...process.env, RUSTDOCFLAGS: '-Z unstable-options --output-format json' },
	});
}
