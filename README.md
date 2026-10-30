# Elegance documentation

The documentation site for [Elegance](https://github.com/EleganceUI/elegance), built with
[Astro Starlight](https://starlight.astro.build). Guides live in `src/content/docs/`. Both API
references are generated on every build:

- **C++**: from Elegance's public headers (`include/elg/`), by `scripts/gen-reference.mjs`.
- **Rust**: from rustdoc's JSON for the [elegance-rs](https://github.com/EleganceUI/elegance-rs)
  crates, by `scripts/gen-rust-reference.mjs`.

The guides also show the examples' code and screenshots from
[elegance-examples](https://github.com/EleganceUI/elegance-examples).

## Building

The sources come from checkouts beside this repository (or wherever `ELEGANCE_DIR`,
`ELEGANCE_EXAMPLES_DIR` and `ELEGANCE_RS_DIR` point):

```
elegance/            headers for the C++ reference
elegance-examples/   example sources
elegance-rs/         crates for the Rust reference
elegance-docs/       this repository
```

```sh
npm ci              # once
npm run rust-json   # rustdoc JSON for the Rust reference (needs a nightly toolchain)
npm run dev         # http://localhost:4321, reloads as you edit
npm run build       # static site in dist/
```

Needs Node 22.12 or later. Without the rustdoc JSON, the Rust reference is a placeholder page;
`RUST_DOC_JSON_DIR` can point at JSON made elsewhere. To publish under a sub-path (GitHub Pages
for a repository), set `DOCS_SITE` and `DOCS_BASE`.

## Publishing

`.github/workflows/docs.yml` builds the site and publishes it with GitHub Pages: on every push to
`main`, every day (to pick up changes in the other repositories), on demand, and when another
repository sends a `repository_dispatch` of type `docs`.

Screenshots in `src/assets/examples/` are captures of the example apps; retake them when an
example's look changes.
