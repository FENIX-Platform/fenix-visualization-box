/*global define, amplify*/
define([
    "loglevel",
    "require",
    "jquery",
    "underscore",
    "underscoreString",
    "handlebars",
    "fx-v-b/config/config",
    "fx-v-b/config/config-default",
    "fx-v-b/config/errors",
    "fx-v-b/config/events",
    "fx-common/utils",
    "fx-md-v/start",
    "text!fx-v-b/html/template.hbs",
    "fx-common/json-menu",
    "fx-v-b/config/right-menu-model",
    "i18n!fx-v-b/nls/box",
    "fx-common/bridge",
    "fx-reports/start",

    "fx-v-b/config/tabs/map-earthstat-layers",

    "swiper",
    "amplify",
    "bootstrap"
], function (log, require, $, _, _str, Handlebars, C, CD, ERR, EVT, Utils, MetadataViewer, Template, JsonMenu, RightMenuModel, i18nLabels, Bridge, Report,
             //DEMO DATA: waiting for data from the D3S
             mapEarthstatLayers,
             Swiper) {

    'use strict';

    var s = {
        BOX: "[data-role='box']",
        CONTENT_READY: "[data-content='ready']",
        RIGHT_MENU: "[data-role='right-menu']",
        FLIP_CONTAINER: "[data-role='flip-container']",
        FLIP_BUTTONS: "[data-action='flip']",
        FRONT_CONTENT: "[data-role='front-content']",
        FRONT_TOOLBAR: "[data-role='front-toolbar']",
        BACK_TOOLBAR: "[data-role='back-toolbar']",
        PROCESS_STEPS: "[data-role='process-steps']",
        PROCESS_DETAILS: "[data-role='process-details']",
        BACK_CONTENT: "[data-role='back-content']",
        MODAL: "[data-role='modal']",
        MODAL_METADATA_CONTAINER: "[data-role='modal'] [data-role='metadata-container']",
        BOX_TITLE: "[data-role='box-title']",
        QUERY_BUTTON: "[data-action='query']",
        ERROR_TEXT: "[data-role='error-text']",
        ERROR_BUTTON: "[data-role='error-BUTTON']",
        BACK_FILTER_ERRORS: "[data-role='filter-error']",
        FILTER_AGGREGATION_TEMPLATE: "[data-role='filter-aggregation-template']",
        FILTER_FILTER_TEMPLATE: "[data-role='filter-filter-template']",
        FILTER_MAP_TEMPLATE: "[data-role='filter-map-template']",
        ROWS_SWIPER: "[data-role='filter-rows-swiper']",
        BTN_SIDEBAR: "[data-action='show-back-sidebar']",
        SIDEBAR: "[data-role='back-sidebar']",
        FRONT_FACE: "[data-face='front']",
        BACK_FACE: "[data-face='back']",
        OTHER_CONTENT: "[data-content='empty'], [data-content='error'], [data-content='huge'], [data-role='modal']"
    };

    /* API */

    /**
     * Constructor
     * @param {Object} obj
     * @return {Object} box instance
     */
    function Box(obj) {
        log.info("Create box");
        log.info(obj);

        this._registerHandlebarsHelpers();

        //Extend instance with obj and $el
        $.extend(true, this, C, CD, {initial: obj || {}, $el: $(obj.el)});

        var valid = this._validateInput();

        if (valid === true) {

            this._initState();

            this._initVariables();

            this._initObj();

            this._setStatus("loading");

            this._renderMenu();

            this._bindEventListeners();

            this._preloadTabSources();

            this.valid = true;

            return this;

        } else {

            this.valid = false;

            this._setObjState("error", valid);

            log.error("Impossible to create visualization box");
            log.error(valid)
        }
    }

    /**
     * Set box status
     * @param {Object} obj
     * @return {Object} box instance
     */
    Box.prototype.render = function (obj) {
        log.info("Render model for box [" + this.id + "]:");
        log.info(obj);

        $.extend(true, this, obj);

        this._reactToModelStatus();
    };

    /**
     * Dispose box
     * @return {null}
     */
    Box.prototype.dispose = function () {

        this._dispose();

        log.info("Box [" + this.id + "] disposed");
    };

    /**
     * Set box status
     * @param {String} status
     * @return {null}
     */
    Box.prototype.setStatus = function (status) {

        //TODO check if status != current status

        this._setStatus(status);
    };

    /**
     * Show a box's tab
     * @param {String} tab. tab'sid
     * @param {Object} opts. Options passed to tab instance
     * @return {null}
     */
    Box.prototype.showTab = function (tab, opts) {

        this._showFrontTab(tab, opts);
    };

    /**
     * Set box width
     * @param {String} size
     * @return {null}
     */
    Box.prototype.setSize = function (size) {

        this._setSize(size);
    };

    /**
     * Flip the visualization box
     * @param {String} side
     * @return {null}
     */
    Box.prototype.flip = function (side) {
        return this._flip(side);
    };

    /**
     * pub/sub
     * @return {Object} filter instance
     */
    Box.prototype.on = function (channel, fn) {
        if (!this.channels[channel]) {
            this.channels[channel] = [];
        }
        this.channels[channel].push({context: this, callback: fn});
        return this;
    };

    /**
     * get box state
     * @return {Object} box state
     */
    Box.prototype.getState = function () {

        return this.state;
    };

    /* Internal fns*/

    Box.prototype._validateInput = function () {

        var valid = true,
            errors = [];

        //Check if box has a valid id
        if (!this.id) {

            window.fx_vis_box_id >= 0 ? window.fx_vis_box_id++ : window.fx_vis_box_id = 0;

            this.id = "fx-v-b-" + window.fx_vis_box_id;

            log.warn("Impossible to find id. Set auto id to: " + this.id);
        }

        //Check if $el exist
        if (this.$el.length === 0) {

            errors.push({code: ERR.MISSING_CONTAINER});

            log.warn("Impossible to find box container");

        }

        return errors.length > 0 ? errors : valid;
    };

    Box.prototype._initVariables = function () {

        this.front_tab_instances = {};
        this.back_tab_instances = {};

        this.bridge = new Bridge({
            environment: this._getObjState("environment")
        });

        this.report = new Report({
            environment: this._getObjState("environment")
        });
    };

    Box.prototype._initObj = function () {

        //Inject box blank template
        var template = Handlebars.compile($(Template).find(s.BOX)[0].outerHTML),
            $html = $(template($.extend(true, {}, this.getState(), i18nLabels)));

        this.$el.html($html);

        //pub/sub
        this.channels = {};

        //this._setObjState("hasMenu", this.$el.find(s.RIGHT_MENU).length > 0);
        this.hasMenu = this.$el.find(s.RIGHT_MENU).length > 0;

        //set flip side
        this.flip(this._getObjState("face"));

        //step process list
        this.$processSteps = this.$el.find(s.PROCESS_STEPS);
        this.$processStepDetails = this.$el.find(s.PROCESS_DETAILS);

        //modal
        this.$modal = this.$el.find(s.MODAL);

        this.$boxTitle = this.$el.find(s.BOX_TITLE);

    };

    Box.prototype._initState = function () {

        //template options
        this._setObjState("hideToolbar", !!this.initial.hideToolbar);
        this._setObjState("hideMenu", !!this.initial.hideMenu);
        this._setObjState("hideMetadataButton", !!this.initial.hideMetadataButton);
        this._setObjState("hideRemoveButton", !!this.initial.hideRemoveButton);
        this._setObjState("hideDownloadButton", !!this.initial.hideDownloadButton);
        this._setObjState("hideCloneButton", !!this.initial.hideCloneButton);
        this._setObjState("hideFlipButton", !!this.initial.hideFlipButton);
        this._setObjState("hideMinimizeButton", !!this.initial.hideMinimizeButton);

        //tabs
        this._setObjState("tabStates", this.initial.tabStates || {});
        this._setObjState("tabOpts", this.initial.tabOpts);
        this._setObjState("tab", this.initial.tab);

        //flip side
        this._setObjState("face", this.initial.face || C.face || CD.face);
        this._setObjState("faces", this.initial.faces || C.faces || CD.faces);

        //resource process steps
        this._setObjState("model", this.initial.model);
        this._setObjState("version", this.initial.version ? this.initial.version : undefined);
        this._setObjState("values", this.initial.values);
        this._setObjState("process", this.initial.process);
        this._setObjState("uid", this.initial.uid || Utils.getNestedProperty("metadata.uid", this._getObjState("model")));

        this._setObjState("size", this.initial.size || C.size || CD.size);
        this._setObjState("status", this.initial.status || C.status || CD.status);
        this._setObjState("environment", this.initial.environment);

        //data validation
        this._setObjState("max_size", this.initial.max_data_size || C.max_data_size || CD.max_data_size);

        // back filter values
        this._setObjState("back_filter", this.initial.back_filter);
        this._setObjState("back_map", this.initial.back_map);

    };

    Box.prototype._setObjState = function (key, val) {

        Utils.assign(this.state, key, val);

        return val;
    };

    Box.prototype._getObjState = function (path) {

        return Utils.getNestedProperty(path, this.getState());
    };

    Box.prototype._reactToModelStatus = function (s) {

        //reset error
        this._setObjState("error", null);

        var status = s || this._getModelStatus();

        switch (status) {
            case 'ready' :
                this.setStatus("ready");
                this._renderBox();
                break;
            case 'empty' :
                this.setStatus("empty");
                break;
            case 'huge' :
                this.setStatus("huge");
                break;
            case 'no_model' :
                this.setStatus("loading");
                break;
            case 'to_load' :
                this.setStatus("loading");
                this._loadResource()
                    .then(
                        _.bind(this._onLoadResourceSuccess, this),
                        _.bind(this._onLoadResourceError, this));
                break;
            case "missing_metadata":
                this._loadResourceMetadata()
                    .then(
                        _.bind(this._loadResourceMetadataSuccess, this),
                        _.bind(this._loadResourceMetadataError, this));
                break;
            case "to_filter":
                this._forceFilterResource();
                break;
            default :
                this.setStatus("error");
                break;
        }
    };

    Box.prototype._getModelStatus = function () {

        var uid = this._getObjState("uid"),
            process = this._getObjState("process"),
            version = this._getObjState("version"),
            model = this._getObjState("model");

        if (model) {

            if (typeof model !== 'object') {
                return 'error';
            }

            if (model.size === 0) {
                return 'empty';
            }

            if (!Array.isArray(model.data)) {
                return 'to_filter';
            }

            if (Array.isArray(model.data) && model.data.length === 0) {
                return 'empty';
            }

            if (model.size > this._getObjState("max_size")) {
                return 'huge';
            }

            if (Array.isArray(model.data) && model.data.length > 0) {
                return 'ready';
            }

            return 'error';
        }

        if (uid) {

            if (process) {
                return 'to_load';
            }

            return 'missing_metadata';
        }

        return 'error';

    };

    Box.prototype._loadResource = function (p) {
        log.info("Loading FENIX resource");

        this.setStatus("loading");

        var queryParams = C.d3pQueryParameters || CD.d3pQueryParameters,
            process = _.union(Array.isArray(p) ? p : [], this._getObjState("process"));

        return this.bridge.getResource({
            body: process,
            uid: this._getObjState("uid"),
            version: this._getObjState("version"),
            params: $.extend(true, {}, queryParams)
        });
    };

    Box.prototype._onLoadResourceError = function () {
        log.info("Impossible to load resource");

        this._setObjState("error", {code: ERR.LOAD_RESOURCE, filter: true});

        this._setStatus("error");
    };

    Box.prototype._onLoadResourceSuccess = function (resource) {
        log.info("Load resource success");

        this._disposeBoxFaces();

        this._updateModel(resource);

        this.setStatus("ready");

        this._flip("front");

        this._reactToModelStatus();

    };

    Box.prototype._updateModel = function (resource) {

        var model = this._getObjState("model") || {},
            newMetadata = Utils.getNestedProperty("metadata", resource),
            newDsd = Utils.getNestedProperty("dsd", newMetadata),
            newData = Utils.getNestedProperty("data", resource),
            newSize = Utils.getNestedProperty("size", resource);

        //if metadata exists updated only dsd
        if (model.metadata) {
            Utils.assign(model, "metadata.dsd", newDsd);
        } else {
            Utils.assign(model, "metadata", newMetadata);
        }

        if (Array.isArray(newData)) {
            Utils.assign(model, "data", newData);
        }

        if (model.size !== newSize) {
            Utils.assign(model, "size", newSize);
        }

        this._setObjState("model", model);
    };

    //preload resource info

    Box.prototype._loadResourceMetadata = function () {
        log.info("Loading FENIX resource metadata");

        this.setStatus("loading");

        var queryParams = C.d3pQueryParameters || CD.d3pQueryParameters;

        return this.bridge.getMetadata({
            uid: this._getObjState("uid"),
            version: this._getObjState("version"),
            params: $.extend(queryParams, {dsd: true, full: true})
        });
    };

    Box.prototype._loadResourceMetadataError = function () {
        log.info("Impossible to load resource");

        this._setObjState("error", {code: ERR.LOAD_METADATA});

        this._setStatus("error");
    };

    Box.prototype._loadResourceMetadataSuccess = function (resource) {
        log.info("Load resource metadata success");

        this._updateModel({metadata: resource});

        this._checkResourceType();

    };

    Box.prototype._checkResourceType = function () {
        log.info("Check Resource type");

        this._getModelInfo();

        var model = this._getObjState("model"),
            resourceType = this._getObjState("resourceRepresentationType");

        log.info("Resource type is: " + resourceType);

        switch (resourceType) {
            case "dataset" :
                var datasources = Utils.getNestedProperty("metadata.dsd.datasources", model);
                if (Array.isArray(datasources) && datasources.length > 0) {

                    this._fetchResource().then(
                        _.bind(this._fetchResourceSuccess, this),
                        _.bind(this._fetchResourceError, this));

                } else {
                    this._setObjState("error", {code: ERR.MISSING_DATASOURCES});
                    this._setStatus("error");
                }
                break;
            case "layer" :
                //TODO
                break;
            default :
                this._setObjState("error", {code: ERR.UNKNOWN_RESOURCE_TYPE});
                this._setStatus("error")
        }
    };

    Box.prototype._fetchResource = function () {
        log.info("Fetching FENIX resource");

        this.setStatus("loading");

        var queryParams = C.d3pQueryParameters || CD.d3pQueryParameters;

        return this.bridge.getResource({
            body: [],
            uid: this._getObjState("uid"),
            version: this._getObjState("version"),
            params: $.extend(true, {}, queryParams, {perPage: 1, page: 1})
        });
    };

    Box.prototype._fetchResourceError = function () {
        log.info("Impossible to fetch resource");

        this._setObjState("error", {code: ERR.FETCH_RESOURCE});

        this._setStatus("error");
    };

    Box.prototype._fetchResourceSuccess = function (resource) {
        log.info("fetch resource success");

        this._updateModel(resource);

        this._checkModelSize();

    };

    Box.prototype._checkModelSize = function () {

        var status = this._getModelStatus();

        switch (status.toLowerCase()) {
            case  "ready" :
                this._reactToModelStatus("to_load");
                break;
            default:
                this._reactToModelStatus(status);
        }

    };

    Box.prototype._getModelInfo = function () {

        var model = this._getObjState("model"),
            rt = Utils.getNestedProperty("metadata.meContent.resourceRepresentationType", model) || "",
            resourceType = rt.toLowerCase();
        log.info("Resource type is: " + resourceType);

        this._setObjState("resourceRepresentationType", resourceType);
    };

    Box.prototype._renderBox = function () {
        log.info("Render box start:");

        this._getModelInfo();

        this._renderBoxFaces();
    };

    Box.prototype._preloadTabSources = function () {

        var registeredTabs = $.extend(true, {}, this.tabRegistry),
            tabs = this.tabs,
            tabsKeys = Object.keys(tabs),
            paths = [];

        _.each(tabsKeys, _.bind(function (tab) {

            var conf = registeredTabs[tab];

            if (!conf) {
                log.error('Registration not found for "' + tab + ' tab".');
            }

            if (!$.isPlainObject(tabs[tab])) {
                this._setObjState("tabs." + tab, {});
            }

            this._setObjState("tabs." + tab + ".suitable", false);

            if (conf.path) {
                paths.push(conf.path);
            } else {
                log.error('Impossible to find path configuration for "' + tab + ' tab".');
            }

        }, this));

        //Async load of plugin js source
        require(paths, _.bind(this._preloadTabSourcesSuccess, this));

    };

    Box.prototype._preloadTabSourcesSuccess = function () {

        this._reactToModelStatus();
    };

    Box.prototype._renderBoxFaces = function () {

        this._renderFrontFace();

        this._renderBackFace();

    };

    Box.prototype._updateBoxTitle = function () {

        var title = Utils.getNestedProperty("metadata.title", this._getObjState("model")) || {},
            uid = Utils.getNestedProperty("metadata.uid", this._getObjState("model"));

        this.$boxTitle.html(title[this.lang] || uid);

    };

    // Load resource

    Box.prototype._validateQuery = function () {

        this._hideFilterError();

        var values = $.extend(true, {}, this._getBackFilterValues()) || {},
            valid = true,
            model = this._getObjState("model"),
            resourceColumns = Utils.getNestedProperty("metadata.dsd.columns", model) || [],
            resourceKeyColumns = Utils.cleanArray(resourceColumns.map(function (c) {
                if (c.key === true) {
                    return c.id;
                }
            })),
            errors = [],
            aggregations = Utils.getNestedProperty("aggregations.values.aggregations", values) || [],
            columns = Utils.getNestedProperty("filter.values", values) || {},
            columnsKey = Object.keys(columns) || [],
            valueDimension = _.findWhere(resourceColumns, {subject: "value"}),
            valueId = valueDimension.id;

        var sum = _.where(aggregations, {parent: 'sum'}).map(function (item) {
                return item.value;
            }),
            avg = _.where(aggregations, {parent: 'avg'}).map(function (item) {
                return item.value;
            }),
            first = _.where(aggregations, {parent: 'first'}).map(function (item) {
                return item.value;
            }),
            last = _.where(aggregations, {parent: 'last'}).map(function (item) {
                return item.value;
            }),
            group = _.where(aggregations, {parent: 'group'}).map(function (item) {
                return item.value;
            }),
            sumLength = parseInt(sum.length, 10),
            avgLength = parseInt(avg.length, 10),
            firstLength = parseInt(first.length, 10),
            lastLength = parseInt(last.length, 10),
            groupLength = parseInt(group.length, 10),
            aggregationRulesLength = sumLength + avgLength + firstLength + lastLength;

        // aggregations on dataType !== number
        _.each(sum, function (dimension) {

            var column = _.findWhere(resourceColumns, {id: dimension}) || {},
                dataType = column.dataType;

            if (dataType !== 'number') {
                errors.push({
                    code: ERR.NO_NUMBER_DATATYPE,
                    value: dimension,
                    label: _.findWhere(aggregations, {value: dimension}).label
                });
            }

        });
        _.each(avg, function (dimension) {

            var column = _.findWhere(resourceColumns, {id: dimension}) || {},
                dataType = column.dataType;

            if (dataType !== 'number') {
                errors.push({
                    code: ERR.NO_NUMBER_DATATYPE,
                    value: dimension,
                    label: _.findWhere(aggregations, {value: dimension}).label
                });
            }

        });

        //no 'value' on group by
        if (_.contains(group, valueId)) {

            var valueInGroupBy = _.findWhere(aggregations, {value: valueId});

            errors.push({
                code: ERR.VALUE_IN_GROUP_BY,
                value: valueInGroupBy.value,
                label: valueInGroupBy.label
            });
        }

        //if aggregation rules -> group has to be populated
        if (aggregationRulesLength > 0 && groupLength === 0) {
            errors.push({
                code: ERR.MISSING_GROUP_BY
            });
        }

        //if group by is populated -> value in aggregation rules
        if (groupLength > 0) {

            var isValueInAggregationRules =
                _.contains(sum, valueId) || _.contains(avg, valueId) || _.contains(first, valueId) || _.contains(last, valueId);

            if (!isValueInAggregationRules) {
                errors.push({
                    code: ERR.MISSING_VALUE_IN_AGGREGATION_RULES
                });
            }
        }

        //no exclude key dimensions
        var excludedColumns = _.difference(resourceKeyColumns, columnsKey);
        if (columnsKey.length > 0 && excludedColumns.length > 0) {

            var labels = _.map(excludedColumns, _.bind(function (dim) {
                return _.findWhere(resourceColumns, {id: dim}).title[this.lang]
            }, this));

            errors.push({
                code: ERR.EXCLUDE_KEY_DIMENSION,
                value: labels,
                label: labels.join(", ")
            });
        }

        return errors.length > 0 ? errors : valid;

    };

    Box.prototype._createQuery = function (payload) {

        var self = this,
            filter = [],
            filterStep,
            groupStep;

        this._setObjState("values", $.extend(true, {}, payload));

        if (this.back_tab_instances.hasOwnProperty("filter") && $.isFunction(this.back_tab_instances["filter"].getValues)) {
            payload["filter"] = this.back_tab_instances["filter"].getValues("fenix");
        }

        filterStep = createFilterStep(payload);

        groupStep = createGroupStep(payload);

        if (filterStep) {
            filter.push(filterStep);
        }

        if (groupStep) {
            filter.push(groupStep);
        }

        return filter;

        function createFilterStep(payload) {

            if (!payload.filter) {
                return;
            }

            var step = {
                    name: "filter",
                    parameters: {}
                },
                hasValues = false,
                columns = [],
                rowValues = payload.filter,
            //columnsValues = payload.columns.values,
                columnsSet = Utils.getNestedProperty("metadata.dsd.columns", self._getObjState("model"))
                    .filter(function (c) {
                        return !c.id.endsWith("_" + self.lang.toUpperCase());
                    })
                    .map(function (c) {
                        return c.id;
                    }).sort();

            if (Object.getOwnPropertyNames(rowValues).length > 0) {
                step.parameters.rows = rowValues;
                hasValues = true;
            } else {
                log.warn("Filter.rows not included");
            }

            //If they are equals it means i want to include all columns so no filter is needed
            columns = columns.sort();

            if (!_.isEqual(columnsSet, columns) && columns.length > 0) {
                step.parameters.columns = columns;
                hasValues = true;
            } else {
                log.warn("Filter.columns not included");
            }

            return hasValues ? step : null;

        }

        function createGroupStep(payload) {

            if (!payload.aggregations) {
                return;
            }

            var step = {
                    name: "group",
                    parameters: {}
                },
                hasValues = false,
                values = Utils.getNestedProperty("aggregations.values.aggregations", payload),
                by = [],
                sum = [],
                avg = [],
                first = [],
                last = [],
                aggregations = [];

            _.each(values, function (obj) {

                switch (obj.parent.toLowerCase()) {
                    case "group":
                        by.push(obj.value);
                        break;
                    case "sum":
                        sum.push(obj.value);
                        break;
                    case "avg":
                        avg.push(obj.value);
                        break;
                    case "first":
                        first.push(obj.value);
                        break;
                    case "last":
                        last.push(obj.value);
                        break;
                }

            });

            sum = Utils.cleanArray(sum).map(function (i) {
                return {"columns": [i], "rule": "SUM"};
            });

            avg = Utils.cleanArray(avg).map(function (i) {
                return {"columns": [i], "rule": "AVG"};
            });

            first = Utils.cleanArray(first).map(function (i) {
                return {"columns": [i], "rule": "FIRST"};
            });

            last = Utils.cleanArray(last).map(function (i) {
                return {"columns": [i], "rule": "LAST"};
            });

            //Add group by
            if (by.length > 0) {
                step.parameters.by = Utils.cleanArray(by);
                hasValues = true
            }

            //Add aggregations
            _.each([sum, avg, first, last], function (a) {

                if (a.length > 0) {
                    aggregations = _.uniq(_.union(aggregations, a), false);
                }

            });

            if (aggregations.length > 0) {
                step.parameters.aggregations = aggregations;
                hasValues = true
            }

            return hasValues ? step : null;
        }
    };

    // Front face

    Box.prototype._renderFrontFace = function () {
        log.info("Start rendering box front face");

        var faces = this._getObjState("faces");

        if (!_.contains(faces, 'front') || this.frontFaceIsRendered === true) {
            log.warn("Abort 'front' face rendering. face is already rendered: " + this.frontFaceIsRendered + ", config render face: " + _.contains(faces, 'front'));
            return;
        }

        this.frontFaceIsRendered = true;

        this._checkSuitableTabs();

        this._showDefaultFrontTab();

        //render metadata modal
        this.metadataModal = new MetadataViewer();

        this.metadataModal.render({
            model: Utils.getNestedProperty("metadata", this._getObjState('model')),
            lang: this.lang.toUpperCase(),
            el: this.$el.find(s.MODAL_METADATA_CONTAINER)
        });

        this._bindFrontFaceEventListeners();

    };

    Box.prototype._bindFrontFaceEventListeners = function () {

        var self = this;

        this.$el.find(s.FRONT_FACE).find("[data-action]").each(function () {

            var $this = $(this),
                action = $this.data("action"),
                event = self._getEventTopic(action);

            $this.on("click", {event: event, box: self}, function (e) {
                e.preventDefault();

                log.info("Raise event: " + e.data.event);

                amplify.publish(event, {target: this, box: e.data.box, state: self.getState()});

            });
        });

    };

    Box.prototype._showFrontTab = function (tab, opts) {
        log.info('Show tab ' + tab);
        log.info(opts);

        var tabs = this.tabs;

        //check if it is a valid tab
        if (!tabs[tab]) {
            log.error("Error on show tab content: " + tab);

            this._setObjState("error", {code: ERR.MISSING_TAB});

            this._setStatus("error");

            return;
        }

        var currentTab = this._getObjState("tab"),
            currentOpts = this._getObjState("tabOpts");

        //TODO check if currentTab is undefined

        if (currentTab === tab && _.isEqual(currentOpts, opts)) {
            log.info("Aborting show tab current tab is equal to selected one");
            return;
        }

        if (this._getObjState("tabs." + tab + ".suitable") !== true) {
            log.warn("Aborting show tab because selected tab is not suitable with current model");
            //TODO find first suitable tab and then raise error
            return;
        }

        log.info("Show '" + tab + "' tab for result id: " + this.id);

        //if opts is empty get default options
        if (!opts) {
            opts = Utils.getNestedProperty("tabOpts", this.tabs[tab])
        }

        this._setObjState("tab", tab);
        this._setObjState("tabOpts", opts);

        //hide all tabs and show the selected one
        //this.$el.find(s.CONTENT_READY).find("[data-section]").hide();
        //this.$el.find(s.CONTENT_READY).find("[data-section='" + tab + "']").show();
        this.$el.find(s.CONTENT_READY).attr("data-tab", this._getObjState("tab"));

        this._showTabContent();
    };

    Box.prototype._showTabContent = function () {

        var tabs = this.tabs,
            tab = this._getObjState("tab");

        if (!tabs[tab]) {
            log.error("Error on show tab content: " + tab);

            this._setObjState("error", {code: ERR.MISSING_TAB});

            this._setStatus("error");

            return;
        }

        if (tabs[tab].callback === 'once') {
            log.info("TODO")
        }

        this._setObjState("tabs." + tab + ".initialized", true);

        this._callTabInstanceMethod({tab: tab, method: "show", opt1: this._getObjState("tabOpts")});

    };

    Box.prototype._createTabInstance = function (tab) {

        var state = this._getObjState("tabStates." + tab) || {},
            registry = this.tabRegistry,
        //Note that for sync call the argument of require() is not an array but a string
            Tab = require(registry[tab].path),
            config = $.extend(true, {}, state, {
                $el: this._getTabContainer(tab),
                box: this,
                lang: this.lang,
                model: $.extend(true, {}, this._getObjState("model")),
                id: tab + "_" + this.id,
                environment: this._getObjState("environment")
            }),
            instance = new Tab(config);

        //Subscribe to tab events
        instance.on('filter', _.bind(this._onTabToolbarChangeEvent, this));

        instance.on('state', _.bind(this._onTabStateChangeEvent, this, tab));

        //cache the plugin instance
        this.front_tab_instances[tab] = instance;

        return instance;

    };

    Box.prototype._getTabInstance = function (tab, face) {

        return face === 'back' ? this.back_tab_instances[tab] : this.front_tab_instances[tab];
        //return this._getObjState("tabs." + tab + ".instance")
    };

    Box.prototype._getTabContainer = function (tab) {

        var $container = this.$el.find(s.FRONT_CONTENT).find("[data-section='" + tab + "']");

        if ($container.length === 0) {

            $container = $('<div data-section="' + tab + '"></div>');
            this.$el.find(s.FRONT_CONTENT).append($container)
        }

        return $container;
    };

    Box.prototype._checkSuitableTabs = function () {

        var registeredTabs = this.tabRegistry,
            tabsKeys = Object.keys(this.tabs);

        _.each(tabsKeys, _.bind(function (tab) {
            var conf = registeredTabs[tab];

            if (!conf) {
                log.error('Registration not found for "' + tab + ' tab".');
            }

            if (conf.path) {

                this._createTabInstance(tab);

                this._setObjState("tabs." + tab + ".suitable",
                    this._callTabInstanceMethod({tab: tab, method: 'isSuitable'}));

                log.info(tab + " tab is suitable? ", this._callTabInstanceMethod({tab: tab, method: 'isSuitable'}))

                if (this._getObjState("tabs." + tab + ".suitable") === true) {
                    this._showMenuItem(tab);
                } else {
                    this._hideMenuItem(tab);
                }

            } else {
                log.error('Impossible to find path configuration for "' + tab + ' tab".');
            }

        }, this));

        this._syncFrontTabs();

    };

    Box.prototype._showDefaultFrontTab = function () {

        var tab = this._getObjState("tab") || C.tab || CD.tab;

        this._showFrontTab(tab);
    };

    Box.prototype._syncFrontTabs = function () {
        log.info("Send front 'sync' signal");

        var tabsKeys = Object.keys(this.tabs);

        _.each(tabsKeys, _.bind(function (tab) {

            if (this._getObjState("tabs." + tab + ".suitable") === true) {

                this._callTabInstanceMethod({
                    tab: tab,
                    method: 'sync',
                    opt1: this._getObjState("sync") || {}
                });
            }

        }, this));

    };

    // Back face

    Box.prototype._renderBackFace = function () {
        log.info("Start rendering box back face");

        var faces = this._getObjState("faces");

        if (!_.contains(faces, 'back') || this.backFaceIsRendered === true) {
            log.warn("Abort 'front' face rendering. face is already rendered: " + this.backFaceIsRendered + ", confing render face: " + _.contains(faces, 'front'))
            return;
        }

        this.backFaceIsRendered = true;

        this._hideFilterError();

        this._createProcessSteps();

        this._renderProcessSteps();

        this._bindBackFaceEventListeners();

        this._updateBoxTitle();

    };

    Box.prototype._bindBackFaceEventListeners = function () {

        var self = this;

        this.$el.find(s.BTN_SIDEBAR).on("click", _.bind(function () {
            this.$el.find(s.SIDEBAR).toggleClass('hidden-xs hidden-sm');
        }, this));


        this.$el.find(s.BACK_FACE).find("[data-action]").each(function () {

            var $this = $(this),
                action = $this.data("action"),
                event = self._getEventTopic(action);

            $this.on("click", {event: event, box: self}, function (e) {
                e.preventDefault();

                log.info("Raise box event: " + e.data.event);

                amplify.publish(event, {target: this, box: e.data.box, state: self.getState()});

            });
        });

    };

    Box.prototype._createProcessSteps = function () {

        var filterConfiguration = this._createBackTabConfiguration("filter"),
            aggregationConfiguration = this._createBackTabConfiguration("aggregations"),
            mapConfiguration = this._createBackTabConfiguration("map");

        this.processSteps = [];

        if (this._stepControlAccess("metadata")) {
            this.processSteps.push({
                tab: "metadata",
                id: "metadata",
                model: $.extend(true, {}, this._getObjState("model")),
                labels: {
                    title: i18nLabels["step_metadata"]
                }
            });
        }

        if (this._stepControlAccess("filter")) {
            this.processSteps.push({
                id: "filter",
                tab: "filter",
                values: filterConfiguration.values,
                config: filterConfiguration.config,
                template: filterConfiguration.template,
                onReady: filterConfiguration.onReady,
                labels: {
                    title: i18nLabels["step_filter"]
                }
            });
        }

        if (this._stepControlAccess("aggregations")) {
            this.processSteps.push({
                id: "aggregations",
                tab: "filter",
                values: aggregationConfiguration.values,
                config: aggregationConfiguration.filter,
                template: aggregationConfiguration.template,
                labels: {
                    title: i18nLabels["step_aggregations"]
                }
            });
        }

        if (this._stepControlAccess("map")) {
            this.processSteps.push({
                id: "map",
                tab: "filter",
                values: mapConfiguration.values,
                config: mapConfiguration.filter,
                template: mapConfiguration.template,
                onReady: mapConfiguration.onReady,
                labels: {
                    title: i18nLabels["step_map"]
                }
            });
        }
    };

    Box.prototype._stepControlAccess = function (tab) {

        var resourceType = this._getObjState("resourceRepresentationType");

        switch (tab.toLowerCase()) {
            case "metadata" :
                return true;
            case "filter" :
                return resourceType === 'dataset';
            case "aggregations" :
                return resourceType === 'dataset';
            case "map" :
                return this._getObjState("tabs.map.suitable");
            default :
                return false;
        }
    };

    Box.prototype._createBackTabConfiguration = function (tab) {

        var configuration,
            filterValues = this._getObjState("back_filter") || {},
            mapValues = this._getObjState("back_map") || {};

        switch (tab.toLowerCase()) {
            case 'aggregations':
                configuration = this._createBackAggregationTabConfiguration(filterValues[tab]);
                break;
            case 'filter':
                configuration = this._createBackFilterTabConfiguration(filterValues[tab]);
                break;
            case 'map':
                configuration = this._createBackMapTabConfiguration(mapValues[tab]);
                break;
            default :
                configuration = {};
        }

        return configuration;
    };

    Box.prototype._createBackFilterTabConfiguration = function (values) {

        var self = this,
            forbiddenIds = ["value"];

        var columns = Utils.getNestedProperty("metadata.dsd.columns", this._getObjState("model"))
                .filter(function (col) {
                    return !_.contains(forbiddenIds, col.id.toLowerCase());
                }).filter(function (col) {
                    return !col.id.endsWith("_" + self.lang.toUpperCase());
                }),
            config = Utils.createConfiguration({
                model: this._getObjState("model"),
                common : {
                    selector : {
                        hideSummary : true
                    }
                }
            });

        _.each(config, function (item, key) {

            config[key] = $.extend(true, {}, item, {
                template: {
                    hideSwitch: false
                }
            });

        });

        return {

            values: values,

            config: config,

            template: Handlebars.compile($(Template).find(s.FILTER_FILTER_TEMPLATE)[0].outerHTML)({columns: columns}),

            onReady: _.bind(function () {

                var mySwiper = new Swiper(this.$el.find(s.ROWS_SWIPER), {
                    // Optional parameters
                    //direction: 'vertical',
                    //loop: true,

                    // If we need pagination
                    pagination: this.$el.find(s.ROWS_SWIPER).find('.swiper-pagination'),
                    paginationClickable: true,

                    // Navigation arrows
                    nextButton: this.$el.find(s.ROWS_SWIPER).find('.swiper-button-next'),
                    prevButton: this.$el.find(s.ROWS_SWIPER).find('.swiper-button-prev'),

                    slidesPerView: 'auto',
                    centeredSlides: true,
                    //spaceBetween: 30,
                    freeMode: true,
                    simulateTouch: false

                    // And if we need scrollbar
                    //scrollbar: '.swiper-scrollbar',
                })

            }, this)

        };
    };

    Box.prototype._createBackMapTabConfiguration = function (values) {

        return {

            values: values,

            filter: {
                layers: {
                    selector: {
                        id: "tree",
                        source: _.map(mapEarthstatLayers, function (layer) {

                            var title = layer.Title.replace('area', '').replace('3857', '');

                            /*value: {
                             urlWMS: "http://fenix.fao.org/demo/fenix/geoserver/earthstat/wms",
                             layers: 'earthstat:'+layer.Name,
                             layertitle: layer.Title,
                             opacity: '0.8',
                             lang: 'EN'
                             }*/

                            return {
                                label: _str.humanize(title),
                                value: 'earthstat:' + layer.Name
                            };
                        }),
                        config: {core: {multiple: true}}
                    },
                    "dependencies": {
                        "layergroups": {id: "focus", event: "select"}
                    },
                    template: {
                        title: "Select layers to show on map",
                        hideSwitch: true,
                        hideRemoveButton: true
                    }
                }
            },

            template: Handlebars.compile($(Template).find(s.FILTER_MAP_TEMPLATE)[0].outerHTML)({layers: []}),

            onReady: _.bind(function (payload) {

            }, this)

        };
    };

    Box.prototype._createBackAggregationTabConfiguration = function (values) {

        var source = this._getSourceForAggregationTabConfiguration();

        return {

            values: values,

            filter: {
                aggregations: {
                    selector: {
                        id: "sortable",
                        source: source, // Static data
                        config: {
                            groups: {
                                dimensions: i18nLabels['aggregations_dimensions'],
                                group: i18nLabels['aggregations_group'],
                                sum: i18nLabels['aggregations_sum'],
                                avg: i18nLabels['aggregations_avg'],
                                first: i18nLabels['aggregations_first'],
                                last: i18nLabels['aggregations_last']
                            }
                        }
                    }
                }
            },

            template: Handlebars.compile($(Template).find(s.FILTER_AGGREGATION_TEMPLATE)[0].outerHTML)(i18nLabels)
        };
    };

    Box.prototype._getSourceForAggregationTabConfiguration = function () {

        //TODO integrate fenixTool

        var source = [],
            lang = this.lang,
            columns = Utils.getNestedProperty("metadata.dsd.columns", this._getObjState("model"));

        _.each(columns, function (c) {

            var title = Utils.getNestedProperty("title", c),
                label;

            if (typeof title === 'object' && title[lang]) {
                label = title[lang];
            } else {
                window.fx_vis_box_missing_title >= 0 ? window.fx_vis_box_missing_title++ : window.fx_vis_box_missing_title = 0;
                label = "Missing dimension title [" + c.id + "]";
            }

            if (!c.id.endsWith("_" + lang.toUpperCase())) {

                source.push({
                    value: c.id,
                    parent: "dimensions",
                    label: label
                });

            }
        });

        return source;
    };

    Box.prototype._renderProcessSteps = function () {

        var self = this,
            readyEventCounter = 0,
            list = this.processSteps;

        _.each(list, _.bind(function (step, index) {

            var template = Handlebars.compile($(Template).find("[data-role='step-" + step.tab + "']")[0].outerHTML),
                $html = $(template($.extend(true, {}, step, i18nLabels, this._getObjState("model"))));

            this._bindStepLabelEventListeners($html, step);

            this.$processSteps.append($html);

            var registry = this.tabRegistry,
                Tab = require(registry[step.tab].path);

            //Add details container
            var $el = this.$processStepDetails.find("[data-tab='" + step.id + "']");
            if ($el.length === 0) {
                $el = $("<li data-tab='" + step.id + "'></li>");

                if (index !== 0) {
                    $el.hide();
                }
                this.$processStepDetails.append($el);
            }

            //render tab
            var Instance = new Tab({
                $el: $el,
                box: this,
                model: $.extend(true, {}, this._getObjState("model")),
                config: step.config,
                values: step.values || {},
                id: "step-" + step.id,
                labels: step.labels,
                template: step.template,
                onReady: step.onReady,
                environment: this.environment
            });

            if (typeof step.onReady === 'function') {
                Instance.on("ready", _.bind(step.onReady, this));
            }

            this.back_tab_instances[step.id] = Instance;

            onTabReady.call(this);

        }, this));

        function onTabReady() {

            readyEventCounter++;

            if (list.length === readyEventCounter) {

                //Remove disable from query btn
                this.$el.find(s.BACK_CONTENT).find(s.QUERY_BUTTON).attr("disabled", false);
                self._bindStepEventListeners();
                self._onBackTabsReady();
            }
        }
    };

    Box.prototype._onBackTabsReady = function () {

        var first = Object.keys(this.back_tab_instances)[0];

        this._showBackTab(first);

    };

    Box.prototype._bindStepLabelEventListeners = function ($html, step) {

        $html.on("click", {step: step}, _.bind(function (e) {

            this._showBackTab(e.data.step.id);

        }, this));
    };

    Box.prototype._showBackTab = function (tab) {

        //show details
        this.$processStepDetails.find(">li").hide();
        this.$processStepDetails.find(">li[data-tab='" + tab + "']").show();

        //active handler
        this.$processSteps.find("[data-tab]").removeClass("active");
        this.$processSteps.find("[data-tab='" + tab + "']").addClass("active");

        this.back_tab_instances[tab].show(this._getBackSyncModel());

    };

    Box.prototype._bindStepEventListeners = function () {

        var aggregationInstance = this.back_tab_instances["aggregations"],
            filterInstance = this.back_tab_instances["filter"];

        if (aggregationInstance && filterInstance) {

            filterInstance.on("change", _.bind(this._onBackFilterChangeEvent, this));
            aggregationInstance.on("change", _.bind(this._onBackFilterChangeEvent, this));
        }
    };

    Box.prototype._onBackFilterChangeEvent = function () {
        var valid = this._validateQuery();

        if (valid !== true) {
            this._printFilterError(valid);
            return;
        }

        this._syncBackTabs();

    };

    Box.prototype._getBackSyncModel = function () {

        var self = this,
            sync = {},
            source = [],
            values = this._getBackFilterValues(),
            aggregationsValues = Utils.getNestedProperty("aggregations.values.aggregations", values) || [],
            enabledColumns = Utils.getNestedProperty("filter.values", values) || {},
            enabledColumnsIds = Object.keys(enabledColumns),
            filterIsInitialized = !$.isEmptyObject(enabledColumns),
            resourceColumns = Utils.getNestedProperty("metadata.dsd.columns", this._getObjState("model")) || [],
            resourceColumnsIds = _.map(resourceColumns, function (col) {
                return col.id;
            }),
            disabledColumnsIds = _.without.apply(_, [resourceColumnsIds].concat(enabledColumnsIds)),
            valueDimension = _.findWhere(resourceColumns, {subject: "value"});

        if (filterIsInitialized === true) {

            _.each(aggregationsValues, _.bind(function (item) {

                if (!_.contains(disabledColumnsIds, item.value) || valueDimension.id === item.value) {
                    addToSource(item.value);
                }

            }, this));

            _.each(resourceColumnsIds, _.bind(function (id) {

                if (!_.contains(disabledColumnsIds, id) && !_.findWhere(source, {value: id})) {
                    addToSource(id)
                }

            }, this));

        } else {

            // if filter is not initialized get default source
            source = this._getSourceForAggregationTabConfiguration();
        }

        //add value dimension
        addToSource(valueDimension.id);

        if (source.length > 0) {
            Utils.assign(sync, "values.aggregations", source);
        }

        return sync;

        function addToSource(id) {

            var item = _.findWhere(aggregationsValues, {value: id}),
                inSource = _.findWhere(source, {value: id});

            if (!!inSource || !id) {
                log.trace("Not include dimension because already present: " + id);
                return;
            }

            if (!item) {
                source.push({
                    value: id,
                    parent: "dimensions",
                    label: _.findWhere(resourceColumns, {id: id}).title[self.lang]
                })
            } else {
                source.push(item);
            }
        }
    };

    Box.prototype._syncBackTabs = function () {

        var aggregationInstance = this.back_tab_instances["aggregations"],
            sync = this._getBackSyncModel();

        if (aggregationInstance) {
            aggregationInstance.setValues(sync);
        }
    };

    // Event binding and callbacks

    Box.prototype._bindEventListeners = function () {

        var self = this;

        amplify.subscribe(this._getEventTopic("remove"), this, this._onRemoveEvent);

        amplify.subscribe(this._getEventTopic("resize"), this, this._onResizeEvent);

        amplify.subscribe(this._getEventTopic("clone"), this, this._onCloneEvent);

        amplify.subscribe(this._getEventTopic("flip"), this, this._onFlipEvent);

        amplify.subscribe(this._getEventTopic("metadata"), this, this._onMetadataEvent);

        amplify.subscribe(this._getEventTopic("tab"), this, this._onTabEvent);

        amplify.subscribe(this._getEventTopic("minimize"), this, this._onMinimizeEvent);

        amplify.subscribe(this._getEventTopic("query"), this, this._onQueryEvent);

        amplify.subscribe(this._getEventTopic("filter"), this, this._onFilterEvent);

        amplify.subscribe(this._getEventTopic("download"), this, this._onDownloadEvent);

        this.$el.find(s.RIGHT_MENU).on('click', "a", function (e) {
            e.preventDefault();
        });

        this.$el.find(s.OTHER_CONTENT).find("[data-action]").each(function () {

            var $this = $(this),
                action = $this.data("action"),
                event = self._getEventTopic(action);

            $this.on("click", {event: event, box: self}, function (e) {
                e.preventDefault();

                log.info("Raise box event: " + e.data.event);

                amplify.publish(event, {target: this, box: e.data.box, state: self.getState()});

            });
        });

        //download events
        this.report.on("complete", function () {
            //TODO add feedback
        })

    };

    Box.prototype._onRemoveEvent = function (payload) {
        log.info("Listen to event: " + this._getEventTopic("remove"));
        log.info(payload);

        var r = confirm(i18nLabels.confirm_remove),
            state = $.extend(true, {}, this.getState());

        if (r == true) {
            amplify.publish(EVT['remove'], this);

            this._dispose();

            this._trigger("remove", state);
        } else {
            log.info("Abort remove");
        }

    };

    Box.prototype._onResizeEvent = function (payload) {
        log.info("Listen to event: " + this._getEventTopic("resize"));
        log.info(payload);

        if (payload.target && $(payload.target).data("size")) {

            var size = $(payload.target).data("size");
            log.info("Size: " + size);

            this._setSize(size);
        }

        //Exclude id for publish events
        amplify.publish(this._getEventTopic("resize", true), $.extend(true, {}, this.getState()));

        this._trigger("resize");
    };

    Box.prototype._onCloneEvent = function (payload) {
        log.info("Listen to event: " + this._getEventTopic("clone"));
        log.info(payload);

        //Exclude id for publish events
        amplify.publish(this._getEventTopic("clone", true), $.extend(true, {}, this.getState()))
    };

    Box.prototype._onFlipEvent = function (payload) {
        log.info("Listen to event: " + this._getEventTopic("flip"));
        log.info(payload);

        if (this._getObjState('face') !== "back") {
            this._flip("back");
        } else {
            this._flip("front");
        }

        log.info("Set box face to: " + this._getObjState('face'));

    };

    Box.prototype._onMetadataEvent = function (payload) {
        log.info("Listen to event: " + this._getEventTopic("metadata"));
        log.info(payload);

        this.$modal.modal('show');
    };

    Box.prototype._onMinimizeEvent = function (payload) {
        log.info("Listen to event: " + this._getEventTopic("minimize"));
        log.info(payload);

        var state = $.extend(true, {}, this.getState());

        //Exclude id for publish events
        amplify.publish(this._getEventTopic("minimize", true), state);

        this._trigger("minimize", state);

        this.dispose();
    };

    Box.prototype._onTabEvent = function (payload) {
        log.info("Listen to event: " + this._getEventTopic("tab"));
        log.info(payload);

        var opts = {};
        opts.type = $(payload.target).data("type");

        this._showFrontTab($(payload.target).data("tab"), opts);

    };

    Box.prototype._onTabToolbarChangeEvent = function (values) {

        if (!_.isEmpty(values.values)) {
            this._setObjState("sync.toolbar", values);
            this._syncFrontTabs();
        } else {
            log.warn("Abort sync");
        }

    };

    Box.prototype._onTabStateChangeEvent = function (tab, state) {

        this._setObjState("tabStates." + tab, state);
    };

    Box.prototype._onQueryEvent = function (payload) {
        log.info("Listen to event: " + this._getEventTopic("query"));
        log.info(payload);

        var valid = this._validateQuery();

        if (valid === true) {

            this._disposeFrontFace();

            this._enableFlip();

            var filterValues = this._getBackFilterValues(),
                hasFilterValues = false;

            //if filter values have changed
            if (!_.isEqual(filterValues, this._getObjState("back_filter"))) {

                this._setObjState("back_filter", $.extend(true, {}, filterValues));

                hasFilterValues = true;

                var process = this._createQuery(filterValues);

                log.info("D3P process", process);

                this._loadResource(process)
                    .then(
                        _.bind(this._onLoadResourceSuccess, this),
                        _.bind(this._onLoadResourceError, this));

            } else {
                log.warn("Abort resource filter because values have not changed");
            }

            var mapValues = this._getBackMapValues(),
                hasMapValues = false;

            //if map values have changed
            if (!_.isEqual(mapValues, this._getObjState("back_map"))) {

                hasMapValues = true;

                this._setObjState("back_map", $.extend(true, {}, mapValues));

                this._updateMap();

                if (!hasFilterValues) {

                    this.setStatus("ready");

                    this._flip("front");
                }


            } else {
                log.warn("Abort map update because values have not changed");
            }

            //if nothing has changed flid to front
            if (!hasMapValues && !hasMapValues) {

                this.setStatus("ready");

                this._flip("front");
            }

        } else {
            this._printFilterError(valid);
        }

    };

    Box.prototype._updateMap = function () {

        if (this._getObjState("tabs.map.suitable") !== true) {
            log.warn("Abort map update because map table is not suitable for current resource");
            return;
        }

        var MapTabInstance = this.front_tab_instances['map'];

        console.log('_UPDATEMAP',this.front_tab_instances)
        //MapTabInstance.map.update( this._getObjState("back_map") );

        var filterValues = this._getObjState("back_map")['map']

        this.front_tab_instances['map'].addLayersByFilter( filterValues );
    };

    Box.prototype._onDownloadEvent = function (payload) {
        log.info("Listen to event: " + this._getEventTopic("download"));
        log.info(payload);

        var target = $(payload.target).attr("data-target") || "";

        switch (target.toLocaleLowerCase()) {
            case "data":
                log.info("Data download");
                this._downloadData();
                break;
            case "metadata":
                log.info("Metadata download");
                this._downloadMetadata();
                break;
            default :
                log.warn("Unknown download target");

        }
    };

    Box.prototype._downloadData = function () {

        var payload = {
            resource: this._getObjState("model"),
            input: {
                config: {}
            },
            output: {
                config: {
                    lang: this.lang.toUpperCase()
                }
            }
        };

        log.info("Configure FENIX export: tableExport");

        this.report.init('tableExport');

        log.info(payload);

        this.report.exportData({
            config: payload
        });
    };

    Box.prototype._downloadMetadata = function () {

        var model = this._getObjState("model"),
            title = Utils.getNestedProperty("metadata.title", model) || {},
            fileName = title[this.lang] ? title[this.lang] : "fenix_export",
            contextSystem = Utils.getNestedProperty("metadata.dsd.contextSystem", model),
            template = contextSystem === 'uneca' ? contextSystem : 'fao';

        var payload = {
            resource: {
                metadata: {
                    uid: Utils.getNestedProperty("metadata.uid", model)
                },
                data: []
            },
            input: {
                config: {}
            },
            output: {
                config: {
                    template: template,
                    lang: this.lang.toUpperCase(),
                    fileName: fileName.replace(/[^a-z0-9]/gi, '_') + '.pdf'
                }
            }
        };

        log.info("Configure FENIX export: metadataExport");

        this.report.init('metadataExport');

        log.info(payload);

        this.report.exportData({
            config: payload
        });
    };

    Box.prototype._onFilterEvent = function (payload) {
        log.info("Listen to event: " + this._getEventTopic("filter"));
        log.info(payload);

        this._forceFilterResource();
    };

    // flip

    Box.prototype._flip = function (side) {

        var face = side || "front";

        if (face !== "front") {
            this.$el.find(s.FLIP_CONTAINER).addClass(C.flippedClassName || CD.flippedClassName);
        } else {
            this.$el.find(s.FLIP_CONTAINER).removeClass(C.flippedClassName || CD.flippedClassName);
        }

        this._setObjState('face', face);

    };

    Box.prototype._disableFlip = function () {
        this.$el.find(s.FLIP_BUTTONS).attr("disabled", true);
    };

    Box.prototype._enableFlip = function () {
        this.$el.find(s.FLIP_BUTTONS).attr("disabled", false);
    };

    // error handling

    Box.prototype._printFilterError = function (errors) {

        var err = {},
            $message = $("<ul class='list-unstyled'></ul>");

        _.each(errors, function (obj) {

            if (!err[obj.code]) {
                err[obj.code] = [];
            }

            err[obj.code].push(obj.label);

        });

        _.each(err, function (values, e) {

            var template = Handlebars.compile(i18nLabels[e]),
                text = template($.extend(true, {dimensions: values.join()}));

            $message.append($('<li>' + text + '</li>'))

        });

        this._showFilterError($message);
    };

    Box.prototype._showFilterError = function (err) {

        this.$el.find(s.BACK_FILTER_ERRORS).html(err).show();
    };

    Box.prototype._hideFilterError = function () {

        this.$el.find(s.BACK_FILTER_ERRORS).hide();
    };

    Box.prototype._getBackFilterValues = function () {

        var payload = {
            filter: this.back_tab_instances["filter"] ? this.back_tab_instances["filter"].getValues(null) : null,
            aggregations: this.back_tab_instances["aggregations"] ? this.back_tab_instances["aggregations"].getValues(null) : null
        };

        return $.extend(true, {}, payload);

    };

    Box.prototype._getBackMapValues = function () {

        var payload = {
            map: this.back_tab_instances["map"] ? this.back_tab_instances["map"].getValues(null) : null
        };

        return $.extend(true, {}, payload);

    };

    // Box menu

    Box.prototype._renderMenu = function () {

        if (this.hasMenu === true) {

            this.rightMenu = new JsonMenu({
                el: this.$el.find(s.RIGHT_MENU),
                model: RightMenuModel
            });

        } else {
            log.warn("Menu will not be rendered. Impossible to find container.")
        }

    };

    Box.prototype._showMenuItem = function (item) {

        if (this.hasMenu) {
            this.rightMenu.showItem(item);
        }
    };

    Box.prototype._hideMenuItem = function (item) {

        if (this.hasMenu) {
            this.rightMenu.hideItem(item);
        }
    };

    // Internal methods

    Box.prototype._callTabInstanceMethod = function (obj) {

        var Instance = this._getTabInstance(obj.tab, obj.face);

        if (Instance && $.isFunction(Instance[obj.method])) {

            return Instance[obj.method](obj.opt1, obj.opt2);

        } else {
            log.error(name + " tab does not implement the mandatory " + method + "() fn");
        }

    };

    Box.prototype._trigger = function (channel) {
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

    Box.prototype._setStatus = function (status) {
        log.info("Set '" + status + "' status for result id: " + this.id);

        this._setObjState("status", status);

        this.$el.find(s.BOX).attr("data-status", this._getObjState("status"));

        switch (this._getObjState("status").toLowerCase()) {
            case "error" :

                var error = this._getObjState("error");

                this.$el.find(s.ERROR_TEXT).html(i18nLabels[error.code] ? i18nLabels[error.code] : error.code);

                //hide/show filter button
                if (error.filter === true) {
                    this.$el.find(s.ERROR_BUTTON).show();
                } else {
                    this.$el.find(s.ERROR_BUTTON).hide();
                }

                break;
        }

    };

    Box.prototype._setSize = function (size) {

        //TODO check if it is a valid size

        if (this._getObjState("size") === size) {
            log.info("Aborting resize because current size is equal to selected one");
            return;
        }

        var state = $.extend(true, {}, this.getState());

        this._setObjState("size", size);

        this.$el.find(s.BOX).attr("data-size", this._getObjState("size"));

        amplify.publish(EVT["resize"], this);

        this._trigger("resize", state);

    };

    Box.prototype._getEventTopic = function (evt, excludeId) {

        var baseEvent = EVT[evt] ? EVT[evt] : evt;

        return excludeId === true ? baseEvent : baseEvent + "." + this.id;
    };

    Box.prototype._forceFilterResource = function () {

        this._disableFlip();

        this._flip("back");

        this._renderBackFace();

        this._setStatus("ready");

    };

    // Disposition

    Box.prototype._dispose = function () {

        this._unbindEventListeners();

        this._disposeBoxFaces();

        this.$el.remove();

        delete this;

    };

    Box.prototype._disposeBoxFaces = function () {

        this._disposeFrontFace();

        this._disposeBackFace();

    };

    Box.prototype._disposeFrontFace = function () {

        var tabs = this.front_tab_instances,
            keys = Object.keys(tabs);

        _.each(keys, _.bind(function (tab) {

            this._callTabInstanceMethod({tab: tab, method: "dispose"});

        }, this));

        if (this.metadataModal && $.isFunction(this.metadataModal.dispose)) {
            this.metadataModal.dispose();
        }

        this.$el.find(s.FRONT_FACE).find("[data-action]").off();

        this.frontFaceIsRendered = false;

    };

    Box.prototype._disposeBackFace = function () {

        var tabs = this.back_tab_instances,
            keys = Object.keys(tabs);

        _.each(keys, _.bind(function (tab) {

            this._callTabInstanceMethod({tab: tab, method: "dispose", face: "back"});

        }, this));

        this.$el.find(s.BACK_FACE).find("[data-action]").off();

        this.$processSteps.empty();

        this.backFaceIsRendered = false;

    };

    Box.prototype._unbindEventListeners = function () {

        amplify.unsubscribe(this._getEventTopic("remove"), this._onRemoveEvent);

        amplify.unsubscribe(this._getEventTopic("resize"), this._onResizeEvent);

        amplify.unsubscribe(this._getEventTopic("clone"), this._onCloneEvent);

        amplify.unsubscribe(this._getEventTopic("flip"), this._onFlipEvent);

        amplify.unsubscribe(this._getEventTopic("metadata"), this._onMetadataEvent);

        amplify.unsubscribe(this._getEventTopic("tab"), this._onTabEvent);

        amplify.unsubscribe(this._getEventTopic("minimize"), this._onMinimizeEvent);

        amplify.unsubscribe(this._getEventTopic("query"), this._onQueryEvent);

        amplify.unsubscribe(this._getEventTopic("filter"), this._onFilterEvent);

        amplify.unsubscribe(this._getEventTopic("download"), this._onDownloadEvent);

        this.$el.find("[data-action]").off();

        this.$el.find(s.RIGHT_MENU).off();

        this.$el.find(s.OTHER_CONTENT).find("[data-action]").off();

    };

    // Utils

    Box.prototype._registerHandlebarsHelpers = function () {

        Handlebars.registerHelper('i18n', function (keyword) {

            var lang;

            try {
                lang = require.s.contexts._.config.i18n.locale;
            } catch (e) {
                lang = "EN";
            }

            return typeof keyword === 'object' ? keyword[lang.toUpperCase()] : "";
        });

    };

    return Box;
});
