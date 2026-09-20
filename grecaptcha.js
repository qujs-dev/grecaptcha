/*!
 * GreCaptcha v1.0.3
 * Google reCAPTCHA integration
 * 
 * @author Serge Galich <gaserge@mail.ru>
 * @copyright 2025
 * @license MIT
 * @website http://qujs.ru/grecaptcha/
 * 
 * @requires Qu
 */
(function (window, document) {
    'use strict';
    const LIB_NAME = 'GreCaptcha';
    const DATA_PREFIX = 'qu-grecaptcha';

    if (window.Qu && window.Qu[LIB_NAME]) {
        window.Qu.debug(`⚠️ [${LIB_NAME}] Already registered, skipping duplicate`);
        return;
    }

    let Qu = null;

    const Module = {
        name: LIB_NAME,
        version: '1.0.3',
        _debug: false,
        _initOnce: false,

        _config: {
            enabled: false,
            siteKey: '',
            lazyPreload: true,
            selector: `data-${DATA_PREFIX}`,
            tokenInput: 'g-recaptcha-response',
            loader: true,
            disableButton: true,
            autoBind: false
        },

        _formHandlers: new WeakMap(),
        _autoBindObserver: null,

        _getDataAttrName: function(name) {
            return `data-${DATA_PREFIX}-${name}`;
        },

        _Qu: {
            debug: function(...args) {
                if (Qu && Qu.debug) return Qu.debug(...args);
                console.log(...args)
            },

            loading: function(state, el) {
                if (Qu && Qu.loading) return Qu.loading(state, el);
                if (el) el.style.opacity = state ? 0.5 : 1;
            },

            on: function(el, ev, handler, opts) {
                if (Qu && Qu.on) { return Qu.on(el, ev, handler, opts); }
                return null;
            },

            off: function(el, ev, handler, opts) {
                if (Qu && Qu.off) { return Qu.off(el, ev, handler, opts); }
                return null;
            },

            loadAssets: function(item, options) {
                if (Qu && Qu.loadAssets) { return Qu.loadAssets(item, options); }
                return null;
            }
        },

        debug: function(...args) {
            if(!this._debug) return;
            this._Qu.debug(`[${LIB_NAME}]`, ...args);
        },

        config: function(options) {
            Object.assign(this._config, options);
            return this;
        },

        use: function (fn) {
            if (typeof fn === 'function') {
                fn(this, Qu);
            }
        },

        extend: function () {
            if (Array.isArray(window[LIB_NAME + 'Extend'])) {
              window[LIB_NAME + 'Extend'].forEach((fn) => {
                this.use(fn);
              });
              window[LIB_NAME + 'Extend'] = [];
            }
        },

        loaded: function(quInstance) {
            Qu = quInstance;
            this.extend();
            this.debug(`📗 [${LIB_NAME}] loaded`);
        },

        initOnce: function(params = {}) {
            if(this._initOnce === true) { return; }
            this._initOnce = true;

            if (this._config.enabled && this._config.lazyPreload) {
                this.bindInputs();
            }

            if (this._config.enabled && this._config.autoBind) {
                this.autoBindForms();
            }
        },

        init: function(quInstance, params = {}) {
            this.config(params);
            this.initOnce();
        },

        bindInputs: function() {
            const _this = this;

            if (!this._config.enabled || !this._config.siteKey) {
                this.debug(`⚠️ [${LIB_NAME}] not enabled or siteKey missing`);
                return;
            }

            this._Qu.on('input focusin',
                `form[${this._config.selector}] input, form[${this._config.selector}] textarea, form[${this._config.selector}] select`,
                function() {
                    _this._lazyLoad();
                }
            );

            this.debug(`⚙️ [${LIB_NAME}] Lazy binded to inputs`);
        },

        _lazyLoad: function() {
            if (typeof grecaptcha !== 'undefined' || window._grecaptchaLoading) {
                return;
            }

            this.debug(`⏳ [${LIB_NAME}] Loading...`);
            window._grecaptchaLoading = true;

            const scriptUrl = "https://www.google.com/recaptcha/api.js?render=" + this._config.siteKey;

            this._Qu.loadAssets(scriptUrl, {
                type: 'script',
                waitForLoad: true,
                async: true,
                defer: true
            }).then(() => {
                this.debug(`✅ [${LIB_NAME}] ready`);
                window._grecaptchaLoading = false;
            }).catch((error) => {
                console.error(`❌ [${LIB_NAME}] failed`, error);
                window._grecaptchaLoading = false;
            });
        },

        ensureLoaded: function() {
            const _this = this;

            return new Promise((resolve, reject) => {
                if (typeof grecaptcha !== 'undefined') {
                    grecaptcha.ready(resolve);
                    return;
                }

                if (window._grecaptchaLoading === true) {
                    const checkInterval = setInterval(() => {
                        if (typeof grecaptcha !== 'undefined') {
                            clearInterval(checkInterval);
                            grecaptcha.ready(resolve);
                        }
                    }, 50);
                    return;
                }

                if (window._grecaptchaLoading instanceof Promise) {
                    window._grecaptchaLoading.then(() => {
                        grecaptcha.ready(resolve);
                    }).catch(reject);
                    return;
                }

                this.debug(`⏳ [${LIB_NAME}] Loading...`);

                const scriptUrl = "https://www.google.com/recaptcha/api.js?render=" + this._config.siteKey;

                window._grecaptchaLoading = this._Qu.loadAssets(scriptUrl, {
                    type: 'script',
                    waitForLoad: true,
                    async: true,
                    defer: true
                }).then(() => {
                    this.debug(`✅ [${LIB_NAME}] ready`);
                    window._grecaptchaLoading = false;

                    return new Promise((readyResolve) => {
                        grecaptcha.ready(readyResolve);
                    });
                }).catch((error) => {
                    console.error(`❌ [${LIB_NAME}] failed`, error);
                    window._grecaptchaLoading = false;
                    throw error;
                });

                window._grecaptchaLoading.then(resolve).catch(reject);
            });
        },

        check: function(action = 'submit') {
            const _this = this;

            return new Promise(async (resolve, reject) => {
                try {
                    if (!this._config.enabled || !this._config.siteKey) {
                        reject(new Error('GreCaptcha not enabled or siteKey missing'));
                        return;
                    }

                    await _this.ensureLoaded();

                    const token = await grecaptcha.execute(_this._config.siteKey, {
                        action: action
                    });

                    resolve(token);
                } catch (error) {
                    reject(error);
                }
            });
        },

        addTokenToForm: function(form, token) {
            const tokenInputName = this._config.tokenInput || 'g-recaptcha-response';
            const oldToken = form.querySelector(`[name="${tokenInputName}"]`);
            if (oldToken) oldToken.remove();

            const tokenInput = document.createElement('input');
            tokenInput.type = 'hidden';
            tokenInput.name = tokenInputName;
            tokenInput.value = token;
            form.appendChild(tokenInput);

            this.debug(`✅ [${LIB_NAME}] Token added to form`);
        },

        autoBindForms: function() {
            const _this = this;
            const selector = this._config.selector;
            const query = 'form[' + selector + ']';

            function bindOne(form) {
                if (form._captchaAutoBound) return;
                form._captchaAutoBound = true;
                _this.bindForm(form, { action: 'submit' });
            }

            document.querySelectorAll(query).forEach(bindOne);

            if (!this._autoBindObserver) {
                this._autoBindObserver = new MutationObserver(function(mutations) {
                    mutations.forEach(function(m) {
                        m.addedNodes.forEach(function(node) {
                            if (node.nodeType !== 1) return;

                            if (node.matches && node.matches(query)) {
                                bindOne(node);
                            }
                            if (node.querySelectorAll) {
                                node.querySelectorAll(query).forEach(bindOne);
                            }
                        });
                    });
                });

                this._autoBindObserver.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }

            this.debug(`⚙️ [${LIB_NAME}] Auto-bind started for ${query}`);
        },

        bindForm: function(form, options = {}) {
            if (!this._config.enabled || !this._config.siteKey) {
                this.debug(`⚠️ [${LIB_NAME}] not enabled or siteKey missing`);
                return;
            }

            const _this = this;
            const action = options.action || 'submit';

            const useLoader  = options.loader        !== undefined ? !!options.loader        : this._config.loader;
            const useDisable = options.disableButton !== undefined ? !!options.disableButton : this._config.disableButton;

            // снять старый обработчик
            if (this._formHandlers.has(form)) {
                const old = this._formHandlers.get(form);
                form.removeEventListener('submit', old);
                this._formHandlers.delete(form);
            }

            const handler = async function(e) {
                // ── ВТОРОЙ ПРОХОД (от requestSubmit) ──
                if (form._captchaPassed) {
                    form._captchaPassed = false;

                    if (useDisable) {
                        const btn = form.querySelector('[type="submit"]');
                        if (btn) btn.disabled = false;
                    }
                    if (useLoader) {
                        _this._Qu.loading(false, form);
                    }
                    return;
                }

                // ── ПЕРВЫЙ ПРОХОД ──
                e.preventDefault();

                if (useDisable) {
                    const btn = form.querySelector('[type="submit"]');
                    if (btn) btn.disabled = true;
                }
                if (useLoader) {
                    _this._Qu.loading(true, form);
                }

                try {
                    const token = await _this.check(action);
                    _this.addTokenToForm(form, token);

                    if (typeof options.onSubmit === 'function') {
                        options.onSubmit(form);
                        return;
                    }

                    form._captchaPassed = true;

                    if (typeof form.requestSubmit === 'function') {
                        form.requestSubmit();
                    } else {
                        form.submit();
                    }
                } catch (error) {
                    console.error(`❌ [${LIB_NAME}] bindForm failed`, error);

                    if (useDisable) {
                        const btn = form.querySelector('[type="submit"]');
                        if (btn) btn.disabled = false;
                    }
                    if (useLoader) {
                        _this._Qu.loading(false, form);
                    }
                    if (typeof options.onError === 'function') options.onError(error);
                }
            };

            this._formHandlers.set(form, handler);
            form.addEventListener('submit', handler);

            this.debug(`🔗 [${LIB_NAME}] Form bound: action=${action}`);
        },

        preload: function() {
            if (!this._config.enabled || !this._config.siteKey) {
                return Promise.reject('GreCaptcha not enabled');
            }
            return this.ensureLoaded();
        }
    };

    if (window.Qu) {
        window.Qu.lib(LIB_NAME, Module);
    } else {
        window._QuLibs = window._QuLibs || [];
        window._QuLibs.push({ name: LIB_NAME, instance: Module });
    }

})(window, document);