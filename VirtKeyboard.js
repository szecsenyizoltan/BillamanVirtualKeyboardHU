/*
 * VirtKeyboard.js — Billman Virtual Keyboard class (HU aware)
 * drag + minimize/dock + focus-follow + fixed Backspace + Alt/Ctrl/AltGr
 * Author: ChatGPT — MIT 
 * Fixed by: Szécsényi Zoltán 
 */

export class VirtKeyboard {
    /**
     * @param {Object} opts
     * @param {HTMLElement|string} opts.container
     * @param {HTMLInputElement|HTMLTextAreaElement|HTMLElement|string} [opts.target]
     * @param {boolean} [opts.useShadow=true]
     * @param {('qwertz'|'qwerty')} [opts.layout='qwertz']
     * @param {boolean} [opts.hunCompose=true]
     * @param {boolean} [opts.attachAtCursor=true]
     * @param {Function} [opts.onKey]
     * @param {boolean} [opts.draggable=true]
     * @param {boolean} [opts.minimizable=true]
     * @param {boolean} [opts.startMinimized=true]
     * @param {('bottom-right'|'bottom-left'|'top-right'|'top-left')} [opts.dockCorner='bottom-right']
     * @param {boolean} [opts.rememberPosition=true]
     * @param {string}  [opts.storageKey='virtkeyboard']
     * @param {boolean} [opts.followFocus=true]
     */
    constructor(opts = {}) {
        this.opts = Object.assign({
            useShadow: true,
            layout: 'qwertz',
            hunCompose: true,
            attachAtCursor: true,
            onKey: null,
            draggable: true,
            minimizable: true,
            startMinimized: true,
            dockCorner: 'bottom-right',
            rememberPosition: true,
            storageKey: 'virtkeyboard',
            followFocus: true
        }, opts);

        this.container = typeof opts.container === 'string' ? document.querySelector(opts.container) : opts.container;
        if (!this.container)
            throw new Error('VirtKeyboard: container not found');

        this.target = this._resolveTarget(opts.target);

        this.state = {caps: false, shift: false, hu: true, minimized: !!this.opts.startMinimized, alt: false, ctrl: false, altgr: false};

        this.layouts = this._getLayouts(this.opts.layout);
        this.huExtras = {
            'e': 'é', 'a': 'á', 'u': 'ú', 'o': 'ó', 'i': 'í',
            'E': 'É', 'A': 'Á', 'U': 'Ú', 'O': 'Ó', 'I': 'Í',
            "o:": 'ö', "u:": 'ü', "O:": 'Ö', "U:": 'Ü',
            "o'": 'ő', "u'": 'ű', "O'": 'Ő', "U'": 'Ű'
        };

        // AltGr and Shift visual/output maps (minimal HU-friendly set). Extend as needed.
        this.altgrMap = new Map(Object.entries({
            '0': '¬', '1': '~', '2': 'ˇ', '3': '^', '4': '˘', '5': '°', '6': '˛', '7': '`', '8': '˙', '9': '´', 'ö': '˝', 'ü': '¨', 'ó': '¸',
            'q': '\\', 'w': '|', 'e': 'Ä', 'u': '€', 'i': 'Í', 'ő': '÷', 'ú': '×',
            'a': 'ä', 's': 'đ', 'd': 'Đ', 'f': '[', 'g': ']', 'j': 'í', 'k': 'ł', 'l': 'Ł', 'é': '$', 'á': 'ß', 'ű': '¤',
            'í': '<', 'y': '>', 'x': '#', 'c': '&', 'v': '@', 'b': '{', 'n': '}', ',': ';', '.': '>', '-': '*',
        }));

        this.shiftMap = new Map(Object.entries({
            '0': '§', '1': '\'', '2': '"', '3': '+', '4': '!', '5': '%', '6': '/', '7': '=', '8': '(', '9': ')',
            '-': '_', '=': '+', ',': '?', '.': ':', '|': '|', 'í': 'Í',
        }));

        this.root = this.opts.useShadow ? this.container.attachShadow({mode: 'open'}) : this.container;
        this._render();
        this._restoreState();
        if (this.state.minimized)
            this._applyMinimized(true);

        if (this.opts.followFocus)
            this._bindFocusTracking();
    }

    /* -------------------- public API -------------------- */
    attachTo(target) {
        this.target = this._resolveTarget(target);
    }
    destroy() {
        if (this.opts.useShadow)
            this.container.shadowRoot.innerHTML = '';
        else
            this.container.innerHTML = '';
    }
    minimize() {
        if (!this.state.minimized)
            this._applyMinimized(true);
    }
    restore() {
        if (this.state.minimized)
            this._applyMinimized(false);
    }
    toggle() {
        this._applyMinimized(!this.state.minimized);
    }
    setPosition(x, y) {
        this._setAbsPosition(x, y, true);
    }
    setDockCorner(c) {
        this.opts.dockCorner = c;
        this._positionFab();
        this._saveState();
    }

    /* -------------------- internals -------------------- */
    _resolveTarget(t) {
        if (!t)
            return null;
        if (typeof t === 'string')
            t = document.querySelector(t);
        if (!t)
            throw new Error('VirtKeyboard: target not found');
        return t;
    }

    _isWritable(el) {
        if (!el || !(el instanceof HTMLElement))
            return false;
        if (el.isContentEditable || el.getAttribute('contenteditable') === 'true')
            return true;
        if (el.tagName === 'TEXTAREA')
            return true;
        if (el.tagName === 'INPUT') {
            const t = (el.getAttribute('type') || 'text').toLowerCase();
            return ['text', 'search', 'email', 'url', 'tel', 'password', 'number'].includes(t);
        }
        return false;
    }

    _bindFocusTracking() {
        document.addEventListener('focusin', (e) => {
            const el = e.target;
            if (this._isWritable(el))
                this.target = el;
        }, true);
        const focusKeeper = (ev) => {
            if (this.target && this._isWritable(this.target)) {
                ev.preventDefault();
                this.target.focus({preventScroll: true});
            }
        };
        this.$?.wrap?.addEventListener('mousedown', focusKeeper);
        this.$?.wrap?.addEventListener('touchstart', focusKeeper, {passive: false});
    }

    _getLayouts(kind) {
        const qwertz = [
            ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "ö", "ü", "ó", {label: "← Backspace", code: "Backspace", wide: true}],
            [{label: "Tab", code: "Tab", wide: true}, "q", "w", "e", "r", "t", "z", "u", "i", "o", "p", "ő", "ú", {label: "Del", code: "Delete"}],
            [{label: "Caps", code: "CapsLock", wide: true}, "a", "s", "d", "f", "g", "h", "j", "k", "l", "é", "á", "ű", {label: "Enter", code: "Enter", wide: true}],
            [{label: "Shift", code: "Shift", xwide: true}, "í", "y", "x", "c", "v", "b", "n", "m", {label: ",", code: ","}, {label: ".", code: "."}, {label: "-", code: "-"}, {label: "Shift", code: "Shift", xwide: true}],
            [{label: "Ctrl", code: "Control"}, {label: "Alt", code: "Alt"}, {label: "Space", code: "Space", space: true}, {label: "AltGr", code: "AltGr"}, {label: "Ctrl", code: "Control"}]
        ];
        const qwerty = JSON.parse(JSON.stringify(qwertz));
        qwerty[1] = [{label: "Tab", code: "Tab", wide: true}, "q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "ő", "ú", {label: "|", code: "Pipe"}];
        qwerty[3] = [{label: "Shift", code: "Shift", xwide: true}, "z", "x", "c", "v", "b", "n", "m", "ö", "ü", "ó", {label: ",", code: ","}, {label: ".", code: "."}, {label: "-", code: "-"}, {label: "Shift", code: "Shift", xwide: true}];
        return kind === 'qwerty' ? qwerty : qwertz;
    }

    _render() {
        const host = document.createElement('div');
        host.className = 'vk-host';

        const style = document.createElement('style');
        style.textContent = `
      :host, .vk-host{font:14px/1.4 system-ui, -apple-system, Segoe UI, Roboto}
      .vk-wrap{position:fixed; top:120px; left:120px; z-index:9999}
      .vk-card{background:#121a33;color:#eaf0ff;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:10px;box-shadow:0 10px 30px rgba(0,0,0,.35);user-select:none}
      .vk-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;cursor:move}
      .vk-title{font-weight:600;font-size:14px}
      .vk-status{display:flex;gap:10px;color:#90a0d0}
      .vk-dot{width:8px;height:8px;border-radius:50%;background:#90a0d0;display:inline-block;margin-right:4px}
      .vk-dot.on{background:#5aa9ff}
      .vk-rows{display:grid;gap:6px}
      .vk-row{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px}
      .vk-key{user-select:none;cursor:pointer;background:#1b2752;color:#eaf0ff;border:1px solid rgba(255,255,255,.08);border-radius:10px;height:42px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 0 rgba(0,0,0,.35);transition:transform .05s ease, background .15s ease}
      .vk-key:hover{background:#24336a}
      .vk-key:active{transform:translateY(1px)}
      .vk-key[data-wide]{grid-column:span 2}
      .vk-key[data-xwide]{grid-column:span 3}
      .vk-key[data-space]{grid-column:span 6}
      .vk-key[data-active]{background:#5aa9ff;color:#071022}
      .vk-key.mod{height:28px;padding:0 10px}
      .vk-key .sub{display:none;font-size:11px;opacity:.7;line-height:1;margin-top:2px}
    `;

        const wrap = document.createElement('div');
        wrap.className = 'vk-wrap';

        const card = document.createElement('div');
        card.className = 'vk-card';

        const header = document.createElement('div');
        header.className = 'vk-header';
        const headerLeft = document.createElement('div');
        headerLeft.className = 'vk-title';
        headerLeft.textContent = 'Billman Virtual Keyboard (HU)';
        const headerRight = document.createElement('div');
        headerRight.className = 'vk-status';
        headerRight.innerHTML = `
      <span class="vk-dot" id="vkCaps"></span>CAPS
      <span class="vk-dot" id="vkShift" style="margin-left:8px"></span>SHIFT
      <span class="vk-dot" id="vkHU" style="margin-left:8px"></span>HU
      <button class="vk-key mod" id="vkMinBtn" title="Minimalizálás" style="margin-left:8px">${this._keyboardIcon(18)}</button>
    `;

        header.appendChild(headerLeft);
        header.appendChild(headerRight);

        const rows = document.createElement('div');
        rows.className = 'vk-rows';
        this.layouts.forEach(row => {
            const r = document.createElement('div');
            r.className = 'vk-row';
            row.forEach(k => r.appendChild(this._makeKey(typeof k === 'string' ? {label: k} : k)));
            rows.appendChild(r);
        });

        rows.lastChild.querySelectorAll('.vk-key').forEach(btn => btn.classList.add('mod'));

        card.appendChild(header);
        card.appendChild(rows);
        wrap.appendChild(card);

        const fab = document.createElement('button');
        fab.className = 'vk-fab';
        fab.title = 'Billentyűzet megnyitása';
        fab.style.display = 'none';
        fab.innerHTML = `${this._keyboardIcon(18)}`;

        host.appendChild(wrap);
        host.appendChild(fab);

        if (this.opts.useShadow) {
            this.root.appendChild(style);
            this.root.appendChild(host);
        } else {
            this.root.appendChild(style);
            this.root.appendChild(host);
        }

        this.$ = {
            capsDot: (this.opts.useShadow ? this.root : host).querySelector('#vkCaps'),
            shiftDot: (this.opts.useShadow ? this.root : host).querySelector('#vkShift'),
            huDot: (this.opts.useShadow ? this.root : host).querySelector('#vkHU'),
            wrap, card, header, fab, minBtn: headerRight.querySelector('#vkMinBtn'),
        };

        this._syncToggles();
        this._bindDrag();
        this.$.minBtn.addEventListener('click', () => this.toggle());
        this.$.fab.addEventListener('click', () => this.restore());
        this._positionFab();

        this.root.addEventListener('mousedown', (e) => {
            if (this.target && this._isWritable(this.target)) {
                e.preventDefault();
                this.target.focus({preventScroll: true});
            }
        });

        // initial legends
        this._updateKeyFaces();
    }

    _keyboardIcon(sz = 18) {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${sz}" height="${sz}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <rect x="3" y="7" width="18" height="10" rx="2" />
    <path d="M6 10h2M9 10h2M12 10h2M15 10h2M6 13h2M9 13h2M12 13h2M15 13h2" />
    </svg>`;
    }

    _positionFab() {
        const m = 16;
        const s = this.$.fab.style;
        s.position = 'fixed';                 // <-- fix
        s.bottom = s.top = s.left = s.right = '';
        s.bottom = m + 'px';
        s.right = m + 'px';  // dockCorner='bottom-right'
    }

    _applyMinimized(min) {
        this.state.minimized = !!min;
        this.$.wrap.style.display = min ? 'none' : '';
        this.$.fab.style.display = min ? 'flex' : 'none';
        this._positionFab();
        if (!min)
            this._ensureInViewport();
        this._saveState();
    }

    _bindDrag() {
        if (!this.opts.draggable)
            return;
        let startX = 0, startY = 0, origX = 0, origY = 0, dragging = false;
        const down = (e) => {
            dragging = true;
            const ev = e.touches ? e.touches[0] : e;
            startX = ev.clientX;
            startY = ev.clientY;
            const rect = this.$.wrap.getBoundingClientRect();
            origX = rect.left;
            origY = rect.top;
            e.preventDefault();
        };
        const move = (e) => {
            if (!dragging)
                return;
            const ev = e.touches ? e.touches[0] : e;
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            this._setAbsPosition(origX + dx, origY + dy, false);
        };
        const up = () => {
            if (!dragging)
                return;
            dragging = false;
            this._saveState();
        };
        this.$.header.addEventListener('mousedown', down);
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
        this.$.header.addEventListener('touchstart', down, {passive: false});
        document.addEventListener('touchmove', move, {passive: false});
        document.addEventListener('touchend', up);
    }

    _ensureInViewport(margin = 8) {
        const rect = this.$.wrap.getBoundingClientRect();
        const vw = window.innerWidth, vh = window.innerHeight;
        let x = rect.left, y = rect.top;
        const maxX = Math.max(0, vw - rect.width - margin);
        const maxY = Math.max(0, vh - rect.height - margin);
        x = Math.min(Math.max(margin, x), maxX);
        y = Math.min(Math.max(margin, y), maxY);
        this._setAbsPosition(x, y, true);
    }

    _setAbsPosition(x, y, save) {
        const st = this.$.wrap.style;
        st.left = Math.max(0, x) + 'px';
        st.top = Math.max(0, y) + 'px';
        if (save)
            this._saveState();
    }

    _saveState() {
        if (!this.opts.rememberPosition)
            return;
        try {
            const rect = this.$.wrap.getBoundingClientRect();
            const data = {x: rect.left, y: rect.top, minimized: this.state.minimized, dockCorner: this.opts.dockCorner};
            localStorage.setItem(this.opts.storageKey, JSON.stringify(data));
        } catch (e) {
        }
    }

    _restoreState() {
        if (!this.opts.rememberPosition)
            return;
        try {
            const raw = localStorage.getItem(this.opts.storageKey);
            if (!raw)
                return;
            const data = JSON.parse(raw);

            // helyreállítjuk az állapotot
            if (typeof data.x === 'number' && typeof data.y === 'number') {
                this._setAbsPosition(data.x, data.y, false);
            }
            if (typeof data.minimized === 'boolean') {
                this.state.minimized = data.minimized;
            }
            if (data.dockCorner) {
                this.opts.dockCorner = data.dockCorner;
            }

            this._positionFab();

            // biztosan a látható területen legyen
            this._ensureInViewport();

        } catch (e) {
            console.warn('VirtKeyboard restoreState failed:', e);
        }
    }

    _makeKey(key) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'vk-key';
        if (key.wide)
            el.setAttribute('data-wide', '1');
        if (key.xwide)
            el.setAttribute('data-xwide', '1');
        if (key.space)
            el.setAttribute('data-space', '1');
        const label = key.label || '';
        el.dataset.base = label; // store base legend
        el.dataset.code = key.code || label;
        el.addEventListener('click', () => this._onKey(key));
        // label container (main + optional sub)
        const main = document.createElement('span');
        main.className = 'main';
        main.textContent = label;
        const sub = document.createElement('span');
        sub.className = 'sub';
        sub.textContent = '';
        el.appendChild(main);
        el.appendChild(sub);
        return el;
    }

    _onKey(k) {
        if (this.opts.followFocus && this.target && this._isWritable(this.target)) {
            this.target.focus({preventScroll: true});
        }

        const code = k.code || ('' + k);

        // Modifiers toggle + visual light
        const setMod = (name, val) => {
            this.state[name] = val;
            this._toggleVis(code, !!val);
            this._emitToggle(name, !!val);
            this._updateKeyFaces();
        };

        if (code === 'CapsLock')
            return setMod('caps', !this.state.caps);
        if (code === 'Shift')
            return setMod('shift', !this.state.shift);
        if (code === 'Alt')
            return setMod('alt', !this.state.alt);
        if (code === 'Control')
            return setMod('ctrl', !this.state.ctrl);
        if (code === 'AltGr')
            return setMod('altgr', !this.state.altgr);

        switch (code) {
            case 'Backspace':
                this._backspace();
                return;
            case 'Delete':
                this._delete();
                return;
            case 'Enter':
                this._insert('\n');
                return;
            case 'Tab':
                this._insert('	');
                return;
            case 'Space':
                this._insert(' ');
                return;
        }

        // Printable
        let ch = k.label || k;
        if (typeof ch !== 'string')
            return;

        // AltGr output mapping
        if (this.state.altgr) {
            const base = ch.length === 1 ? ch.toLowerCase() : ch;
            const mapped = this.altgrMap.get(base);
            if (mapped) {
                this._insert(mapped);
                this.state.altgr = false;
                this._toggleVis('AltGr', false);
                this._emitToggle('altgr', false);
                this._updateKeyFaces();
                return;
            }
        }

        const isLetter = ch.length === 1 && /[A-Za-záéíóöőúüű]/i.test(ch);
        const needUpper = (this.state.caps ^ this.state.shift);
        /*
         if (isLetter) ch = needUpper ? ch.toUpperCase() : ch.toLowerCase();
         else if (this.state.shift){ ch = this.shiftMap.get(ch) || ch; }
         */
        if (this.state.shift) {
            ch = this.shiftMap.get(ch) || ch;
        } else if (isLetter) {
            ch = needUpper ? ch.toUpperCase() : ch.toLowerCase();
        }



        // HU compose
        if (this.state.hu && this.opts.hunCompose && this.target) {
            const [s, e] = this._getSel();
            if (s === e && s > 0) {
                const prev = this._getValue().slice(s - 1, s);
                const pair = prev + ch;
                const conv = this.huExtras[pair] || this.huExtras[(needUpper ? pair.toUpperCase() : pair)];
                if (conv) {
                    this._replaceRange(s - 1, s, conv);
                    if (this.state.shift) {
                        setMod('shift', false);
                    }
                    return;
                }
            }
        }

        this._insert(ch);
        if (this.state.shift) {
            setMod('shift', false);
            this._toggleVis('Shift', false);
        }
    }

    _updateKeyFaces() {
        // Iterate keys and update main/sub legends according to active modifiers
        const needUpper = (this.state.caps ^ this.state.shift);
        const nodes = (this.opts.useShadow ? this.root : this.container).querySelectorAll('.vk-key');
        nodes.forEach(btn => {
            const code = btn.dataset.code;
            const base = btn.dataset.base || '';
            const main = btn.querySelector('.main');
            const sub = btn.querySelector('.sub');
            if (!main || !sub)
                return;

            // Mod keys: keep their captions
            const isMod = ['CapsLock', 'Shift', 'Alt', 'Control', 'AltGr', 'ToggleHU', 'Backspace', 'Delete', 'Enter', 'Tab', 'Space', 'Pipe'].includes(code);
            if (isMod) {
                main.textContent = base;
                sub.textContent = '';
                return;
            }

            let shown = base; // default legend
            // AltGr layer preview
            if (this.state.altgr) {
                const mapKey = (base.length === 1 ? base.toLowerCase() : base);
                const alt = this.altgrMap.get(mapKey);
                if (alt) {
                    shown = alt;
                    sub.textContent = base;
                    main.textContent = shown;
                    return;
                }
            }

            // Shift/Caps preview
            if (base.length === 1 && /[A-Za-záéíóöőúüű]/i.test(base)) {
                shown = needUpper ? base.toUpperCase() : base.toLowerCase();
                sub.textContent = needUpper ? base.toLowerCase() : base.toUpperCase();
            } else if (this.state.shift) {
                shown = this.shiftMap.get(base) || base;
                sub.textContent = base !== shown ? base : '';
            } else {
                sub.textContent = '';
            }
            main.textContent = shown;
        });
    }

    _emitToggle(kind, value) {
        this._dispatch('toggle', {kind, value});
        this._syncToggles();
    }
    _toggleVis(code, active) {
        const keys = (this.opts.useShadow ? this.root : this.container).querySelectorAll(`[data-code="${code}"]`);
        keys.forEach(k => active ? k.setAttribute('data-active', '1') : k.removeAttribute('data-active'));
        this._syncToggles();
    }
    _syncToggles() {
        if (!this.$)
            return;
        this.$.capsDot?.classList.toggle('on', !!this.state.caps);
        this.$.shiftDot?.classList.toggle('on', !!this.state.shift);
        this.$.huDot?.classList.toggle('on', !!this.state.hu);
    }

    /* -------------- editing helpers -------------- */
    _isContentEditableTarget() {
        return this.target && (this.target.isContentEditable || this.target.getAttribute?.('contenteditable') === 'true');
    }
    _getValue() {
        if (!this.target)
            return '';
        return this._isContentEditableTarget() ? (this.target.textContent || '') : (this.target.value ?? '');
    }
    _setValue(v) {
        if (!this.target)
            return;
        if (this._isContentEditableTarget())
            this.target.textContent = v;
        else
            this.target.value = v;
    }
    _getSel() {
        if (!this.target)
            return [0, 0];
        if (this._isContentEditableTarget()) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount) {
                const r = sel.getRangeAt(0);
                if (this.target.contains(r.startContainer) && this.target.contains(r.endContainer)) {
                    const pre = document.createRange();
                    pre.selectNodeContents(this.target);
                    pre.setEnd(r.startContainer, r.startOffset);
                    const s = pre.toString().length;
                    const len = r.toString().length;
                    return [s, s + len];
                }
            }
            const v = this._getValue();
            return [v.length, v.length];
        }
        return [this.target.selectionStart ?? 0, this.target.selectionEnd ?? 0];
    }
    _setSel(s, e) {
        if (!this.target)
            return;
        if (this._isContentEditableTarget()) {
            this.target.focus();
            const range = document.createRange();
            range.selectNodeContents(this.target);
            const anchor = this.target.firstChild || this.target;
            const pos = Math.min(s, (anchor.length || 0));
            range.setStart(anchor, pos);
            range.collapse(true);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            return;
        }
        this.target.setSelectionRange(s, e);
        this.target.focus();
    }
    _replaceRange(s, e, text) {
        const before = this._getValue().slice(0, s);
        const after = this._getValue().slice(e);
        if (this._dispatch('beforeinput', {inputType: 'insertReplacementText', data: text}) === false)
            return;
        this._setValue(before + text + after);
        const pos = s + text.length;
        this._setSel(pos, pos);
        this._dispatch('input', {value: this._getValue()});
    }
    _insert(text) {
        if (!this.target)
            return;
        const [s, e] = this.opts.attachAtCursor ? this._getSel() : [this._getValue().length, this._getValue().length];
        this._replaceRange(s, e, text);
    }
    _backspace() {
        if (!this.target)
            return;
        const [s, e] = this._getSel();
        if (s !== e) {
            this._replaceRange(s, e, '');
            return;
        }
        if (s > 0) {
            this._replaceRange(s - 1, s, '');
        }
    }
    _delete() {
        if (!this.target)
            return;
        const [s, e] = this._getSel();
        const v = this._getValue();
        if (s !== e) {
            this._replaceRange(s, e, '');
            return;
        }
        if (s < v.length) {
            this._replaceRange(s, s + 1, '');
        }
    }
    _dispatch(type, detail) {
        try {
            const ev = new CustomEvent(type, {detail, cancelable: true});
            (this.target || this.container).dispatchEvent(ev);
            return !ev.defaultPrevented;
        } catch (e) {
            return true;
        }
    }
}

/* -------------------- USAGE EXAMPLE --------------------
 < div id="vk">< /div >
 < script type="module" >
 import { VirtKeyboard } from '/assets/js/components/VirtKeyboard.js';
 const kb = new VirtKeyboard({
 container: '#vk',
 // target: '#t',           // opcionális, followFocus mellett nem kell
 followFocus: true,         // ez az alap
 draggable: true,
 minimizable: true,
 dockCorner: 'bottom-right',
 });
 < /script >
 
 */
