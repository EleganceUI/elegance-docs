// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
// If a copy of the MPL was not distributed with this file, You can obtain one at
// https://mozilla.org/MPL/2.0/.

import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { eleganceDir, examplesDir, rustDir } from './scripts/paths.mjs';
import remarkLanguagePairs from './src/plugins/remark-language-pairs.mjs';
import remarkSections from './src/plugins/remark-sections.mjs';
import { languageScript } from './src/scripts/language.mjs';

// Where the site is hosted. For GitHub Pages under a repository, set DOCS_SITE to
// https://<user>.github.io and DOCS_BASE to /<repository> (the workflow in .github does).
const site = process.env.DOCS_SITE || undefined;
const base = process.env.DOCS_BASE || '/';

export default defineConfig({
	site,
	base,
	markdown: { remarkPlugins: [remarkLanguagePairs, remarkSections] },
	// The examples' sources come from the elegance-examples checkout (scripts/paths.mjs), reached
	// as @examples.
	vite: {
		resolve: { alias: { '@examples': examplesDir } },
		server: { fs: { allow: ['.', eleganceDir, examplesDir, rustDir] } },
	},
	integrations: [
		starlight({
			title: 'Elegance',
			description: 'Declarative, reactive desktop UI for C++ and Rust, drawn on the GPU.',
			logo: { light: './src/assets/logo-light.svg', dark: './src/assets/logo-dark.svg', replacesTitle: false },
			favicon: '/favicon.svg',
			customCss: [
				'@fontsource-variable/inter',
				'@fontsource-variable/jetbrains-mono',
				'./src/styles/custom.css',
				'./src/styles/reference.css',
				'./src/styles/home.css',
			],
			components: {
				Hero: './src/components/Hero.astro',
				PageTitle: './src/components/PageTitle.astro',
				Pagination: './src/components/Pagination.astro',
				Sidebar: './src/components/Sidebar.astro',
				// The header's right side, where the language switch goes.
				SocialIcons: './src/components/LanguagePicker.astro',
			},
			head: [{ tag: 'script', content: languageScript }],
			lastUpdated: false,
			// No "On this page": a page's sections are few, and its intro says what it covers.
			tableOfContents: false,
			expressiveCode: {
				themes: ['github-dark-default', 'github-light-default'],
				styleOverrides: {
					borderRadius: '0.75rem',
					borderColor: 'var(--elg-code-bg)',
					codeBackground: 'var(--elg-code-bg)',
					codeFontSize: '0.875rem',
					codeLineHeight: '1.6',
					codePaddingBlock: '1.125rem',
					codePaddingInline: '1.25rem',
					frames: {
						shadowColor: 'transparent',
						frameBoxShadowCssValue: 'none',
						editorTabBarBackground: 'var(--elg-code-bg)',
						editorTabBarBorderBottomColor: 'var(--elg-code-rule)',
						editorActiveTabBackground: 'var(--elg-code-bg)',
						editorActiveTabBorderColor: 'transparent',
						editorActiveTabIndicatorTopColor: 'transparent',
						editorActiveTabIndicatorBottomColor: 'transparent',
						editorActiveTabForeground: 'var(--sl-color-gray-3)',
						terminalTitlebarBackground: 'var(--elg-code-bg)',
						terminalTitlebarBorderBottomColor: 'var(--elg-code-rule)',
						terminalBackground: 'var(--elg-code-bg)',
					},
				},
				defaultProps: { wrap: false },
			},
			sidebar: [
				{
					label: 'Start here',
					items: [
						{ label: 'Introduction', slug: 'start/introduction' },
						{ label: 'Installation', slug: 'start/installation' },
						{ label: 'Your first app', slug: 'start/first-app' },
						{ label: 'Thinking in Elegance', slug: 'start/concepts' },
					],
				},
				{
					label: 'Essentials',
					items: [
						{ label: 'Views and modifiers', slug: 'guides/views-and-modifiers' },
						{ label: 'Layout', slug: 'guides/layout' },
						{ label: 'State and data flow', slug: 'guides/state' },
						{ label: 'Lists and dynamic content', slug: 'guides/lists' },
						{ label: 'Grids', slug: 'guides/grids' },
						{ label: 'Text, fonts, and icons', slug: 'guides/text-and-icons' },
						{ label: 'Controls', slug: 'guides/controls' },
						{ label: 'Colors and themes', slug: 'guides/themes' },
						{ label: 'Shapes and drawing', slug: 'guides/drawing' },
						{ label: 'Animation', slug: 'guides/animation' },
						{ label: 'Input, focus, and gestures', slug: 'guides/input' },
						{ label: 'Menus and popups', slug: 'guides/menus' },
						{ label: 'Windows', slug: 'guides/windows' },
					],
				},
				{
					label: 'Media and the system',
					items: [
						{ label: 'Images', slug: 'guides/images' },
						{ label: 'Audio', slug: 'guides/audio' },
						{ label: 'Video', slug: 'guides/video' },
						{ label: 'Microphone and camera', slug: 'guides/capture' },
						{ label: 'Networking', slug: 'guides/networking' },
						{ label: 'Desktop integration', slug: 'guides/desktop' },
					],
				},
				{
					label: 'Going further',
					items: [
						{ label: 'Components and modifiers', slug: 'guides/custom-views' },
						{ label: 'Custom layouts', slug: 'guides/custom-layouts' },
						{ label: 'Control styles', slug: 'guides/styles' },
						{ label: 'The environment', slug: 'guides/environment' },
						{ label: 'Accessibility', slug: 'guides/accessibility' },
						{ label: 'Hot reload and previews', slug: 'guides/hot-reload' },
						{ label: 'Debugging and errors', slug: 'guides/debugging' },
					],
				},
				{ label: 'Examples', slug: 'examples' },
				{
					label: 'API reference',
					collapsed: true,
					items: [
						{ label: 'Overview', slug: 'reference' },
						{ label: 'C++', collapsed: true, items: [{ autogenerate: { directory: 'reference/cpp' } }] },
						{ label: 'Rust', collapsed: true, items: [{ autogenerate: { directory: 'reference/rust' } }] },
					],
				},
			],
		}),
	],
});
