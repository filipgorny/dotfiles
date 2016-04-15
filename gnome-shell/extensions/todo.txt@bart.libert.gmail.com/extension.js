// This extension was developed by Bart Libert
//
// Based on code by :
// * Baptiste Saleil http://bsaleil.org/
// * Arnaud Bonatti https://github.com/Obsidien
//
// Licence: GPLv2+
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const ConfirmDialog = Extension.imports.confirmDialog;
const EditDialog = Extension.imports.editDialog;
const Errors = Extension.imports.errors;
const JsTextFile = Extension.imports.jsTextFile;
const Message = Extension.imports.messageDialog.MessageDialog;
const MultiButtonDialog = Extension.imports.multiButtonDialog;
const ScrollablePopupMenu = Extension.imports.scrollablePopupMenu.ScrollablePopupMenu;
const Settings = Extension.imports.settings.Settings;
const Shared = Extension.imports.sharedConstants;
const TodoMenuItem = Extension.imports.todoMenuItem.TodoMenuItem;
const TopBar = Extension.imports.topBar.TopBar;
const Utils = Extension.imports.utils;

const Third = Extension.imports.third_party;
const Decorator = Third.logDecorator.logDecorator.LogDecorator;
const JsTodo = Third.jsTodoTxt.jsTodoTxt;

const Gettext = imports.gettext;
const _ = Gettext.domain('todotxt').gettext;

const schema = 'org.gnome.shell.extensions.TodoTxt';
const openKey = 'open-key';

let todoTxt;

const TodoTxtManager = new Lang.Class({
    Name: 'TodoTxtManager',
    Extends: PanelMenu.Button,
    schema: null,
    settings: null,
    autoarchive: false,
    tasks: null,
    debugLevel: Shared.LOG_ERROR,
    groupBy: null,
    groupUngrouped: false,
    monitor: null,
    volumeMonitor: null,
    linkMonitor: null,
    confirmDelete: true,
    decorator: null,
    logger: null,
    fileLoaded: false,

    _init: function(logger) {
        PanelMenu.Button.prototype._init.call(this, St.Align.START, 'todo.txt', true);
        this.schema = schema;
        this.logger = logger;
        this._initSettings();
        this._loadSettings();

        this.logger.setLevel(this.debugLevel);

        this.decorator = new Decorator();
        this.decorator.setLogger(this.logger.flow);

        this.popupMenu = new ScrollablePopupMenu(this.actor, St.Align.START, St.Side.TOP, logger);
        this.decorator.addLoggingToNamespace(this.popupMenu);

        this.setMenu(this.popupMenu);

        this.tasks = [];
        this.groupedTasksParameter = [];
        this.groupedTasksParameter[Shared.NO_GROUPING] = '';
        this.groupedTasksParameter[Shared.GROUP_BY_PROJECTS] = 'projects';
        this.groupedTasksParameter[Shared.GROUP_BY_CONTEXTS] = 'contexts';

        this.topbar = new TopBar({
            initialText: '[...]',
            logger: this.logger,
            decorator: this.decorator,
            taskInfoProvider: this,
            settings: this.settings
        });
        this.decorator.addLoggingToNamespace(this.topbar);

        this.topbar.update({
            busy: true
        });

        this.actor.add_actor(this.topbar);

        this._installShortcuts();

        this._refresh();
    },

    getNbOfUnarchivedTasks: function() {
        if (this.tasks === null) {
            return 0;
        }
        return this.tasks.length;
    },

    getNbOfUndoneTasks: function() {
        let count = 0;
        for (let i = 0, len = this.tasks.length; i < len; i++) {
            if (!this.tasks[i].complete) {
                count++;
            }
        }
        return count;
    },

    _createNewTaskEntry: function() {
        this.newTask = new St.Entry({
            name: 'newTaskEntry',
            hint_text: _('New task...'),
            track_hover: true,
            can_focus: true
        });

        this.newTask.add_style_class_name('search-entry');

        let tasksMenu = this.menu;
        let entryNewTask = this.newTask.clutter_text;

        entryNewTask.connect('key-press-event', Lang.bind(this, function(o, e) {
            let symbol = e.get_key_symbol();
            if ((symbol == Clutter.Return) || (symbol == Clutter.KP_Enter)) {
                tasksMenu.close();
                if (o.get_text() === '') {
                    return;
                }
                this.topbar.update({
                    busy: true
                });
                let newTask = new JsTodo.TodoTxtItem(o.get_text());
                this.decorator.addLoggingToNamespace(newTask);
                this.addTask(newTask);
            }
        }));
    },

    _launchEditDialog: function(task) {
        let oldTask = task;
        let editDialog = new EditDialog.EditDialog(Lang.bind(this, function(newTask) {
            this.modifyTask(oldTask, newTask, true);
        }));
        this.decorator.addLoggingToNamespace(editDialog);
        editDialog.open(task.toString());
    },

    _launchDeleteDialog: function(task) {
        let confirmDialog = new ConfirmDialog.ConfirmDialog(_('Confirm removal'), _(
            'Really delete the following task?') + '\n' + task.text, Lang.bind(this, function() {
            this.topbar.update({
                busy: true
            });
            this.removeTask(task);
        }));
        this.decorator.addLoggingToNamespace(confirmDialog);
        confirmDialog.open();
    },

    _createTodoItem: function(task) {
        let actions = {
            doneAction: Lang.bind(this, function(task) {
                this.topbar.update({
                    busy: true
                });
                this.completeTask(task);
            }),
            archiveAction: Lang.bind(this, function(task) {
                this.topbar.update({
                    busy: true
                });
                this.archiveTask(task);
            }),
            deleteAction: Lang.bind(this, function(task) {
                if (this.confirmDelete) {
                    this.menu.close();
                    this._launchDeleteDialog(task);
                }
                else {
                    this.topbar.update({
                        busy: true
                    });
                    this.removeTask(task);
                }
            }),
            editAction: Lang.bind(this, function(task) {
                this.menu.close();
                this._launchEditDialog(task);
            }),
            priorityAction: Lang.bind(this, function(task, up) {
                this.topbar.update({
                    busy: true
                });
                this.modifyTaskPriority(task, up);
            })
        };
        return new TodoMenuItem(task, this.settings, actions);
    },

    _initSettings: function() {
        let params = {
            settingsFile: Utils.getDefaultIfInvalid(Extension.path, Extension.metadata.path) +
                '/settings.json',
            schema: this.schema,
            logger: this.logger
        };
        this.settings = new Settings(params);
    },

    _loadSettings: function() {
        this.todofile = this.settings.get('todotxt-location');
        this.donefile = this.settings.get('donetxt-location');
        this.autoarchive = this.settings.get('auto-archive');
        this.debugLevel = this.settings.get('debug-level');
        this.groupBy = this.settings.get('group-by');
        this.groupUngrouped = this.settings.get('group-ungrouped');
        this.showNewTaskEntry = this.settings.get('show-new-task-entry');
        this.addCreationDate = this.settings.get('add-creation-date');
        this.showOpenInTextEditor = this.settings.get('show-open-in-text-editor');
        this.confirmDelete = this.settings.get('confirm-delete');
        this.priorityOnDone = this.settings.get('priority-on-done');
        this.showNumberOfGroupElements = this.settings.get('show-number-of-group-elements');
    },

    _connectSettingsSignals: function() {
        this.settings.registerForChange('auto-archive', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('todotxt-location', Lang.bind(this, this.onTodoFileChanged));
        this.settings.registerForChange('donetxt-location', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('debug-level', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('group-by', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('group-ungrouped', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('priorities-markup', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('show-done-or-archive-button', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('show-delete-button', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('show-projects-label', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('show-contexts-label', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('show-new-task-entry', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('show-open-in-text-editor', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('style-priorities', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('add-creation-date', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('show-edit-button', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('show-priority-buttons', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('click-action', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('open-key', Lang.bind(this, this.onShortcutChanged));
        this.settings.registerForChange('confirm-delete', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('url-color', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('custom-url-color', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('long-tasks-expansion-mode', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('truncate-long-tasks', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('long-tasks-max-width', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('long-tasks-ellipsize-mode', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('priority-on-done', Lang.bind(this, this.onParamChanged));
        this.settings.registerForChange('show-number-of-group-elements', Lang.bind(this, this.onParamChanged));
    },

    _refresh: function() {
        // Clear
        this.menu.removeAll();
        this.menu.clearBottomSection();

        let todoFile = null;
        // Sync
        try {
            todoFile = new JsTextFile.JsTextFile(this.todofile, this.logger);
        }
        catch (exception) {
            this.logger.info('File could not be read, showing \'no file\' menu');
            this._createNoFileMenu('todo.txt');
            return false;
        }

        this.decorator.addLoggingToNamespace(todoFile);
        if (!todoFile.exists()) {
            return false;
        }

        this._createTasksFromFile(todoFile.getLines());

        this._createTasksMenu();

        this.topbar.update();

        if (!this.showNewTaskEntry && !this.showOpenInTextEditor) {
            return true;
        }

        if (this.showNewTaskEntry) {
            this.menu.bottomSection.add((new PopupMenu.PopupSeparatorMenuItem()).actor);
            let newTaskSection = new PopupMenu.PopupMenuSection();
            this._createNewTaskEntry();
            newTaskSection.actor.add_actor(this.newTask);
            newTaskSection.actor.add_style_class_name('newTaskSection');
            this.menu.bottomSection.add(newTaskSection.actor);
            this.menu.connect('open-state-changed', Lang.bind(this, function(open) {
                if (open) {
                    this.newTask.grab_key_focus();
                }
            }));
        }

        if (this.showOpenInTextEditor) {
            this.menu.bottomSection.add((new PopupMenu.PopupSeparatorMenuItem()).actor);
            let editorSection = new PopupMenu.PopupMenuSection();
            let editorButton = new PopupMenu.PopupMenuItem(_('Open todo.txt file in text editor'));
            editorButton.connect('activate', Lang.bind(this, function(object, event) {
                try {
                    Gio.AppInfo.launch_default_for_uri(GLib.filename_to_uri(this.todofile, null),
                        global.create_app_launch_context(event.get_time(), 0));
                }
                catch (exception) {
                    let message = new Message(_('Cannot open file'),
                        _(
                            'An error occured while trying to launch the default text editor: %(error)'
                        ).replace('%(error)', exception.message));
                    message.open();
                }
            }));
            editorSection.addMenuItem(editorButton);
            this.menu.bottomSection.add(editorSection.actor);
        }

        return true;
    },

    _addTasksToMain: function(tasks) {
        tasks.sort(this.sortByPriority);
        for (let i = 0; i < tasks.length; i++) {
            let item = this._createTodoItem(tasks[i]);
            this.menu.addMenuItem(item);
        }
        return;
    },

    _createTaskGroups: function() {
        let groupedTasks = {};
        for (let i = 0; i < this.tasks.length; i++) {
            this._createGroupedTask(this.tasks[i], groupedTasks);
        }
        return groupedTasks;
    },

    _sortTaskGroups: function(groupedTasks) {
        for (let groupArray in groupedTasks) {
            if (groupedTasks.hasOwnProperty(groupArray)) {
                groupedTasks[groupArray].sort(this.sortByPriority);
            }
        }
    },

    _createGroupSubMenu: function(name, tasks) {
        let groupItem = new PopupMenu.PopupSubMenuMenuItem(name);
        for (let i = 0; i < tasks.length; i++) {
            let item = this._createTodoItem(tasks[i]);
            groupItem.menu.addMenuItem(item);
        }
        return groupItem;
    },

    _createTasksMenu: function() {
        if (this.groupBy == Shared.NO_GROUPING) {
            this._addTasksToMain(this.tasks);
            return;
        }
        let groupedTasks = this._createTaskGroups();
        this._sortTaskGroups(groupedTasks);
        for (let group in groupedTasks) {
            if (groupedTasks.hasOwnProperty(group)) {
                let groupItem = null;
                if (group == '"__nogroup__"') {
                    if (this.groupUngrouped) {
                        groupItem = this._createGroupSubMenu(_('Ungrouped'), groupedTasks[group]);
                    }
                    else {
                        this._addTasksToMain(groupedTasks[group]);
                        continue;
                    }
                }
                else {
                    groupItem = this._createGroupSubMenu(group.replace(/^"/, '').replace(/"$/, ''),
                        groupedTasks[group]);
                }
                if (this.showNumberOfGroupElements) {
                    groupItem.label.text += ' (' + groupedTasks[group].length + ')';
                }
                this.menu.addMenuItem(groupItem);
            }
        }
    },

    _createTasksFromFile: function(lines) {
        this.tasks.length = 0;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i] !== '' && lines[i] != '\n') {
                try {
                    let task = new JsTodo.TodoTxtItem(lines[i]);
                    this.decorator.addLoggingToNamespace(task);
                    this.tasks.push(task);
                }
                catch (exception) {
                    this.logger.debug('Error while reading task: ' + exception.message);
                }
            }

        }
    },

    _createGroupedTask: function(task, groupedTasks) {
        let groups = task[this.groupedTasksParameter[this.groupBy]];
        if (groups === null) {
            groups = ['__nogroup__'];
        }
        for (let group in groups) {
            if (groups.hasOwnProperty(group)) {
                let groupName = '"' + groups[group] + '"';
                if (typeof groupedTasks[groupName] == 'undefined') {
                    groupedTasks[groupName] = [task];
                }
                else {
                    groupedTasks[groupName].push(task);
                }
            }
        }
    },

    _get_symlink_target_absolute: function(symlinkGFile) {
        this.logger.debug('Getting absolute path for symlink ' + symlinkGFile.get_path());
        let parentDir = symlinkGFile.get_parent();
        if (parentDir === null) {
            parentDir = Gio.file_new_for_path('/');
        }
        let symlinkTarget = symlinkGFile.query_info('standard::symlink-target', 0, null).get_symlink_target();
        return parentDir.resolve_relative_path(symlinkTarget);
    },

    _linkChanged: function() {
        if (this._monitorFile()) {
            this._refresh();
        }
    },

    _create_link_monitor_if_necessary: function(path) {
        if (!Utils.isValid(path)) {
            return null;
        }
        let gFile = Gio.file_new_for_path(path);
        if (gFile.query_info('standard::is-symlink', 0, null).get_is_symlink()) {
            if (this.linkMonitor !== null) {
                this.linkMonitor.cancel();
            }
            this.linkMonitor = gFile.monitor(Gio.FileMonitorFlags.NONE, null);
            this.linkMonitor.connect('changed', Lang.bind(this, this._linkChanged));
            return this._get_symlink_target_absolute(gFile);
        }
        return null;
    },

    _get_g_file_for_path: function(path) {
        let gFile = Gio.file_new_for_path(path);
        if (!gFile.query_exists(null)) {
            return gFile;
        }
        let hardLink = this._create_link_monitor_if_necessary(path);
        if (hardLink !== null) {
            return hardLink;
        }
        return gFile;
    },

    _launchPreferences: function() {
        let runPrefs = 'gnome-shell-extension-prefs ' + Extension.metadata.uuid;
        Main.Util.trySpawnCommandLine(runPrefs);
    },

    _getDefaultConfigPath: function() {
        return GLib.build_pathv('/', [GLib.get_user_data_dir(), 'todo.txt']);
    },

    _fileExists: function(file) {
        if (GLib.file_test(file, GLib.FileTest.EXISTS)) {
            return true;
        }
        return false;
    },

    _createDefaultFileOrReuseExisting: function(path, fileName, setting) {
        let file = GLib.build_filenamev([path, fileName]);
        if (!this._fileExists(file)) {
            GLib.file_set_contents(file, '');
            this.settings.set(setting, file);
            return;
        }
        let useExistingButton = new MultiButtonDialog.ButtonMapping(_('Use existing file'), null,
            Lang.bind(this, function() {
                this.logger.debug('Using existing file');
                this.settings.set(setting, file);
            }));
        let overwriteExistingButton = new MultiButtonDialog.ButtonMapping(_('Create new file'), null,
            Lang.bind(this, function() {
                this.logger.debug('Creating new file');
                GLib.file_set_contents(file, '');
                this.settings.set(setting, file);
            }));
        let openSettingsButton = new MultiButtonDialog.ButtonMapping(_('Open settings'), Clutter.Return,
            Lang.bind(this, function() {
                this._launchPreferences();
            }));
        let cancelButton = new MultiButtonDialog.ButtonMapping(_('Cancel'), Clutter.Escape, null);
        let buttons = [useExistingButton, overwriteExistingButton, openSettingsButton, cancelButton];
        let dialog = new MultiButtonDialog.MultiButtonDialog(
            _('%(file) exists already').replace('%(file)', file),
            _('Please choose what you want to do'),
            buttons
        );
        dialog.open();
    },

    _createDefaultFiles: function() {
        let createPath = this._getDefaultConfigPath();
        GLib.mkdir_with_parents(createPath, 493);
        this._createDefaultFileOrReuseExisting(createPath, 'todo.txt', 'todotxt-location');
        this._createDefaultFileOrReuseExisting(createPath, 'done.txt', 'donetxt-location');
    },

    _createNoFileMenu: function(file) {
        this.topbar.update({
            error: true
        });
        let errorItem = new PopupMenu.PopupMenuItem(
            _('No valid %(filename) file specified').replace('%(filename)', file));
        let chooseItem = new PopupMenu.PopupMenuItem('> ' + _('Select location in settings'));
        chooseItem.connect('activate', Lang.bind(this, function() {
            this._launchPreferences();
        }));
        let createItem = new PopupMenu.PopupMenuItem('> ' + _(
            'Create todo.txt and done.txt file in %(path)').replace(
            '%(path)', this._getDefaultConfigPath()));
        createItem.connect('activate', Lang.bind(this, function() {
            this._createDefaultFiles();
        }));
        this.menu.removeAll();
        this.menu.clearBottomSection();
        this.menu.addMenuItem(errorItem);
        this.menu.addMenuItem(chooseItem);
        this.menu.addMenuItem(createItem);
    },

    _monitored: function(monitor, file, other_file, event) {
        if (this._checkForFile()) {
            this._refresh();
        }
    },

    _mountChanged: function() {
        this.logger.debug('Mount changed, checking if file exists');
        if (this._checkForFile()) {
            this._refresh();
        }
    },

    _monitorMounts: function() {
        this.volumeMonitor = Gio.VolumeMonitor.get();
        this.volumeMonitor.connect('mount-added', Lang.bind(this, this._mountChanged));
        this.volumeMonitor.connect('mount-removed', Lang.bind(this, this._mountChanged));
    },

    _checkForFile: function() {
        try {
            let jsTextFile = new JsTextFile.JsTextFile(this.todofile, this.logger);
            this.decorator.addLoggingToNamespace(jsTextFile);
            this.logger.debug('File found: ' + this.todofile);
            if (this.fileLoaded === false) {
                this._create_link_monitor_if_necessary(this.todofile);
            }
            this.fileLoaded = true;
            return true;
        }
        catch (exception) {
            this.logger.info('File could not be monitored, showing \'no file\' menu');
            this._createNoFileMenu('todo.txt');
            this.fileLoaded = false;
            return false;
        }
    },

    _monitorFile: function() {
        this._cancel_monitors();
        let fileM = this._get_g_file_for_path(this.todofile);
        this.logger.debug('Monitoring ' + fileM.get_path());
        this.monitor = fileM.monitor(Gio.FileMonitorFlags.WATCH_MOUNTS | Gio.FileMonitorFlags.WATCH_MOVES,
            null);
        this.monitor.connect('changed', Lang.bind(this, this._monitored));
        if (this._checkForFile()) {
            this._refresh();
        }
    },

    _enable: function() {
        let menuManager = Main.panel._menus || Main.panel.menuManager;
        menuManager.addMenu(this.menu);

        this._monitorFile();
        this._monitorMounts();
        this._connectSettingsSignals();
    },

    _cancel_monitors: function() {
        if (this.monitor !== null) {
            if (!this.monitor.cancel()) {
                this.debug.error('Could not cancel file monitor');
            }
            this.monitor = null;
        }
        if (this.linkMonitor !== null) {
            if (!this.linkMonitor.cancel()) {
                this.debug.error('Could not cancel link monitor');
            }
            this.linkMonitor = null;
        }
    },

    _disable: function() {
        let menuManager = Main.panel._menus || Main.panel.menuManager;
        menuManager.removeMenu(this.menu);
        this._cancel_monitors();
        global.display.remove_keybinding(openKey);
        this.settings.unregisterCallbacks();
    },

    onTodoFileChanged: function() {
        this._loadSettings();
        this._cancel_monitors();
        if (this._monitorFile()) {
            this._refresh();
            return;
        }
    },


    onParamChanged: function(self, key) {
        this.logger.debug(key + ' has changed to ' + this.settings.get(key));
        if (key == 'auto-archive') {
            this.autoarchive = this.settings.get('auto-archive');
            return;
        }
        if (key == 'donetxt-location') {
            this.donefile = this.settings.get('donetxt-location');
            this._refresh();
            return;
        }
        if (key == 'debug-level') {
            this.debugLevel = this.settings.get('debug-level');
            this.logger.setLevel(this.debugLevel);
            return;
        }
        if (key == 'add-creation-date') {
            this.addCreationDate = this.settings.get('add-creation-date');
            return;
        }
        if (key == 'priority-on-done') {
            this.priorityOnDone = this.settings.get('priority-on-done');
            return;
        }
        this._loadSettings();
        this._refresh();
    },

    _addKeyBinding: function(key, keyFunction) {
        if (Main.wm.addKeybinding) {
            let mode = Shell.ActionMode;
            if (typeof mode == 'undefined') {
                mode = Shell.KeyBindingMode;
            }
            Main.wm.addKeybinding(key, this.settings.getGioSettings(), Meta.KeyBindingFlags.NONE,
                mode.ALL, keyFunction);
            return;
        }
        global.display.add_keybinding(key, this.settings.getGioSettings(), Meta.KeyBindingFlags.NONE,
            keyFunction);
    },

    _removeKeyBinding: function(key) {
        if (Main.wm.removeKeybinding) {
            Main.wm.removeKeybinding(key);
        }
        else {
            global.display.remove_keybinding(key);
        }
    },

    _installShortcuts: function() {
        this._addKeyBinding(openKey, Lang.bind(this, function() {
            this.menu.open();
        }));
    },

    onShortcutChanged: function() {
        this._removeKeyBinding(openKey);
        this._loadSettings();
    },

    removeTask: function(task) {
        let index = this.tasks.indexOf(task);
        if (index == -1) {
            this.logger.debug('Task not found');
            return false;
        }
        this.tasks.splice(index, 1);
        return this.saveTasksToFile();
    },

    addTask: function(task) {
        if (this.addCreationDate) {
            task.date = new Date();
        }
        this.tasks.push(task);
        return this.saveTasksToFile();
    },

    modifyTask: function(oldTask, newTask, save) {
        let index = this.tasks.indexOf(oldTask);
        if (index == -1) {
            this.logger.debug('Task not found');
            return false;
        }
        this.tasks[index] = newTask;
        if (save) {
            return this.saveTasksToFile();
        }
        return true;
    },

    _modifyTaskPriorityOnComplete: function(task) {
        if (this.priorityOnDone == Shared.TASK_DONE_PRIORITY_REMOVE) {
            task.priority = null;
            return;
        }
        if (this.priorityOnDone == Shared.TASK_DONE_PRIORITY_KEEP_PRI) {
            task.text += ' pri:' + task.priority;
            task.priority = null;
            return;
        }
    },

    completeTask: function(task) {
        let doneTask = new JsTodo.TodoTxtItem(task.toString());
        this.decorator.addLoggingToNamespace(doneTask);
        doneTask.complete = true;
        doneTask.completed = new Date();
        if (doneTask.priority !== null) {
            this._modifyTaskPriorityOnComplete(doneTask);
        }
        // Modify tasks list, but don't save yet
        if (!this.modifyTask(task, doneTask, false)) {
            return false;
        }
        // If autoarchive is on, archive task and save both files
        if (this.autoarchive) {
            return this.archiveTask(doneTask);
        }
        // If autoarchive is off, only save todo.txt file
        return this.saveTasksToFile();
    },

    archiveTask: function(task) {
        if (!task.complete) {
            this.logger.debug('archiveTask: trying to archive task that is not done');
            return false;
        }
        try {
            let jsTextFile = new JsTextFile.JsTextFile(this.donefile, this.logger);

            this.decorator.addLoggingToNamespace(jsTextFile);
            if (!jsTextFile.addLine(task.toString())) {
                this.logger.debug('Could not add task to done file');
            }
            jsTextFile.saveFile(true);
            return this.removeTask(task);
        }
        catch (exception) {
            let title = _('Error writing file');
            let message = null;
            if (exception.type == Errors.TodoTxtErrorTypes.FILE_WRITE_PERMISSION_ERROR ||
                exception.type == Errors.TodoTxtErrorTypes.FILE_WRITE_ERROR) {
                message = new Message(title, exception.message);
            }
            else if (exception instanceof Errors.IoError) {
                this._createNoFileMenu('done.txt');
            }
            else {
                message = new Message(title,
                    _('Unknown error during file write: %(error)').replace('%(error)', exception.toString())
                );
            }
            message.open();
        }
        return false;
    },

    _traverseChars: function(char, prev) {
        let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if (char == chars.charAt(0) && prev) {
            return char;
        }
        if (char == chars.charAt(chars.length - 1) && !prev) {
            return char;
        }
        if ((typeof char == 'undefined' || char === null) && prev) {
            this.logger.debug('undefined char, returning ' + chars.charAt(0));
            return chars.charAt(0);
        }
        if ((typeof char == 'undefined' || char === null) && !prev) {
            this.logger.debug('undefined char, returning ' + chars.charAt(chars.length - 1));
            return chars.charAt(chars.length - 1);
        }
        return chars.charAt(chars.indexOf(char) + ((prev === true) ? -1 : 1));
    },

    modifyTaskPriority: function(task, higher) {
        let newTask = new JsTodo.TodoTxtItem(task.toString());
        this.decorator.addLoggingToNamespace(newTask);
        this.logger.debug('Modify' + task.toString() + ', higher:' + higher);
        newTask.priority = this._traverseChars(task.priority, higher);
        return this.modifyTask(task, newTask, true);
    },

    saveTasksToFile: function() {
        let jsTextFile = new JsTextFile.JsTextFile(this.todofile, this.logger);
        this.decorator.addLoggingToNamespace(jsTextFile);
        let textArray = [];
        for (let i = 0; i < this.tasks.length; i++) {
            textArray[i] = this.tasks[i].toString();
        }
        jsTextFile.setLines(textArray);
        try {
            return jsTextFile.saveFile(true);
        }
        catch (exception) {
            let title = _('Error writing file');
            let message = null;
            if (exception.type == Errors.TodoTxtErrorTypes.FILE_WRITE_PERMISSION_ERROR ||
                exception.type == Errors.TodoTxtErrorTypes.FILE_WRITE_ERROR) {
                message = new Message(title, exception.message);
            }
            else {
                message = new Message(title, _('Unknown error during file write: %(error)').replace(
                    '%(error)', exception.toString()));
            }
            message.open();
        }
        return false;
    },

    sortByPriority: function(a, b) {
        if (a.priority === null) {
            if (b.priority === null) {
                return 0;
            }
            // Convention: 'null' has smaller priority then everything else
            return 1;
        }
        if (b.priority === null) {
            // Case a==null, b==null already covered
            return -1;
        }
        return (a.priority.charCodeAt(0) - b.priority.charCodeAt(0));
    }
});

function enable() {
    let logger = Utils.getDefaultLogger();

    let path = Utils.getDefaultIfInvalid(Extension.path, Extension.metadata.path);
    let theme = imports.gi.Gtk.IconTheme.get_default();
    theme.append_search_path(path + '/icons');

    Utils.initTranslations(Extension);

    todoTxt = new TodoTxtManager(logger);
    let decorator = new Decorator();
    decorator.setLogger(logger.flow);
    decorator.addLoggingToNamespace(todoTxt);
    todoTxt._enable();
    Main.panel.addToStatusArea('todoTxt', todoTxt);
}

function disable() {
    todoTxt._disable();
    todoTxt.destroy();
    todoTxt = null;
}

/* vi: set expandtab tabstop=4 shiftwidth=4: */
