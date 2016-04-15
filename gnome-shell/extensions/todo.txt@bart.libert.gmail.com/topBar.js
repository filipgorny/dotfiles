const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Params = imports.misc.params;
const St = imports.gi.St;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Formatter = Extension.imports.formatter.Formatter;
const Shared = Extension.imports.sharedConstants;
const Utils = Extension.imports.utils;

const Parser = Extension.imports.third_party.js_expression_eval.parser.Parser;

const TopBar = new Lang.Class({
    Name: 'TopBar',
    Extends: St.BoxLayout,
    buttonText: null,
    logger: null,
    icon: null,
    showIcon: false,
    hideIfPatternZero: Shared.HIDE_ON_PATTERN_ZERO_NOTHING,
    formatter: null,
    hidePattern: '',
    formatString: '{unarchived}',
    decorator: null,
    taskInfoProvider: null,
    settings: null,

    _init: function(params) {
        this.parent({
            style_class: 'panel-status-menu-box'
        });

        let parameters = Params.parse(params, {
            initialText: '...',
            logger: null,
            decorator: null,
            taskInfoProvider: null,
            settings: null
        });
        this.logger = Utils.getDefaultIfInvalid(parameters.logger, Utils.getDefaultLogger());


        if (parameters.taskInfoProvider === null) {
            this.logger.error('No taskInfoProvider specified!');
            return;
        }

        this.taskInfoProvider = parameters.taskInfoProvider;

        if (parameters.settings === null) {
            this.logger.error('No settings specified!');
            return;
        }

        this.settings = parameters.settings;
        this.formatString = this.settings.get('display-format-string');
        this.hidePattern = this.settings.get('hide-pattern');
        this.hideIfPatternZero = this.settings.get('hide-if-pattern-zero');
        this.showIcon = this.settings.get('show-status-icon');

        this.decorator = parameters.decorator;

        this.settings.registerForChange('display-format-string', Lang.bind(this, this._onSettingsChanged));
        this.settings.registerForChange('hide-pattern', Lang.bind(this, this._onSettingsChanged));
        this.settings.registerForChange('hide-if-pattern-zero', Lang.bind(this, this._onSettingsChanged));
        this.settings.registerForChange('show-status-icon', Lang.bind(this, this._onSettingsChanged));

        this._setupFormatter();
        this._createText(parameters.initialText);

        if (this.showIcon) {
            this._createIcon();
        }
    },

    _setupFormatter: function() {
        this.formatter = new Formatter(this.formatString, this.logger);
        if (Utils.isValid(this.decorator)) {
            this.decorator.addLoggingToNamespace(this.formatter);
        }
        this.formatter.setLeftDelimiter('{');
        this.formatter.setRightDelimiter('}');
        this.formatter.setTokenLength(0);
        this.formatter.setReplacement('unarchived', Lang.bind(this, function() {
            return this.taskInfoProvider.getNbOfUnarchivedTasks();
        }));
        this.formatter.setReplacement('undone', Lang.bind(this, function() {
            return this.taskInfoProvider.getNbOfUndoneTasks();
        }));
    },

    _createText: function(initialText) {
        this.buttonText = new St.Label({
            text: _(initialText),
            y_align: Clutter.ActorAlign.CENTER
        });
        try {
            this.buttonText.set_y_expand(true);
        }
        catch (exception) {
            this.logger.debug('Could not set y_expand: ' + exception.message);
        }
        this.buttonText.set_style('text-align:center;');
        this.add_child(this.buttonText);
    },

    _createIcon: function() {
        this.icon = new St.Icon({
            style_class: 'todo-txt-status-icon',
            icon_name: 'object-select-symbolic'
        });
        this.insert_child_below(this.icon, this.buttonText);
    },

    _setBusy: function(busy) {
        this._updateButtonText({
            'unarchived': '...',
            'undone': '...'
        });

        let iconNames = [
            'content-loading-symbolic',
            'content-loading',
            'emblem-synchronizing-symbolic',
            'emblem-synchronizing',
            'action-unavailable-symbolic',
            'action-unavailable'
        ];

        this._changeIcon(Utils.getFirstExistingIcon(iconNames));
    },

    _setError: function(error) {
        this._updateButtonText({
            'unarchived': ' X ',
            'undone': ' X '
        });
        this._changeIcon('dialog-error-symbolic');
    },

    _changeIcon: function(iconName) {
        if (!this.showIcon) {
            return;
        }
        this._showIcon();
        this.icon.icon_name = iconName;
    },

    _hideIfMatching: function() {
        this.get_parent().remove_style_class_name('panelButtonHidden');
        this.get_parent().add_style_class_name('panel-button');
        if (this.hideIfPatternZero == Shared.HIDE_ON_PATTERN_ZERO_NOTHING) {
            return;
        }
        try {
            let parsed = Parser.evaluate(this.formatter.getString({
                formatString: this.hidePattern
            }));
            if (parsed !== 0) {
                return;
            }
        }
        catch (exception) {
            this.logger.error('Error while parsing zero pattern: ' + exception);
            return;
        }
        if (this.hideIfPatternZero & Shared.HIDE_ON_PATTERN_ZERO_TEXT) {
            this.buttonText.set_text('');
        }
        if (this.hideIfPatternZero & Shared.HIDE_ON_PATTERN_ZERO_ICON) {
            this._hideIcon();
        }
        if (this.hideIfPatternZero == Shared.HIDE_ON_PATTERN_ZERO_BOTH) {
            this.get_parent().remove_style_class_name('panel-button');
            this.get_parent().add_style_class_name('panelButtonHidden');
        }
    },

    _updateButtonText: function(formatterOverrides) {
        let overrides = Utils.getDefaultIfInvalid(formatterOverrides, null);
        try {
            this.buttonText.set_text(this.formatter.getString({
                overrideReplacements: overrides
            }));
        }
        catch (exception) {
            this.logger.error('Error while parsing button pattern: ' + exception);
        }
    },

    _showIcon: function() {
        if (Utils.isValid(this.icon)) {
            this.icon.icon_name = 'object-select-symbolic';
            return;
        }
        this._createIcon();
    },

    _hideIcon: function() {
        if (!Utils.isValid(this.icon)) {
            return;
        }
        this.remove_child(this.icon);
        this.icon = null;
    },

    update: function(params) {
        let parameters = Params.parse(params, {
            busy: false,
            error: false
        });
        if (parameters.busy === true && parameters.error === true) {
            this.logger.error(
                'Top bar cannot be busy and in error at the same time. Using error as default');
            parameters.busy = false;
        }
        if (parameters.busy === true) {
            this._setBusy();
            return;
        }
        if (parameters.error === true) {
            this._setError();
            return;
        }
        this._updateButtonText();
        if (this.showIcon) {
            this._showIcon();
        }
        else {
            this._hideIcon();
        }
        this._hideIfMatching();
    },

    _onSettingsChanged: function() {
        this.formatString = this.settings.get('display-format-string');
        this.hidePattern = this.settings.get('hide-pattern');
        this.hideIfPatternZero = this.settings.get('hide-if-pattern-zero');
        this.showIcon = this.settings.get('show-status-icon');
        this.formatter.setFormatString(this.formatString);
        this.update();
    },
});
/* vi: set expandtab tabstop=4 shiftwidth=4: */
