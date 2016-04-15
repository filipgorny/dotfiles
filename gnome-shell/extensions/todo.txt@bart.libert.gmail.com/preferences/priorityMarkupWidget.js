const GObject = imports.gi.GObject;
const Gdk = imports.gi.Gdk;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const ButtonCellRenderer = Extension.imports.buttonCellRenderer;
const Markup = Extension.imports.markup.Markup;

const Gettext = imports.gettext.domain('todotxt');
const _ = Gettext.gettext;

const COL_PRIORITY = 0;
const COL_CHANGE_COLOR = 1;
const COL_COLOR = 2;
const COL_BOLD = 3;
const COL_ITALIC = 4;

const PriorityMarkupWidget = new GObject.Class({
    Name: 'PriorityMarkupWidget',
    GTypeName: 'PriorityMarkupWidget',
    Extends: Extension.imports.preferences.preferenceWidget.PreferenceWidget,

    _removePriorityStyle: function(priority) {
        if (priority === null) {
            log('Priority can not be null');
            return;
        }
        delete this.prioritiesMarkup[priority];
        this._settings.set('priorities-markup', this.prioritiesMarkup);
    },

    _updatePriorityStyling: function(priority, change_color, color, bold, italic, replace_prio) {
        if (priority === null) {
            log('Priority can not be null');
            return;
        }
        var currentValue = this.prioritiesMarkup[priority];
        if (typeof currentValue == 'undefined') {
            // create new tuple with default values
            this.prioritiesMarkup[priority] = new Markup();
            currentValue = this.prioritiesMarkup[priority];
        }
        if (change_color !== null) {
            if (change_color === true) {
                if (color !== null) {
                    currentValue.setColorFromString(color);
                }
            }
            currentValue.changeColor = change_color;
        }
        if (bold !== null) {
            currentValue.bold = bold;
        }
        if (italic !== null) {
            currentValue.italic = italic;
        }
        if (replace_prio != priority) {
            if ((replace_prio !== null) && (replace_prio !== undefined)) {
                delete this.prioritiesMarkup[replace_prio];
            }
        }
        this._settings.set('priorities-markup', this.prioritiesMarkup);
    },


    _checkPriorityCondition: function(model, check_function, message) {
        let [validIterator, iter] = model.get_iter_first();
        let result = true;
        let priority = '@';
        while (validIterator && result) {
            priority = model.get_value(iter, COL_PRIORITY);
            result = check_function(priority);
            validIterator = model.iter_next(iter);
        }
        if (!result) {
            let dialog = new Gtk.MessageDialog({
                buttons: Gtk.ButtonsType.OK,
                text: message + ': ' + priority,
                message_type: Gtk.MessageType.ERROR
            });
            dialog.run();
            dialog.destroy();
            return false;
        }
        return true;
    },

    _checkForInvalidPriorities: function(model) {
        return this._checkPriorityCondition(model, function(priority) {
                return (/^[A-Z]$/).test(priority);
            },
            _('Wrong priority'));
    },

    _checkForDuplicatePriorities: function(model) {
        let seenPriorities = [];
        let [validIterator, iter] = model.get_iter_first();
        while (validIterator) {
            let priority = model.get_value(iter, COL_PRIORITY);
            if (seenPriorities.indexOf(priority) == -1) {
                seenPriorities.push(priority);
            }
            else {
                let dialog = new Gtk.MessageDialog({
                    buttons: Gtk.ButtonsType.OK,
                    text: _('Duplicate priority: %(priority)').replace('%(priority)', priority),
                    message_type: Gtk.MessageType.ERROR
                });
                dialog.run();
                dialog.destroy();
                return false;
            }
            validIterator = model.iter_next(iter);
        }
        return true;
    },

    _validateModel: function(model) {
        if (!this._checkForDuplicatePriorities(model)) {
            return false;
        }
        if (!this._checkForInvalidPriorities(model)) {
            return false;
        }
        return true;
    },

    _updatePriorityStylingFromModelRow: function(model, row, replace_prio) {
        if (!this._validateModel(model)) {
            model.remove(row);
            return;
        }
        this._updatePriorityStyling(
            model.get_value(row, COL_PRIORITY), model.get_value(row, COL_CHANGE_COLOR), model.get_value(
                row,
                COL_COLOR), model.get_value(row, COL_BOLD), model.get_value(row, COL_ITALIC),
            replace_prio);
    },

    _buildToggleColumn: function(title, attribute_column, model) {
        let column = new Gtk.TreeViewColumn({
            'title': title,
            'expand': true
        });

        let renderer = new Gtk.CellRendererToggle({
            activatable: true
        });
        renderer.connect('toggled', Lang.bind(this, function(rend, iter) {
            let newActiveState = !rend.active;
            let [returnCode, row] = model.get_iter_from_string(iter);
            if (!returnCode) {
                throw new Error('Something is broken!');
            }
            model.set(row, [attribute_column], [newActiveState]);
            this._updatePriorityStylingFromModelRow(model, row);
        }));
        column.pack_start(renderer, true);
        column.add_attribute(renderer, 'active', attribute_column);
        return column;
    },

    _buildPriorityStyleWidget: function(model, row, priority, change_color, color, bold, italic) {
        let newRow = model.insert(row);
        model.set(newRow, [COL_PRIORITY, COL_CHANGE_COLOR, COL_COLOR, COL_BOLD, COL_ITALIC], [priority,
            change_color, color, bold, italic]);
    },

    _buildPrioritiesFromSettings: function(parentContainer, startRow) {
        this.prioritiesMarkup = this._settings.get('priorities-markup');
        let i = 1;
        for (let markup in this.prioritiesMarkup) {
            if (this.prioritiesMarkup.hasOwnProperty(markup)) {
                this._buildPriorityStyleWidget(parentContainer,
                    startRow + i,
                    markup,
                    this.prioritiesMarkup[markup].changeColor,
                    this.prioritiesMarkup[markup].color.to_string(),
                    this.prioritiesMarkup[markup].bold,
                    this.prioritiesMarkup[markup].italic);
                i = i + 1;
            }
        }
        return i;
    },

    _init: function(setting, settings) {
        this.parent(setting, settings, true);
        this.spacing = 6;
        this.orientation = Gtk.Orientation.VERTICAL;
        this.box.orientation = Gtk.Orientation.VERTICAL;

        let scroller = new Gtk.ScrolledWindow();
        let model = new Gtk.ListStore();
        model.set_column_types([
            GObject.TYPE_STRING, GObject.TYPE_BOOLEAN, GObject.TYPE_STRING, GObject.TYPE_BOOLEAN, GObject.TYPE_BOOLEAN
        ]);
        this._buildPrioritiesFromSettings(model, 1);
        let treeview = new Gtk.TreeView({
            'expand': true,
            'model': model
        });

        let prioCol = new Gtk.TreeViewColumn({
            'title': _('Priority'),
            'expand': true,
            'sort-indicator': true,
            'sort-column-id': COL_PRIORITY,
        });

        let prioRend = new Gtk.CellRendererText({
            editable: true
        });

        prioRend.connect('edited', Lang.bind(this, function(rend, iter, newPrio) {
            let [returnCode, row] = model.get_iter_from_string(iter);
            if (!returnCode) {
                throw new Error('Something is broken!');
            }
            let oldPrio = model.get_value(row, [COL_PRIORITY]);
            model.set(row, [COL_PRIORITY], [newPrio]);
            this._updatePriorityStylingFromModelRow(model, row, oldPrio);
        }));
        prioCol.pack_start(prioRend, true);
        prioCol.add_attribute(prioRend, 'text', COL_PRIORITY);

        treeview.append_column(prioCol);

        treeview.append_column(this._buildToggleColumn(_('Change color'), COL_CHANGE_COLOR, model));

        let colorCol = new Gtk.TreeViewColumn({
            'title': _('Color'),
            'expand': true,
        });

        let colorRend = new ButtonCellRenderer.ButtonCellRenderer({
            activatable: true
        });
        colorRend.connect('clicked', Lang.bind(this, function(rend, iter) {
            let [returnCode, row] = model.get_iter_from_string(iter);
            if (!returnCode) {
                throw new Error('Something is broken!');
            }
            let oldColor = new Gdk.RGBA();
            oldColor.parse(model.get_value(row, [COL_COLOR]));
            let colorChooser = new Gtk.ColorChooserDialog({
                modal: true,
                rgba: oldColor
            });
            if (colorChooser.run() == Gtk.ResponseType.OK) {
                let newColor_reference = new Gdk.RGBA();
                let newColor = colorChooser.get_rgba(newColor_reference);
                if (!(newColor instanceof Gdk.RGBA)) {
                    newColor = newColor_reference;
                }
                model.set(row, [COL_COLOR], [newColor.to_string()]);
                this._updatePriorityStylingFromModelRow(model, row);
            }
            colorChooser.destroy();
        }));
        colorCol.pack_start(colorRend, true);
        colorCol.add_attribute(colorRend, 'cell-background', COL_COLOR);
        colorCol.add_attribute(colorRend, 'sensitive', COL_CHANGE_COLOR);
        treeview.append_column(colorCol);

        treeview.append_column(this._buildToggleColumn(_('Bold'), COL_BOLD, model));
        treeview.append_column(this._buildToggleColumn(_('Italic'), COL_ITALIC, model));

        model.set_sort_column_id(COL_PRIORITY, Gtk.SortType.ASCENDING);
        scroller.add(treeview);
        this.box.add(scroller);

        let toolbar = new Gtk.Toolbar();
        toolbar.get_style_context().add_class(Gtk.STYLE_CLASS_INLINE_TOOLBAR);

        let addButton = new Gtk.ToolButton({
            stock_id: Gtk.STOCK_ADD,
            label: _('Add style'),
            is_important: true
        });
        toolbar.add(addButton);
        addButton.connect('clicked', Lang.bind(this, function() {
            let dialog = new Gtk.MessageDialog({
                buttons: Gtk.ButtonsType.OK_CANCEL,
                text: _('Please enter the priority'),
                message_type: Gtk.MessageType.QUESTION,
                title: _('New priority style'),
            });
            let dialogbox = dialog.get_content_area();
            let userentry = new Gtk.Entry();
            dialogbox.pack_end(userentry, false, false, 0);
            dialog.show_all();
            let response = dialog.run();
            let priority = userentry.get_text();
            if ((response == Gtk.ResponseType.OK) && (priority !== '')) {
                let newRow = model.insert(10);
                model.set(newRow, [COL_PRIORITY, COL_CHANGE_COLOR, COL_COLOR, COL_BOLD,
                    COL_ITALIC], [
                    priority, false, 'rgb(255,255,255)', false, false]);
                if (!this._validateModel(model)) {
                    model.remove(newRow);
                }
            }
            dialog.destroy();
        }));
        let deleteButton = new Gtk.ToolButton({
            stock_id: Gtk.STOCK_DELETE,
            label: _('Delete')
        });
        toolbar.add(deleteButton);
        deleteButton.connect('clicked', Lang.bind(this, function() {
            let [success, model, iter] = treeview.get_selection().get_selected();
            this._removePriorityStyle(model.get_value(iter, COL_PRIORITY));
            if (success) {
                model.remove(iter);
            }
        }));
        this.box.add(toolbar);
    }


});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
