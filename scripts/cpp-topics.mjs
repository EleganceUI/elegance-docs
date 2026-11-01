// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
// If a copy of the MPL was not distributed with this file, You can obtain one at
// https://mozilla.org/MPL/2.0/.

// Which guide lists each part of the C++ API, and under what heading: the guide's Topics, and its
// place in the sidebar (scripts/gen-reference.mjs). Each guide's groups are in the order they
// appear; each group names what's in it with selectors, the most specific winning:
//   "view.h:View::padding"   one declaration (a View member by its qualified name)
//   "view.h:View#Layout"     a section of View's members
//   "desktop.h#File dialogs" a section of a header
//   "audio.h"                whatever in the header nothing more specific took
// Anything no guide takes is listed under its header (or View) instead.

const view = (...names) => names.map((name) => `view.h:View::${name}`);
const styles = (...names) => names.map((name) => `styles.h:${name}`);

export default {
	'guides/views-and-modifiers': [
		['Views', ['view.h:View', 'view.h:View#Creating a view', 'views.h:EmptyView']],
		['Applying modifiers', ['view.h:View#Applying modifiers']],
		['Effects', ['view.h:View#Effects', 'view.h:Shadow', 'view.h:BackdropOptions', 'view.h:BlendMode']],
		['Values that change', ['prop.h']],
		['Appearing and disappearing', ['view.h:View#Lifecycle']],
	],
	'guides/layout': [
		['Stacks', ['views.h:VStack', 'views.h:HStack', 'views.h:ZStack', 'views.h:VStackOptions', 'views.h:HStackOptions', 'views.h:ZStackOptions']],
		['Spacers and separators', ['views.h:Spacer', 'views.h:Separator', 'views.h:SeparatorOptions']],
		[
			'Size and position',
			[
				'view.h:View#Layout',
				...view('on_size_change'),
				'view.h:FrameOptions',
				'view.h:FlexibleFrameOptions',
				'view.h:OptionalLength',
				'view.h:infinity',
				'view.h:ContentMode',
				'view.h:EdgeInsets',
				'view.h:Edges',
				'view.h:operator|',
				'view.h:contains',
			],
		],
		['Backgrounds and overlays', ['view.h:View#Decoration']],
		['Alignment', ['view.h:Alignment', 'view.h:Alignment constants', 'view.h:HorizontalAlignment', 'view.h:VerticalAlignment', 'view.h:Axis']],
		['Geometry', ['view.h:ProposedSize', 'geometry.h']],
	],
	'guides/state': [
		['State and bindings', ['reactive.h:State', 'reactive.h:Binding', 'reactive.h:binding', 'reactive.h:constant']],
		['Derived values', ['reactive.h:Signal', 'reactive.h:Computed', 'reactive.h:computed']],
		['Effects and batching', ['reactive.h']],
	],
	'guides/lists': [
		['Conditional and repeated views', ['views.h:If', 'views.h:ForEach', 'view.h:ItemKey']],
		['Scrolling', ['views.h:ScrollView', 'views.h:ScrollViewOptions', 'views.h:ScrollAxes', 'views.h:ScrollPosition']],
		['Long lists', ['views.h:LazyVStack', 'views.h:LazyHStack', 'views.h:LazyVStackOptions', 'views.h:LazyHStackOptions', 'views.h:StackSeparators']],
		['Selection', ['view.h:View#Selection', 'view.h:SelectionOptions']],
	],
	'guides/grids': [
		['Grids', ['grid.h:VGrid', 'grid.h:HGrid', 'grid.h:VGridOptions', 'grid.h:HGridOptions', 'grid.h:GridItem', 'grid.h:GridTrack']],
		['Tables', ['grid.h:Grid', 'grid.h:GridRow', 'grid.h:GridOptions', 'grid.h:GridRowOptions', 'view.h:View#Grids']],
	],
	'guides/text-and-icons': [
		['Text', ['text.h:Text', 'text.h:TextAlignment']],
		['Styled text', ['text.h']],
		['Fonts', [...view('font', 'font_weight'), 'font.h']],
		['Icons', ['image.h:Label', 'image.h#Icon sets']],
	],
	'guides/controls': [
		['Buttons', ['views.h:Button']],
		['Text entry', ['views.h:TextField', 'views.h:TextFieldOptions', 'views.h:TextArea', 'views.h:TextAreaOptions']],
		['Choices', ['views.h:Toggle', 'views.h:Checkbox', 'views.h:CheckboxOptions', 'views.h:Picker']],
		['Numbers', ['views.h:Slider', 'views.h:SliderOptions', 'views.h:NumberInput', 'views.h:NumberInputOptions', 'views.h:Progress']],
		['Turning controls off', view('disabled')],
	],
	'guides/themes': [
		['Colors', ['color.h']],
		['Themes', [...view('theme', 'tint', 'foreground_style', 'color_scheme'), 'theme.h']],
	],
	'guides/drawing': [
		['Shapes', ['shapes.h']],
		['Fills and gradients', ['gradient.h']],
		['Paths', ['path.h']],
		['Canvas', ['views.h:Canvas', 'graphics_context.h']],
	],
	'guides/animation': [
		['Animating changes', ['animation.h:Animation', 'animation.h:with_animation', ...view('animation', 'animates_layout')]],
		['Transitions', ['animation.h:Transition', ...view('transition')]],
		['Timers', ['timer.h']],
	],
	'guides/input': [
		['Clicks', [...view('on_click', 'on_double_click', 'on_activate'), 'events.h:ClickEvent', 'events.h:ClickOptions', 'events.h:MouseButton']],
		['Gestures', [...view('recognize', 'on_drag', 'on_long_press', 'on_magnify', 'on_rotate', 'on_two_finger_double_tap'), 'gestures.h']],
		[
			'Hover and the pointer',
			[...view('on_pointer_enter', 'on_pointer_leave', 'on_hover_change', 'pointer_style', 'hover_delay'), 'events.h:PointerStyle', 'events.h:HoverDelay'],
		],
		['Where a view can be clicked', view('content_shape', 'allows_hit_testing')],
		[
			'Keyboard and focus',
			['view.h:View#Keyboard and focus', 'events.h:Key', 'events.h:KeyModifiers', 'events.h:KeyEvent', 'events.h:TextInputEvent', 'events.h:operator|', 'events.h:has', 'events.h:primary_modifier'],
		],
		['Dropping files and text', [...view('on_drop'), 'view.h:DropOptions']],
		['Raw events', [...view('on_pointer', 'on_scroll'), 'events.h']],
	],
	'guides/menus': [
		['Menus', ['views.h:Menu', 'views.h:MenuItem', 'views.h:MenuItemOptions', 'views.h:Submenu', 'views.h:MenuButton', 'views.h:MenuButtonOptions', ...view('context_menu')]],
		[
			'Popovers and floating content',
			[
				...view('popover', 'floating', 'floating_container'),
				'view.h:PopoverOptions',
				'view.h:FloatingOptions',
				'view.h:FloatingEdge',
				'view.h:FloatingAlignment',
				'view.h:FloatingPlacement',
				'view.h:FloatingBoundary',
				'view.h:FloatingDismiss',
				'view.h:PopupMotion',
			],
		],
		['Tooltips', [...view('tooltip'), 'view.h:TooltipOptions']],
	],
	'guides/windows': [
		['The app and its windows', ['app.h:App', 'app.h:WindowDesc', 'app.h:TitleBar', 'app.h:WindowMaterial', 'app.h:ContentFunction', 'app.h:version']],
		['Inside a window', [...view('window_drag_area'), 'window.h']],
		['Navigation', [...view('navigation_stack_style'), 'navigation.h']],
		['The platform', ['platform.h']],
	],
	'guides/images': [
		['Images', ['image.h:Image', 'image.h:ImageSource']],
		['Images from the web', ['image.h#AsyncImage']],
	],
	'guides/audio': [
		['Sounds', ['audio.h:Sound', 'audio.h:PlayOptions', 'audio.h:AudioPlayer']],
		['Streams', ['audio.h:AudioStream', 'audio.h:AudioStreamOptions']],
		['Output devices', ['audio.h']],
	],
	'guides/video': [
		['Playing video', ['video.h:VideoPlayer', 'video.h:VideoView', 'video.h:VideoControls']],
		['Frames from your app', ['video.h']],
	],
	'guides/capture': [
		['Microphone', ['capture.h#Microphone']],
		['Camera', ['capture.h#Camera']],
	],
	'guides/networking': [['Threads', ['app.h:post_to_ui_thread']]],
	'guides/desktop': [
		['File dialogs', ['desktop.h#File dialogs']],
		['Notifications', ['desktop.h#Notifications']],
		['Dock and taskbar', ['desktop.h#Dock and taskbar']],
		['Tray icon', ['desktop.h#Tray icon']],
		['Menu bar', ['app.h#Menu bar']],
	],
	'guides/custom-views': [
		['Modifier protocols', ['modifier.h']],
		['Built-in modifiers', ['modifiers/layout.h', 'modifiers/decoration.h', 'modifiers/effects.h', 'modifiers/events.h', 'modifiers/environment.h']],
	],
	'guides/custom-layouts': [
		['Layouts', ['layout.h:Layout', 'layout.h:CachedLayout', 'layout.h:LayoutCache', ...view('layout_value')]],
		['Stack layouts', ['layout.h']],
		['Grid layouts', ['grid.h']],
	],
	'guides/styles': [
		['Buttons', [...view('button_style'), ...styles('ButtonStyle', 'ButtonConfiguration', 'ProminentButtonStyle', 'BorderedButtonStyle', 'PlainButtonStyle')]],
		['Toggles', [...view('toggle_style'), ...styles('ToggleStyle', 'ToggleConfiguration', 'SwitchToggleStyle', 'SwitchToggleStyleOptions')]],
		['Check boxes', [...view('checkbox_style'), ...styles('CheckboxStyle', 'CheckboxConfiguration', 'BoxCheckboxStyle', 'BoxCheckboxStyleOptions')]],
		['Text fields', [...view('text_field_style'), ...styles('TextFieldStyle', 'TextFieldConfiguration', 'RoundedBorderTextFieldStyle', 'PlainTextFieldStyle')]],
		[
			'Number inputs',
			[...view('number_input_style'), ...styles('NumberInputStyle', 'NumberInputConfiguration', 'BoxNumberInputStyle', 'BoxNumberInputStyleOptions', 'PlainNumberInputStyle')],
		],
		['Sliders', [...view('slider_style'), ...styles('SliderStyle', 'SliderConfiguration', 'KnobSliderStyle', 'KnobSliderStyleOptions')]],
		['Pickers', [...view('picker_style'), ...styles('PickerStyle', 'PickerConfiguration', 'SegmentedPickerStyle', 'MenuPickerStyle')]],
		[
			'Progress indicators',
			[...view('progress_style'), ...styles('ProgressStyle', 'ProgressConfiguration', 'LinearProgressStyle', 'LinearProgressStyleOptions', 'CircularProgressStyle', 'CircularProgressStyleOptions')],
		],
		['Rows', [...view('row_style'), ...styles('RowStyle', 'RowConfiguration', 'HighlightRowStyle', 'HighlightRowStyleOptions', 'PlainRowStyle')]],
		['Menus', [...view('menu_style'), ...styles('MenuStyle', 'MenuConfiguration', 'MenuItemConfiguration', 'DefaultMenuStyle', 'PlainMenuStyle')]],
		['Popovers', [...view('popover_style'), ...styles('PopoverStyle', 'PopoverConfiguration', 'DefaultPopoverStyle', 'PlainPopoverStyle')]],
		['Tooltips', [...view('tooltip_style'), ...styles('TooltipStyle', 'TooltipConfiguration', 'DefaultTooltipStyle', 'PlainTooltipStyle')]],
	],
	'guides/environment': [
		['Reading and setting values', ['environment.h:EnvironmentValues', 'environment.h:Environment', 'environment.h:resolved_in', ...view('environment')]],
		['Built-in keys', ['environment.h']],
	],
	'guides/accessibility': [['Describing views', ['view.h:View#Accessibility', 'view.h:AccessibilityRole']]],
	'guides/hot-reload': [
		['In a views module', ['hot_reload.h#In a views module']],
		['In the host', ['hot_reload.h#In the host']],
	],
	'guides/debugging': [['Errors', ['error.h']]],
};
