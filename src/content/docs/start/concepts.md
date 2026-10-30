---
title: Thinking in Elegance
description: "The ideas behind the API: views as values, modifiers, fine-grained state, the environment, layout, and threads."
---

A handful of ideas explain almost everything in Elegance. Once they click, the rest of the API is
mostly vocabulary. If you know SwiftUI, much of this will feel familiar, and the differences are
pointed out.

## A view describes, it doesn't draw

A view is a lightweight description of a piece of interface. Writing `Text("Hi")` puts nothing on
screen; it's a value that says "some text reading Hi". When a view is placed in a window, Elegance
builds the real, long-lived element for it, and keeps it until the view is removed.

Because views are values, you can keep them in variables, pass them to functions, and use them
more than once:

```cpp
const View badge = Text("PRO").padding(4).background(ThemeColor::accent, Capsule());

HStack(Text("Elegance"), badge, Spacer(), badge.opacity(0.5f));
```

```rust
let badge = elg! { Text("PRO").padding(4).background_in(.accent, Capsule()) };

elg! {
    HStack {
        Text("Elegance")
        { badge.clone() }
        Spacer()
        { badge.opacity(0.5) }
    }
}
```

To make a reusable piece of interface, write a *component*:

```cpp
struct SettingRow {
    std::string title;
    std::string detail;

    View body() const {
        return HStack(Text(title), Spacer(), Text(detail).foreground_style(ThemeColor::secondary));
    }
};

VStack(SettingRow{"Plan", "Pro"}, SettingRow{"Storage", "12 GB"});
```

```rust
#[component]
fn SettingRow(title: String, detail: String) -> impl IntoView {
    elg! {
        HStack {
            Text(title)
            Spacer()
            Text(detail).foreground_style(.secondary)
        }
    }
}

elg! {
    VStack {
        SettingRow(title: "Plan", detail: "Pro")
        SettingRow(title: "Storage", detail: "12 GB")
    }
}
```

A component's body runs when it's placed in the view tree, not when you write it down, so it can
read the [environment](../../guides/environment/) of wherever it ends up. A plain function that
returns a view also works; it runs immediately, where you call it.

## Modifiers wrap views

`.padding(8)` doesn't change a view; it returns a new view with the old one inside, plus padding.
So the order of modifiers matters:

```cpp
Text("A").padding(8).background(Color::hex(0x7AA2F7)); // the background covers the padding
Text("B").background(Color::hex(0x7AA2F7)).padding(8); // the padding is outside the background
```

```rust
Text("A").padding(8).background(Color::hex(0x7AA2F7)) // the background covers the padding
Text("B").background(Color::hex(0x7AA2F7)).padding(8) // the padding is outside the background
```

Read a chain of modifiers from the inside out: each one applies to everything before it.

Every built-in modifier is made from the same parts you can use for your own: a modifier changes a
view's layout, how it's drawn, its environment, what it does with events, or what it's composed
of. See [Components and modifiers](../../guides/custom-views/).

## State updates exactly what reads it

Many UI frameworks re-run your view code when data changes and work out what's different.
Elegance doesn't. Your view code runs once. What runs again is the small closures you pass where a
value is expected:

```cpp
const State<bool> selected(false);

Text("Item")
    .foreground_style([=] { return selected() ? Color::white : Color::hex(0x1C1C1E); })
    .background([=] { return selected() ? Color::hex(0x0A84FF) : Color::clear; })
    .on_click([=] { selected = !selected(); });
```

```rust
let selected = State::new(false);

elg! {
    Text("Item")
        .foreground_style(move || if selected.get() { Color::WHITE } else { Color::hex(0x1C1C1E) })
        .background(move || if selected.get() { Color::hex(0x0A84FF) } else { Color::CLEAR })
        .on_click(move |_| selected.toggle())
}
```

Each closure is tied to one property of one element on screen. Clicking the text changes
`selected`, and exactly those two closures run again: the text keeps its size and position, and
nothing else is looked at. Changes are batched, so however many states change during a click, each
closure runs at most once before the next frame.

To change *which* views are on screen, rather than how they look, use
`If` and `ForEach` (in Rust, `if`, `match`, and `ForEach` inside `elg!`). They add and
remove views as their conditions and lists change.

## Some values flow down

Some settings apply to everything inside a view: the font, the text color, the accent color, light
or dark mode, the theme, whether controls are enabled, and how controls look. Set them once, high
up, and everything below picks them up:

```cpp
VStack(Text("Title"), Text("Body"), Button("OK", ok))
    .font(Font::callout)
    .tint(Color::hex(0x7C3AED));
```

```rust
# let ok = || {};
elg! {
    VStack {
        Text("Title")
        Text("Body")
        Button("OK", ok)
    }
    .font(.callout)
    .tint(Color::hex(0x7C3AED))
}
```

This is the *environment*, and you can add your own values to it. See
[The environment](../../guides/environment/).

## Layout is a conversation

Layout works as in SwiftUI. A parent offers its child a size; the child decides how big it
actually wants to be; then the parent places it. Text takes the room its words need and wraps when
it has to. Shapes take whatever they're offered. Stacks share their space among their children, and
`.frame` sets limits. See [Layout](../../guides/layout/).

## One thread for your code

All your code runs on the **UI thread**: building views, handling events, and callbacks from
Elegance such as file dialogs and notifications. State can only be used there. To do slow work
(loading a file, talking to a server), use another thread, and hand the result back with
`post_to_ui_thread`.

Drawing happens on a separate **render thread**, so a slow frame never holds up input, and
resizing a window stays smooth. Video and camera frames go straight to the render thread without
passing through yours.

## When something goes wrong

Using the API wrongly, such as asking for an icon that doesn't exist, is reported with a message
that says what was wrong and where:
<span class="elg-only-cpp">Elegance throws `elg::UsageError`, and a resource that fails to load throws `elg::ResourceError`. An exception from your own callbacks comes out of `app.run()` after the app shuts down cleanly.</span>
<span class="elg-only-rust">fallible calls return an `elegance::Error`, whose `kind()` tells usage mistakes from resources that failed to load. An error Elegance raises while the app runs comes back from `App::run` after the app shuts down cleanly, and a panic in a callback resumes there.</span>
See [Debugging and errors](../../guides/debugging/).
