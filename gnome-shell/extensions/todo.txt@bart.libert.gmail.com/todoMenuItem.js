const Clutter = imports.gi.Clutter;
const Ellipsize = imports.gi.Pango.EllipsizeMode;
const Gdk = imports.gi.Gdk;
const Lang = imports.lang;
const Params = imports.misc.params;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Shared = Extension.imports.sharedConstants;
const UrlHighlighter = Extension.imports.urlHighlighter;
const Utils = Extension.imports.utils;

const TodoMenuItem = new Lang.Class({
    Name: 'TodoMenuItem',
    Extends: PopupMenu.PopupBaseMenuItem,
    labelExpanded: false,
    ellipsizeMode: Shared.TASK_ELLIPSIZE_MIDDLE,
    maxWidth: undefined,
    buttons: [],
    settings: null,
    task: null,

    _RGBAColorToHex: function(rgbaColor) {
        return (0 + (Math.round(rgbaColor * 255)).toString(16)).slice(-2);
    },

    _RGBAStringtoHexString: function(rgbaColorSting) {
        let rgbaColor = new Gdk.RGBA();
        rgbaColor.parse(rgbaColorSting);
        return '#' + this._RGBAColorToHex(rgbaColor.red) + '' +
            this._RGBAColorToHex(rgbaColor.green) + '' +
            this._RGBAColorToHex(rgbaColor.blue);
    },

    expandLabel: function() {
        if (!this.labelExpanded) {
            let singleLineWidth = this.label.clutter_text.get_preferred_width(-1)[1];
            let singleLineHeight = this.label.clutter_text.get_preferred_height(-1)[1];
            let numberOfLinesNeeded = Math.round((singleLineWidth / this.maxWidth) + 1);

            this.label.clutter_text.set_ellipsize(Ellipsize.NONE);
            this.label.clutter_text.set_line_wrap(true);
            this.label.clutter_text.set_line_wrap_mode(imports.gi.Pango.WrapMode.WORD_CHAR);
            this.label.set_height(numberOfLinesNeeded * singleLineHeight);

            this.labelExpanded = true;
            for (let i = 0, len = this.buttons.length; i < len; i++) {
                this.buttons[i].set_style('margin-bottom: ' + (numberOfLinesNeeded - 1) * singleLineHeight +
                    'px;');
            }
        }
    },

    _convertEllipsizeMode: function(configEllipsizeMode) {
        if (this.ellipsizeMode == Shared.TASK_ELLIPSIZE_START) {
            return Ellipsize.START;
        }
        if (this.ellipsizeMode == Shared.TASK_ELLIPSIZE_MIDDLE) {
            return Ellipsize.MIDDLE;
        }
        return Ellipsize.END;
    },

    contractLabel: function() {
        if (this.labelExpanded) {
            this.label.clutter_text.set_ellipsize(this._convertEllipsizeMode(this.ellipsizeMode));
            this.label.clutter_text.set_line_wrap(false);
            this.label.clutter_text.set_line_wrap_mode(imports.gi.Pango.WrapMode.WORD_CHAR);
            this.label.set_height(-1);
            this.labelExpanded = false;
            for (let i = 0, len = this.buttons.length; i < len; i++) {
                this.buttons[i].set_style('margin-bottom: 0px;');
            }
        }
    },

    _truncate: function(expansionMode) {
        this.label.clutter_text.set_ellipsize(this._convertEllipsizeMode(this.ellipsizeMode));
        this.label.set_reactive(true);
        if (expansionMode == Shared.TASK_EXPAND_SCROLL || expansionMode == Shared.TASK_EXPAND_BOTH) {
            this.label.connect('scroll-event', Lang.bind(this, function(o, e) {
                if (e.get_scroll_direction() == Clutter.ScrollDirection.UP) {
                    this.contractLabel();
                    return;
                }
                if (e.get_scroll_direction() == Clutter.ScrollDirection.DOWN) {
                    this.expandLabel();
                    return;
                }
            }));
        }
        this.label.set_style('max-width: ' + this.maxWidth + 'px');
    },

    _addLabel: function(labelSource) {
        let label = new St.Label({
            text: '',
            x_align: St.Align.END
        });
        if (this.task[labelSource] !== null) {
            label.set_text(this.task[labelSource].join());
            this.addActor(label);
        }
    },

    _addProjectsLabel: function() {
        if (this.settings.get('show-projects-label')) {
            this._addLabel('projects');
        }
    },

    _addContextsLabel: function() {
        if (this.settings.get('show-contexts-label')) {
            this._addLabel('contexts');
        }
    },

    _createTextLabel: function() {
        let markupFunction = function(url, color) {
            return '<span foreground="' + color + '"><u>' + url + '</u></span>';
        };
        let urlColor = this.settings.get('url-color');
        if (urlColor == Shared.URL_COLOR_TASK) {
            markupFunction = function(url, color) {
                return '<u>' + url + '</u>';
            };
        }
        if (urlColor == Shared.URL_COLOR_CUSTOM) {
            let hexColor = this._RGBAStringtoHexString(this.settings.get('custom-url-color'));
            markupFunction = function(url, color) {
                return '<span foreground="' + hexColor + '"><u>' + url + '</u></span>';
            };
        }
        let highlighter = new UrlHighlighter.TaskURLHighlighter(this.task.text, false, true, markupFunction);
        this.label = highlighter.actor;
        this.label.x_expand = true;
    },

    _addButtons: function() {
        let expansionMode = this.settings.get('long-tasks-expansion-mode');
        if (expansionMode == Shared.TASK_EXPAND_BUTTON || expansionMode == Shared.TASK_EXPAND_BOTH) {
            this._addExpandButton();
        }
        if (this.settings.get('show-done-or-archive-button')) {
            if (!this.task.complete) {
                this._addDoneButton();
            }
            else {
                this._addArchiveButton();
            }
        }
        if (this.settings.get('show-delete-button')) {
            this._addDeleteButton();
        }
        if (this.settings.get('show-edit-button')) {
            this._addEditButton();
        }
        if (this.settings.get('show-priority-buttons')) {
            this._addPriorityButtons();
        }
    },

    _addEditButton: function() {
        let editButton = this._createButton('input-keyboard-symbolic',
            _('Edit %(task)'.replace('%(task)', this.task.text)));
        editButton.connect('clicked', Lang.bind(this, function() {
            this.taskActions.editAction(this.task);
        }));
        this.addActor(editButton);
    },

    _addPriorityButton: function(up) {
        let prioButton = this._createButton('go-' + ((up === true) ? 'up' : 'down') + '-symbolic', (up ===
                true) ?
            _('Increase %(task) priority'.replace('%(task)', this.task.text)) :
            _('Decrease %(task) priority'.replace('%(task)', this.task.text)));
        let _up = up;
        prioButton.connect('clicked', Lang.bind(this, function() {
            this.taskActions.priorityAction(this.task, _up);
        }));
        this.addActor(prioButton);
    },

    _addPriorityButtons: function() {
        this._addPriorityButton(true);
        this._addPriorityButton(false);
    },

    _addArchiveButton: function() {
        let archiveButton = this._createButton('document-save-symbolic',
            _('Archive %(task)'.replace('%(task)', this.task.text)));
        archiveButton.connect('clicked', Lang.bind(this, function() {
            this.taskActions.archiveAction(this.task);
        }));
        this.actor.add_style_class_name('doneTaskItem');
        this.addActor(archiveButton);
    },

    _addDeleteButton: function() {
        let deleteButton = this._createButton('edit-delete-symbolic',
            _('Delete %(task)'.replace('%(task)', this.task.text)));
        deleteButton.connect('clicked', Lang.bind(this, function() {
            this.taskActions.deleteAction(this.task);
        }));
        this.addActor(deleteButton);
    },


    _addExpandButton: function() {
        let iconNames = [
            'view-more-symbolic',
            'content-loading-symbolic',
            'zoom-in-symbolic',
            'zoom-original-symbolic',
            'view-more',
            'content-loading',
            'zoom-in',
            'zoom-original'
        ];

        let expandButton = this._createButton(Utils.getFirstExistingIcon(iconNames),
            _('Expand %(task)'.replace('%(task)', this.task.text)));
        expandButton.connect('clicked', Lang.bind(this, function() {
            if (this.labelExpanded) {
                this.contractLabel();
            }
            else {
                this.expandLabel();
            }
        }));
        this.addActor(expandButton);
    },

    _addDoneButton: function() {
        let doneButton = this._createButton('object-select-symbolic',
            _('Mark %(task) as done'.replace('%(task)', this.task.text)));
        doneButton.connect('clicked', Lang.bind(this, function() {
            this.taskActions.doneAction(this.task);
        }));
        this.addActor(doneButton);
    },

    _createButton: function(icon, accessible_name) {
        let button = new St.Button({
            child: new St.Icon({
                icon_name: icon,
                y_expand: false
            }),
            y_align: St.Align.START,
            reactive: true,
            can_focus: true,
            track_hover: true,
            style_class: 'todo-txt-task-button',
            y_expand: false,
            y_fill: false
        });
        if (Utils.isValid(accessible_name)) {
            button.set_accessible_name(accessible_name);
        }
        this.buttons.push(button);
        return button;
    },

    _applyPriorityStyling: function() {
        if (!this.settings.get('style-priorities')) {
            return;
        }
        let markup = this.settings.get('priorities-markup')[this.task.priority];
        if (!Utils.isValid(markup)) {
            return;
        }
        let style = '';
        if (markup.changeColor === true) {
            style = style + 'color:' + markup.color.to_string() + ';';
        }
        if (markup.bold === true) {
            style = style + 'font-weight: bold;';
        }
        if (markup.italic === true) {
            style = style + 'font-style: italic;';
        }
        this.actor.set_style(style);
    },

    _setClickAction: function() {
        this.connect('activate', Lang.bind(this, function() {
            switch (this.settings.get('click-action')) {
                case Shared.CLICK_ACTION_EDIT:
                    this.taskActions.editAction(this.task);
                    break;
                case Shared.CLICK_ACTION_DONE:
                    this.taskActions.doneAction(this.task);
                    break;
                default:
                    break;
            }
        }));
    },

    _init: function(task, settings, actions, params) {
        this.buttons = [];
        this.parent(params);
        this.taskActions = Params.parse(actions, {
            'doneAction': null,
            'archiveAction': null,
            'deleteAction': null,
            'editAction': null,
            'priorityAction': null
        });
        this.task = task;
        this.ellipsizeMode = settings.get('long-tasks-ellipsize-mode');
        this.maxWidth = settings.get('long-tasks-max-width');
        this.settings = settings;
        if (!('addActor' in TodoMenuItem.prototype)) {
            TodoMenuItem.prototype.addActor = function(element) {
                this.actor.add(element);
            };
        }
        this._createTextLabel();
        this.addActor(this.label);
        this._addProjectsLabel();
        this._addContextsLabel();
        this._addButtons();
        this._setClickAction();
        this._applyPriorityStyling();

        if (settings.get('truncate-long-tasks')) {
            this._truncate(settings.get('long-tasks-expansion-mode'));
        }

        this.label.set_track_hover(true);
        this.label.add_style_class_name('todo-txt-task-label');
    },
});
/* vi: set expandtab tabstop=4 shiftwidth=4: */
