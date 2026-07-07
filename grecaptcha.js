/*!
 * GreCaptcha v1.0.2
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
        version: '1.0',
        _debug: false,
        _initOnce: false,

        _config: {
            enabled: false,
            siteKey: '',
            lazyPreload: true,
            selector: `data-${DATA_PREFIX}`,
            tokenInput: 'g-recaptcha-response',
        },


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
            this._Qu.debug(...args);
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

            if (this._config.enabled && this._config.lazyPreload) {
                this.bindInputs();
            }
        },

        initOnce: function(params = {}) {
            if(this._initOnce === true) { return; }
            this._initOnce = true;
            
            if (this._config.lazyPreload && this._config.enabled) {
                this.bindInputs();
            }
        },

        init: function(quInstance, params = {}) {
            this.config(params);
            this.initOnce(params);
        },

        bindInputs: function() {
            const _this = this;

            if (!this._config.enabled || !this._config.siteKey) {
                this.debug(`⚠️ [${LIB_NAME}] not enabled or siteKey missing`);
                return;
            }

            this._Qu.on('input focusin', `form[${this._config.selector}] input, form[${this._config.selector}] textarea, form[${this._config.selector}] select`, function() {
                _this._lazyLoad();
            });
            
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
            const _this = this;
            
            const oldToken = form.querySelector(`[name="${_this._config.tokenInput}"]`);
            if (oldToken) oldToken.remove();

            const tokenInput = document.createElement('input');
            tokenInput.type = 'hidden';
            tokenInput.name = _this._config.tokenInput;
            tokenInput.value = token;
            form.appendChild(tokenInput);
            
            this.debug(`✅ [${LIB_NAME}] Token added to form`, {
                token: token,
                form: form
            });
        },

        bindForm: function(form, options = {}) {
            if (!this._config.enabled) {
                this.debug(`⚠️ [${LIB_NAME}] not enabled, skipping bindForm`);
                return;
            }
            
            const _this = this;
            const action = options.action || 'submit';

            this._Qu.off('submit', form, this._boundSubmitHandler);
            
            this._boundSubmitHandler = async function(e) {
                e.preventDefault();
                
                const submitBtn = form.querySelector('[type="submit"]');
                if (submitBtn) submitBtn.disabled = true;
                
                if (options.loader) {
                    _this._Qu.loading(true, form);
                }
            
                try {
                    const token = await _this.check(action);
                    _this.addTokenToForm(form, token);
                    
                    if (options.onSubmit) {
                        options.onSubmit(form);
                    } else {
                        form.submit();
                    }
                    
                } catch (error) {
                    console.error(`❌ [${LIB_NAME}] form submission failed`, error);
                    
                    if (submitBtn) submitBtn.disabled = false;
                    
                    if (options.loader) {
                        _this._Qu.loading(false, form);
                    }
                    
                    if (options.onError) {
                        options.onError(error);
                    }
                }
            };
            
            this._Qu.on('submit', form, this._boundSubmitHandler);
            
            this.debug(`🔗 [${LIB_NAME}] Form bound with action: ${action}`);
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