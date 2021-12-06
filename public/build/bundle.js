(function (l, r) {
	if (!l || l.getElementById("livereloadscript")) return;
	r = l.createElement("script");
	r.async = 1;
	r.src =
		"//" +
		(self.location.host || "localhost").split(":")[0] +
		":35729/livereload.js?snipver=1";
	r.id = "livereloadscript";
	l.getElementsByTagName("head")[0].appendChild(r);
})(self.document);
var app = (function () {
	"use strict";

	function noop() {}
	function add_location(element, file, line, column, char) {
		element.__svelte_meta = {
			loc: { file, line, column, char },
		};
	}
	function run(fn) {
		return fn();
	}
	function blank_object() {
		return Object.create(null);
	}
	function run_all(fns) {
		fns.forEach(run);
	}
	function is_function(thing) {
		return typeof thing === "function";
	}
	function safe_not_equal(a, b) {
		return a != a
			? b == b
			: a !== b || (a && typeof a === "object") || typeof a === "function";
	}
	function is_empty(obj) {
		return Object.keys(obj).length === 0;
	}
	function append(target, node) {
		target.appendChild(node);
	}
	function insert(target, node, anchor) {
		target.insertBefore(node, anchor || null);
	}
	function detach(node) {
		node.parentNode.removeChild(node);
	}
	function element(name) {
		return document.createElement(name);
	}
	function text(data) {
		return document.createTextNode(data);
	}
	function space() {
		return text(" ");
	}
	function listen(node, event, handler, options) {
		node.addEventListener(event, handler, options);
		return () => node.removeEventListener(event, handler, options);
	}
	function attr(node, attribute, value) {
		if (value == null) node.removeAttribute(attribute);
		else if (node.getAttribute(attribute) !== value)
			node.setAttribute(attribute, value);
	}
	function children(element) {
		return Array.from(element.childNodes);
	}
	function custom_event(type, detail, bubbles = false) {
		const e = document.createEvent("CustomEvent");
		e.initCustomEvent(type, bubbles, false, detail);
		return e;
	}

	let current_component;
	function set_current_component(component) {
		current_component = component;
	}
	function get_current_component() {
		if (!current_component)
			throw new Error("Function called outside component initialization");
		return current_component;
	}
	function onMount(fn) {
		get_current_component().$$.on_mount.push(fn);
	}

	const dirty_components = [];
	const binding_callbacks = [];
	const render_callbacks = [];
	const flush_callbacks = [];
	const resolved_promise = Promise.resolve();
	let update_scheduled = false;
	function schedule_update() {
		if (!update_scheduled) {
			update_scheduled = true;
			resolved_promise.then(flush);
		}
	}
	function add_render_callback(fn) {
		render_callbacks.push(fn);
	}
	let flushing = false;
	const seen_callbacks = new Set();
	function flush() {
		if (flushing) return;
		flushing = true;
		do {
			// first, call beforeUpdate functions
			// and update components
			for (let i = 0; i < dirty_components.length; i += 1) {
				const component = dirty_components[i];
				set_current_component(component);
				update(component.$$);
			}
			set_current_component(null);
			dirty_components.length = 0;
			while (binding_callbacks.length) binding_callbacks.pop()();
			// then, once components are updated, call
			// afterUpdate functions. This may cause
			// subsequent updates...
			for (let i = 0; i < render_callbacks.length; i += 1) {
				const callback = render_callbacks[i];
				if (!seen_callbacks.has(callback)) {
					// ...so guard against infinite loops
					seen_callbacks.add(callback);
					callback();
				}
			}
			render_callbacks.length = 0;
		} while (dirty_components.length);
		while (flush_callbacks.length) {
			flush_callbacks.pop()();
		}
		update_scheduled = false;
		flushing = false;
		seen_callbacks.clear();
	}
	function update($$) {
		if ($$.fragment !== null) {
			$$.update();
			run_all($$.before_update);
			const dirty = $$.dirty;
			$$.dirty = [-1];
			$$.fragment && $$.fragment.p($$.ctx, dirty);
			$$.after_update.forEach(add_render_callback);
		}
	}
	const outroing = new Set();
	let outros;
	function transition_in(block, local) {
		if (block && block.i) {
			outroing.delete(block);
			block.i(local);
		}
	}
	function transition_out(block, local, detach, callback) {
		if (block && block.o) {
			if (outroing.has(block)) return;
			outroing.add(block);
			outros.c.push(() => {
				outroing.delete(block);
				if (callback) {
					if (detach) block.d(1);
					callback();
				}
			});
			block.o(local);
		}
	}
	function create_component(block) {
		block && block.c();
	}
	function mount_component(component, target, anchor, customElement) {
		const { fragment, on_mount, on_destroy, after_update } = component.$$;
		fragment && fragment.m(target, anchor);
		if (!customElement) {
			// onMount happens before the initial afterUpdate
			add_render_callback(() => {
				const new_on_destroy = on_mount.map(run).filter(is_function);
				if (on_destroy) {
					on_destroy.push(...new_on_destroy);
				} else {
					// Edge case - component was destroyed immediately,
					// most likely as a result of a binding initialising
					run_all(new_on_destroy);
				}
				component.$$.on_mount = [];
			});
		}
		after_update.forEach(add_render_callback);
	}
	function destroy_component(component, detaching) {
		const $$ = component.$$;
		if ($$.fragment !== null) {
			run_all($$.on_destroy);
			$$.fragment && $$.fragment.d(detaching);
			// TODO null out other refs, including component.$$ (but need to
			// preserve final state?)
			$$.on_destroy = $$.fragment = null;
			$$.ctx = [];
		}
	}
	function make_dirty(component, i) {
		if (component.$$.dirty[0] === -1) {
			dirty_components.push(component);
			schedule_update();
			component.$$.dirty.fill(0);
		}
		component.$$.dirty[(i / 31) | 0] |= 1 << i % 31;
	}
	function init(
		component,
		options,
		instance,
		create_fragment,
		not_equal,
		props,
		append_styles,
		dirty = [-1]
	) {
		const parent_component = current_component;
		set_current_component(component);
		const $$ = (component.$$ = {
			fragment: null,
			ctx: null,
			// state
			props,
			update: noop,
			not_equal,
			bound: blank_object(),
			// lifecycle
			on_mount: [],
			on_destroy: [],
			on_disconnect: [],
			before_update: [],
			after_update: [],
			context: new Map(
				options.context || (parent_component ? parent_component.$$.context : [])
			),
			// everything else
			callbacks: blank_object(),
			dirty,
			skip_bound: false,
			root: options.target || parent_component.$$.root,
		});
		append_styles && append_styles($$.root);
		let ready = false;
		$$.ctx = instance
			? instance(component, options.props || {}, (i, ret, ...rest) => {
					const value = rest.length ? rest[0] : ret;
					if ($$.ctx && not_equal($$.ctx[i], ($$.ctx[i] = value))) {
						if (!$$.skip_bound && $$.bound[i]) $$.bound[i](value);
						if (ready) make_dirty(component, i);
					}
					return ret;
			  })
			: [];
		$$.update();
		ready = true;
		run_all($$.before_update);
		// `false` as a special case of no DOM component
		$$.fragment = create_fragment ? create_fragment($$.ctx) : false;
		if (options.target) {
			if (options.hydrate) {
				const nodes = children(options.target);
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				$$.fragment && $$.fragment.l(nodes);
				nodes.forEach(detach);
			} else {
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				$$.fragment && $$.fragment.c();
			}
			if (options.intro) transition_in(component.$$.fragment);
			mount_component(
				component,
				options.target,
				options.anchor,
				options.customElement
			);
			flush();
		}
		set_current_component(parent_component);
	}
	/**
	 * Base class for Svelte components. Used when dev=false.
	 */
	class SvelteComponent {
		$destroy() {
			destroy_component(this, 1);
			this.$destroy = noop;
		}
		$on(type, callback) {
			const callbacks =
				this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
			callbacks.push(callback);
			return () => {
				const index = callbacks.indexOf(callback);
				if (index !== -1) callbacks.splice(index, 1);
			};
		}
		$set($$props) {
			if (this.$$set && !is_empty($$props)) {
				this.$$.skip_bound = true;
				this.$$set($$props);
				this.$$.skip_bound = false;
			}
		}
	}

	function dispatch_dev(type, detail) {
		document.dispatchEvent(
			custom_event(type, Object.assign({ version: "3.44.2" }, detail), true)
		);
	}
	function append_dev(target, node) {
		dispatch_dev("SvelteDOMInsert", { target, node });
		append(target, node);
	}
	function insert_dev(target, node, anchor) {
		dispatch_dev("SvelteDOMInsert", { target, node, anchor });
		insert(target, node, anchor);
	}
	function detach_dev(node) {
		dispatch_dev("SvelteDOMRemove", { node });
		detach(node);
	}
	function listen_dev(
		node,
		event,
		handler,
		options,
		has_prevent_default,
		has_stop_propagation
	) {
		const modifiers =
			options === true
				? ["capture"]
				: options
				? Array.from(Object.keys(options))
				: [];
		if (has_prevent_default) modifiers.push("preventDefault");
		if (has_stop_propagation) modifiers.push("stopPropagation");
		dispatch_dev("SvelteDOMAddEventListener", {
			node,
			event,
			handler,
			modifiers,
		});
		const dispose = listen(node, event, handler, options);
		return () => {
			dispatch_dev("SvelteDOMRemoveEventListener", {
				node,
				event,
				handler,
				modifiers,
			});
			dispose();
		};
	}
	function attr_dev(node, attribute, value) {
		attr(node, attribute, value);
		if (value == null)
			dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
		else dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
	}
	function set_data_dev(text, data) {
		data = "" + data;
		if (text.wholeText === data) return;
		dispatch_dev("SvelteDOMSetData", { node: text, data });
		text.data = data;
	}
	function validate_slots(name, slot, keys) {
		for (const slot_key of Object.keys(slot)) {
			if (!~keys.indexOf(slot_key)) {
				console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
			}
		}
	}
	/**
	 * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
	 */
	class SvelteComponentDev extends SvelteComponent {
		constructor(options) {
			if (!options || (!options.target && !options.$$inline)) {
				throw new Error("'target' is a required option");
			}
			super();
		}
		$destroy() {
			super.$destroy();
			this.$destroy = () => {
				console.warn("Component was already destroyed"); // eslint-disable-line no-console
			};
		}
		$capture_state() {}
		$inject_state() {}
	}

	/* src/Link.svelte generated by Svelte v3.44.2 */

	const file$1 = "src/Link.svelte";

	function create_fragment$1(ctx) {
		let a;
		let t;
		let mounted;
		let dispose;

		const block = {
			c: function create() {
				a = element("a");
				t = text(/*name*/ ctx[3]);
				attr_dev(a, "href", /*href*/ ctx[2]);
				attr_dev(a, "target", "_blank");
				attr_dev(a, "class", "svelte-1mxvsxr");
				add_location(a, file$1, 7, 0, 138);
			},
			l: function claim(nodes) {
				throw new Error(
					"options.hydrate only works if the component was compiled with the `hydratable: true` option"
				);
			},
			m: function mount(target, anchor) {
				insert_dev(target, a, anchor);
				append_dev(a, t);

				if (!mounted) {
					dispose = [
						listen_dev(
							a,
							"mouseenter",
							function () {
								if (is_function(/*onHover*/ ctx[0].bind(this, /*name*/ ctx[3])))
									/*onHover*/ ctx[0]
										.bind(this, /*name*/ ctx[3])
										.apply(this, arguments);
							},
							false,
							false,
							false
						),
						listen_dev(
							a,
							"mouseleave",
							function () {
								if (
									is_function(/*onUnhover*/ ctx[1].bind(this, /*name*/ ctx[3]))
								)
									/*onUnhover*/ ctx[1]
										.bind(this, /*name*/ ctx[3])
										.apply(this, arguments);
							},
							false,
							false,
							false
						),
					];

					mounted = true;
				}
			},
			p: function update(new_ctx, [dirty]) {
				ctx = new_ctx;
				if (dirty & /*name*/ 8) set_data_dev(t, /*name*/ ctx[3]);

				if (dirty & /*href*/ 4) {
					attr_dev(a, "href", /*href*/ ctx[2]);
				}
			},
			i: noop,
			o: noop,
			d: function destroy(detaching) {
				if (detaching) detach_dev(a);
				mounted = false;
				run_all(dispose);
			},
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment$1.name,
			type: "component",
			source: "",
			ctx,
		});

		return block;
	}

	function instance$1($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots("Link", slots, []);

		let { onHover = () => {} } = $$props;

		let { onUnhover = () => {} } = $$props;

		let { href = "#" } = $$props;
		let { name = "link" } = $$props;
		const writable_props = ["onHover", "onUnhover", "href", "name"];

		Object.keys($$props).forEach((key) => {
			if (
				!~writable_props.indexOf(key) &&
				key.slice(0, 2) !== "$$" &&
				key !== "slot"
			)
				console.warn(`<Link> was created with unknown prop '${key}'`);
		});

		$$self.$$set = ($$props) => {
			if ("onHover" in $$props) $$invalidate(0, (onHover = $$props.onHover));
			if ("onUnhover" in $$props)
				$$invalidate(1, (onUnhover = $$props.onUnhover));
			if ("href" in $$props) $$invalidate(2, (href = $$props.href));
			if ("name" in $$props) $$invalidate(3, (name = $$props.name));
		};

		$$self.$capture_state = () => ({ onHover, onUnhover, href, name });

		$$self.$inject_state = ($$props) => {
			if ("onHover" in $$props) $$invalidate(0, (onHover = $$props.onHover));
			if ("onUnhover" in $$props)
				$$invalidate(1, (onUnhover = $$props.onUnhover));
			if ("href" in $$props) $$invalidate(2, (href = $$props.href));
			if ("name" in $$props) $$invalidate(3, (name = $$props.name));
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [onHover, onUnhover, href, name];
	}

	class Link extends SvelteComponentDev {
		constructor(options) {
			super(options);

			init(this, options, instance$1, create_fragment$1, safe_not_equal, {
				onHover: 0,
				onUnhover: 1,
				href: 2,
				name: 3,
			});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "Link",
				options,
				id: create_fragment$1.name,
			});
		}

		get onHover() {
			throw new Error(
				"<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
			);
		}

		set onHover(value) {
			throw new Error(
				"<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
			);
		}

		get onUnhover() {
			throw new Error(
				"<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
			);
		}

		set onUnhover(value) {
			throw new Error(
				"<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
			);
		}

		get href() {
			throw new Error(
				"<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
			);
		}

		set href(value) {
			throw new Error(
				"<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
			);
		}

		get name() {
			throw new Error(
				"<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
			);
		}

		set name(value) {
			throw new Error(
				"<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
			);
		}
	}

	/* src/App.svelte generated by Svelte v3.44.2 */
	const file = "src/App.svelte";

	function create_fragment(ctx) {
		let main;
		let section;
		let span;
		let header;
		let div0;
		let b;
		let t1;
		let div1;
		let t3;
		let div2;
		let t4_value = /*time*/ ctx[0].toLocaleString() + "";
		let t4;
		let t5;
		let aside;
		let p;
		let t7;
		let nav;
		let ul;
		let li0;
		let link0;
		let t8;
		let li1;
		let link1;
		let t9;
		let li2;
		let link2;
		let current;

		link0 = new Link({
			props: {
				name: "github",
				onHover: /*applySwatch*/ ctx[2],
				onUnhover: /*removeSwatch*/ ctx[3],
				href: "https://github.com/supernintendo",
			},
			$$inline: true,
		});

		link1 = new Link({
			props: {
				name: "soundcloud",
				onHover: /*applySwatch*/ ctx[2],
				onUnhover: /*removeSwatch*/ ctx[3],
				href: "https://soundcloud.com/boymoder",
			},
			$$inline: true,
		});

		link2 = new Link({
			props: {
				name: "contact",
				onHover: /*applySwatch*/ ctx[2],
				onUnhover: /*removeSwatch*/ ctx[3],
				href: "mailto:may@matyi.net",
			},
			$$inline: true,
		});

		const block = {
			c: function create() {
				main = element("main");
				section = element("section");
				span = element("span");
				header = element("header");
				div0 = element("div");
				b = element("b");
				b.textContent = "may matyi";
				t1 = space();
				div1 = element("div");
				div1.textContent = "daydrinker";
				t3 = space();
				div2 = element("div");
				t4 = text(t4_value);
				t5 = space();
				aside = element("aside");
				p = element("p");
				p.textContent =
					"i wish i could do whatever i liked behind the curtain of “madness”.\n          then i’d arrange flowers, all day long, i’d paint; pain, love and tenderness,\n          i would laugh as much as i feel like at the stupidity of others, and they would\n          all say: “poor thing, she’s crazy!” i would build my world which while i lived,\n          would be in agreement with all the worlds. the day, or the hour, or the minute\n          that i lived would be mine and everyone else’s - my madness would not be an\n          escape from “reality”. ― Frida Kahlo";
				t7 = space();
				nav = element("nav");
				ul = element("ul");
				li0 = element("li");
				create_component(link0.$$.fragment);
				t8 = space();
				li1 = element("li");
				create_component(link1.$$.fragment);
				t9 = space();
				li2 = element("li");
				create_component(link2.$$.fragment);
				attr_dev(b, "class", "svelte-5em32k");
				add_location(b, file, 41, 32, 1042);
				attr_dev(div0, "class", "align-left svelte-5em32k");
				add_location(div0, file, 41, 8, 1018);
				attr_dev(div1, "class", "svelte-5em32k");
				add_location(div1, file, 42, 8, 1073);
				attr_dev(div2, "class", "align-right svelte-5em32k");
				add_location(div2, file, 43, 8, 1103);
				attr_dev(header, "class", "svelte-5em32k");
				add_location(header, file, 40, 6, 1001);
				attr_dev(p, "class", "svelte-5em32k");
				add_location(p, file, 46, 8, 1196);
				attr_dev(aside, "class", "svelte-5em32k");
				add_location(aside, file, 45, 6, 1180);
				attr_dev(li0, "class", "svelte-5em32k");
				add_location(li0, file, 58, 10, 1831);
				attr_dev(li1, "class", "svelte-5em32k");
				add_location(li1, file, 59, 10, 1960);
				attr_dev(li2, "class", "svelte-5em32k");
				add_location(li2, file, 60, 10, 2092);
				attr_dev(ul, "class", "svelte-5em32k");
				add_location(ul, file, 57, 8, 1816);
				attr_dev(nav, "class", "svelte-5em32k");
				add_location(nav, file, 56, 6, 1802);
				attr_dev(span, "class", "lemonada svelte-5em32k");
				add_location(span, file, 39, 4, 971);
				attr_dev(section, "class", "svelte-5em32k");
				add_location(section, file, 38, 2, 957);
				attr_dev(main, "style", /*mainStyle*/ ctx[1]);
				attr_dev(main, "class", "svelte-5em32k");
				add_location(main, file, 37, 0, 930);
			},
			l: function claim(nodes) {
				throw new Error(
					"options.hydrate only works if the component was compiled with the `hydratable: true` option"
				);
			},
			m: function mount(target, anchor) {
				insert_dev(target, main, anchor);
				append_dev(main, section);
				append_dev(section, span);
				append_dev(span, header);
				append_dev(header, div0);
				append_dev(div0, b);
				append_dev(header, t1);
				append_dev(header, div1);
				append_dev(header, t3);
				append_dev(header, div2);
				append_dev(div2, t4);
				append_dev(span, t5);
				append_dev(span, aside);
				append_dev(aside, p);
				append_dev(span, t7);
				append_dev(span, nav);
				append_dev(nav, ul);
				append_dev(ul, li0);
				mount_component(link0, li0, null);
				append_dev(ul, t8);
				append_dev(ul, li1);
				mount_component(link1, li1, null);
				append_dev(ul, t9);
				append_dev(ul, li2);
				mount_component(link2, li2, null);
				current = true;
			},
			p: function update(ctx, [dirty]) {
				if (
					(!current || dirty & /*time*/ 1) &&
					t4_value !== (t4_value = /*time*/ ctx[0].toLocaleString() + "")
				)
					set_data_dev(t4, t4_value);

				if (!current || dirty & /*mainStyle*/ 2) {
					attr_dev(main, "style", /*mainStyle*/ ctx[1]);
				}
			},
			i: function intro(local) {
				if (current) return;
				transition_in(link0.$$.fragment, local);
				transition_in(link1.$$.fragment, local);
				transition_in(link2.$$.fragment, local);
				current = true;
			},
			o: function outro(local) {
				transition_out(link0.$$.fragment, local);
				transition_out(link1.$$.fragment, local);
				transition_out(link2.$$.fragment, local);
				current = false;
			},
			d: function destroy(detaching) {
				if (detaching) detach_dev(main);
				destroy_component(link0);
				destroy_component(link1);
				destroy_component(link2);
			},
		};

		dispatch_dev("SvelteRegisterBlock", {
			block,
			id: create_fragment.name,
			type: "component",
			source: "",
			ctx,
		});

		return block;
	}

	function instance($$self, $$props, $$invalidate) {
		let { $$slots: slots = {}, $$scope } = $$props;
		validate_slots("App", slots, []);

		const colors = {
			default: { day: "#ffe2db", night: "#d9a7c6" },
			contact: { day: "#daddee", night: "#a6adc3" },
			soundcloud: { day: "#eac4ae", night: "#dda2a3" },
			github: { day: "#dee7ec", night: "#b8b3b0" },
		};

		let time = new Date();
		let swatch = colors.default;
		let mainStyle = `--theme-day: ${swatch.day}; --theme-night: ${swatch.night}`;

		function applySwatch(link) {
			setSwatch(colors[link] || colors.default);
		}

		function removeSwatch(_link) {
			setSwatch(colors.default);
		}

		function setSwatch(newSwatch) {
			swatch = newSwatch;
			$$invalidate(
				1,
				(mainStyle = `--theme-day: ${swatch.day}; --theme-night: ${swatch.night}`)
			);
		}

		onMount(() => {
			// Update clock every second
			const interval = setInterval(() => {
				$$invalidate(0, (time = new Date()));
			}, 1000);

			return () => {
				clearInterval(interval);
			};
		});

		const writable_props = [];

		Object.keys($$props).forEach((key) => {
			if (
				!~writable_props.indexOf(key) &&
				key.slice(0, 2) !== "$$" &&
				key !== "slot"
			)
				console.warn(`<App> was created with unknown prop '${key}'`);
		});

		$$self.$capture_state = () => ({
			onMount,
			Link,
			colors,
			time,
			swatch,
			mainStyle,
			applySwatch,
			removeSwatch,
			setSwatch,
		});

		$$self.$inject_state = ($$props) => {
			if ("time" in $$props) $$invalidate(0, (time = $$props.time));
			if ("swatch" in $$props) swatch = $$props.swatch;
			if ("mainStyle" in $$props)
				$$invalidate(1, (mainStyle = $$props.mainStyle));
		};

		if ($$props && "$$inject" in $$props) {
			$$self.$inject_state($$props.$$inject);
		}

		return [time, mainStyle, applySwatch, removeSwatch];
	}

	class App extends SvelteComponentDev {
		constructor(options) {
			super(options);
			init(this, options, instance, create_fragment, safe_not_equal, {});

			dispatch_dev("SvelteRegisterComponent", {
				component: this,
				tagName: "App",
				options,
				id: create_fragment.name,
			});
		}
	}

	new Date().toLocaleString();
	const app = new App({
		target: document.body,
		props: {},
	});

	return app;
})();
//# sourceMappingURL=bundle.js.map
