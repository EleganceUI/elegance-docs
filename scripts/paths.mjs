// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
// If a copy of the MPL was not distributed with this file, You can obtain one at
// https://mozilla.org/MPL/2.0/.

// Where the sources the docs are built from live: checkouts of Elegance (its public headers),
// elegance-examples (the examples' code) and elegance-rs (the Rust crates), beside this
// repository unless ELEGANCE_DIR, ELEGANCE_EXAMPLES_DIR or ELEGANCE_RS_DIR say otherwise.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const checkout = (variable, name) => path.resolve(root, process.env[variable] || path.join('..', name));

export const eleganceDir = checkout('ELEGANCE_DIR', 'elegance');
export const examplesDir = checkout('ELEGANCE_EXAMPLES_DIR', 'elegance-examples');
export const rustDir = checkout('ELEGANCE_RS_DIR', 'elegance-rs');
