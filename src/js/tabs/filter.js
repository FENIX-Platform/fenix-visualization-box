/*global define, Promise, amplify */

define([
    "jquery",
    "loglevel",
    "underscore",
    "fx-v-b/config/config",
    "fx-v-b/config/config-default",
    "fx-v-b/config/errors",
    "fx-v-b/config/events",
    'fx-filter/js/utils',
    "text!fx-v-b/html/tabs/filter.hbs",
    'fx-filter/start',
    "i18n!fx-v-b/nls/box",
    "handlebars",
    "amplify"
], function ($, log, _, C, CD, ERR, EVT, Utils, tabTemplate, Filter, i18nLabels, Handlebars) {

    'use strict';

    var defaultOptions = {}, s = {
        CONTAINER: "[data-role='filter']",
        SUBMIT_BTN: "[data-role='submit']",
        RESET_BTN: "[data-role='reset']"
    };

    function FilterTab(o) {

        $.extend(true, this, defaultOptions, o);

        this.channels = {};
        this.status = {};

        return this;
    }

    /* API */
    /**
     * Tab initialization method
     * Optional method
     */
    FilterTab.prototype.init = function () {
        log.info("Tab initialized successfully");
    };

    /**
     * Method invoked when the tab is shown in the FENIX visualization box
     * Mandatory method
     */
    FilterTab.prototype.show = function (state) {

        var valid = this._validateInput();

        if (valid === true) {

            this._show(state);

            this.status.ready = true;

            log.info("Tab shown successfully");

            return this;

        } else {

            log.error("Impossible to create show filter tab");
            log.error(valid)
        }
    };

    /**
     * Check if the current model is suitable to be displayed within the tab
     * Mandatory method
     */
    FilterTab.prototype.isSuitable = function () {

        var isSuitable = this._isSuitable();

        log.info("Is tab suitable? " + isSuitable);

        return isSuitable;

    };

    /**
     * Disposition method
     * Mandatory method
     */
    FilterTab.prototype.dispose = function () {

        this._dispose();

        log.info("Tab disposed successfully");

    };

    /**
     * pub/sub
     * @return {Object} filter instance
     */
    FilterTab.prototype.on = function (channel, fn) {

        if (!this.channels[channel]) {
            this.channels[channel] = [];
        }
        this.channels[channel].push({context: this, callback: fn});

        return this;
    };

    /**
     * Sync tab to passed state
     * @param {Object} state
     * @return {Object} filter instance
     */
    FilterTab.prototype.sync = function (state) {
        log.info("Sync tab. State:" + JSON.stringify(state));

        if (state.hasOwnProperty("toolbar") && this.filter) {
            this.filter.setValues(state.toolbar, true);
        } else {
            log.warn("Abort toolbar sync")
        }
    };

    /**
     * Set values
     * @param {Object} values
     * @param {Boolean} silent
     * @return {Object} filter instance
     */
    FilterTab.prototype.setValues = function (values, silent) {
        log.info("Set values. values:" + JSON.stringify(values));

        this.filter.setValues(values, silent);
    };

    /**
     * Get values
     * @param {Object} format
     * @return {Object} filter instance
     */
    FilterTab.prototype.getValues = function (format) {
        log.info("Get values. format:" + format);

        return this.filter.getValues(format);
    };

    /* END - API */

    FilterTab.prototype._trigger = function (channel) {
        if (!this.channels[channel]) {
            return false;
        }

        var args = Array.prototype.slice.call(arguments, 1);
        for (var i = 0, l = this.channels[channel].length; i < l; i++) {
            var subscription = this.channels[channel][i];
            subscription.callback.apply(subscription.context, args);
        }
        return this;
    };

    FilterTab.prototype._validateInput = function () {

        var valid = true,
            errors = [];

        //Check if box has an id
        /*        if (!this.id) {

         window.fx_vis_box_id >= 0 ? window.fx_vis_box_id++ : window.fx_vis_box_id = 0;

         this.id = window.fx_vis_box_id;

         log.warn("Impossible to find id. Set auto id to: " + this.id);
         }         */

        //Check if $el exist
        if (this.$el.length === 0) {

            errors.push({code: ERR.MISSING_CONTAINER});

            log.warn("Impossible to find tab container");

        }

        return errors.length > 0 ? errors : valid;

    };

    FilterTab.prototype._show = function (syncModel) {

        if (this.initialized === true) {
            log.info("Tab Filter shown again");

        } else {

            log.info("Tab Filter shown for the first time");

            this.syncModel = syncModel;

            this._attach();

            this._initVariables();

            this._renderComponents();

            this._bindEventListeners();

            this.initialized = true;
        }

    };

    FilterTab.prototype._attach = function () {

        var template = Handlebars.compile(tabTemplate),
            m = $.extend(true, {}, this.template, i18nLabels),
            html = template(m);

        this.$el.html(html);
    };

    FilterTab.prototype._initVariables = function () {

        this.$submitBtn = this.$el.find(s.SUBMIT_BTN);

        this.$resetBtn = this.$el.find(s.RESET_BTN);

    };

    FilterTab.prototype._bindEventListeners = function () {

        this.$submitBtn.on("click", _.bind(this._onSubmitBtnClick, this));

        this.$resetBtn.on('click', _.bind(this._onResetBtnClick, this));

        this.filter.on('ready', _.bind(this._onFilterReady, this));

    };

    FilterTab.prototype._onFilterReady = function () {

        this.$submitBtn.prop('disabled', false);

        this.$resetBtn.prop('disabled', false);

        log.info("trigger 'ready' event");
        this._trigger('ready');

        this.filter.on('change', _.bind(this._onFilterChange, this));

    };

    FilterTab.prototype._onFilterChange = function () {

        var values = this.filter.getValues();

        log.info("trigger 'change' event " + JSON.stringify(values));

        this._trigger('change', values);

    };

    FilterTab.prototype._onSubmitBtnClick = function () {
        var values = this.filter.getValues();

        log.info("trigger 'submit' event" + JSON.stringify(values));

        this._trigger('submit', values);
    };

    FilterTab.prototype._onResetBtnClick = function (payload) {
        log.info("trigger 'reset' event");

        this.filter.reset();

        this._trigger('reset')
    };

    FilterTab.prototype._renderComponents = function () {
        log.info("render filter");

        this.filter = new Filter({
            items: this._createFilterConfiguration(),
            $el: this.$el.find(s.CONTAINER)
        });
    };

    FilterTab.prototype._createFilterConfiguration = function () {

        var configuration = this.config ? $.extend(true, {}, this.config) : Utils.createConfiguration({
            model: this.model
        });

        return $.extend(true, {}, Utils.mergeConfigurations(configuration, this.syncModel || {}));

    };

    FilterTab.prototype._unbindEventListeners = function () {

        this.$submitBtn.off();

        this.$resetBtn.off();
    };

    FilterTab.prototype._isSuitable = function () {

        return true;
    };

    FilterTab.prototype._dispose = function () {

        if (this.status.ready === true) {
            this._unbindEventListeners();
        }

    };

    FilterTab.prototype._getEventTopic = function (evt) {

        return EVT[evt] ? EVT[evt] + this.id : evt + this.id;
    };

    return FilterTab;

});