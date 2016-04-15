const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Params = imports.misc.params;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Errors = Extension.imports.errors;
const File = Extension.imports.jsTextFile.JsTextFile;
const Utils = Extension.imports.utils;

const Settings = new Lang.Class({
    Name: 'Settings',
    _loadedSettings: null,
    _settings: null,
    _connectedSignals: [],
    logger: null,

    _jsonFileToDictionary: function(settingsFile) {
        if (settingsFile === undefined) {
            settingsFile = Extension.path + '/settings.json';
        }
        let jsonFile = new File(settingsFile);
        try {
            return JSON.parse(jsonFile.getLines().join(''));
        }
        catch (err) {
            if (err.name == 'SyntaxError') {
                throw new Errors.JsonError(settingsFile + ' is not a valid JSON file');
            }
            throw err;
        }
    },

    _createGioSettings: function(schema, schemaDir) {
        if (Utils.isValid(schemaDir)) {
            schemaDir = Gio.File.new_for_path(schemaDir);
        }
        else {
            schemaDir = Extension.dir.get_child('schemas');
        }
        let schemaSource;
        const GioSSS = Gio.SettingsSchemaSource;
        if (schemaDir.query_exists(null)) {
            schemaSource = GioSSS.new_from_directory(schemaDir.get_path(), GioSSS.get_default(), false);
        }
        else {
            schemaSource = GioSSS.get_default();
        }
        let schemaObj = schemaSource.lookup(schema, true);
        if (!schemaObj) {
            throw new Error('Schema ' + schema + ' could not be found for extension ' + Extension.metadata.uuid +
                '. Please check your installation.');
        }

        this._settings = new Gio.Settings({
            settings_schema: schemaObj
        });
    },

    _getFlatRecursive: function(toFlatten, resultDict) {
        for (let element in toFlatten) {
            if (toFlatten.hasOwnProperty(element)) {
                if (element == 'type') {
                    continue;
                }
                if (this._isContainer(toFlatten[element])) {
                    resultDict[element] = toFlatten[element];
                    this._getFlatRecursive(toFlatten[element], resultDict);
                    continue;
                }
                resultDict[element] = toFlatten[element];
            }
        }
    },

    _getFlatSettings: function() {
        let resultDict = {};
        this._getFlatRecursive(this._loadedSettings, resultDict);
        return resultDict;
    },

    _init: function(params) {
        let parameters = Params.parse(params, {
            settingsFile: undefined,
            schema: null,
            schemaDir: null,
            logger: null
        });
        if (typeof parameters.logger == 'undefined' || parameters.logger === null) {
            this.logger = Utils.getDefaultLogger();
            this.logger.warning('Using default logger instead of injected one');
        }
        else {
            this.logger = parameters.logger;
        }
        this._loadedSettings = this._jsonFileToDictionary(parameters.settingsFile);
        this._flatSettings = this._getFlatSettings();
        this._createGioSettings(parameters.schema, parameters.schemaDir);
        this._connectedSignals = [];
    },

    _getProperty: function(element, property, errorValue, inCategory) {
        let setting = this._getSetting(element, inCategory);
        if (!Utils.isChildValid(setting, property)) {
            return errorValue;
        }
        return setting[property];
    },

    getType: function(name, inCategory) {
        return this._getProperty(name, 'type', null, inCategory);
    },

    getValueObject: function(setting) {
        return this._getProperty(setting, 'value_object', null);
    },

    getSignature: function(setting) {
        return this._getProperty(setting, 'signature', null);
    },

    exists: function(setting) {
        return Utils.isValid(this._getSetting(setting));
    },

    _translatePath: function(path) {
        return path.replace('$HOME', GLib.get_home_dir()).replace('~', GLib.get_home_dir());
    },

    _getFromSchema: function(setting) {
        if (this.getType(setting) == 'boolean') {
            return this._settings.get_boolean(setting);
        }
        if (this.getType(setting) == 'string') {
            return this._settings.get_string(setting);
        }
        if (this.getType(setting) == 'path') {
            return this._translatePath(this._settings.get_string(setting));
        }
        if (this.getType(setting) == 'integer') {
            return this._settings.get_int(setting);
        }
        if (this.getType(setting) == 'dictionary') {
            let valueObject = this.getValueObject(setting);
            let value = this._settings.get_value(setting);
            if (valueObject !== null) {
                let dictionary = value.unpack();
                let valueArray = valueObject.split('.');
                let ctr = Extension.imports;
                for (let element in valueArray) {
                    if (valueArray.hasOwnProperty(element)) {
                        ctr = ctr[valueArray[element]];
                    }
                }
                for (let key in dictionary) {
                    if (dictionary.hasOwnProperty(key)) {
                        dictionary[key] = new ctr(dictionary[key]);
                    }
                }
                return dictionary;
            }
            return value.deep_unpack();
        }
        if (this.getType(setting) == 'shortcut') {
            return this._settings.get_strv(setting)[0];
        }
        return null;
    },

    _keyExistsInSchema: function(setting) {
        return (this._settings.list_keys().indexOf(setting) != -1);
    },

    _jsonHasDefault: function(setting) {
        return Utils.isChildValid(this._getSetting(setting), 'default_value');
    },

    _getDefaultFromJson: function(setting) {
        return this._getProperty(setting, 'default_value', null);
    },

    _getTypeBasedDefault: function(setting) {
        if (this.getType(setting) == 'boolean') {
            return false;
        }
        if (this.getType(setting) == 'string') {
            return '';
        }
        if (this.getType(setting) == 'path') {
            return this._translatePath('~');
        }
        if (this.getType(setting) == 'integer') {
            return 0;
        }
        if (this.getType(setting) == 'dictionary') {
            return [];
        }
        this.logger.error('Could not return correct value for ' + setting);
        return null;

    },

    get: function(setting) {
        if (this.getType(setting) === null) {
            return null;
        }
        if (this._keyExistsInSchema(setting)) {
            return this._getFromSchema(setting);
        }
        if (this._jsonHasDefault(setting)) {
            this.logger.info(setting + ' not found in schema, using default value from json file');
            return this._getDefaultFromJson(setting);
        }
        this.logger.info(setting + ' not found in schema, trying to use type-based default value');
        return this._getTypeBasedDefault(setting);
    },

    set: function(setting, value) {
        this.logger.debug('Setting ' + setting + ' to ' + value);

        if (this.getType(setting) == 'boolean') {
            this._settings.set_boolean(setting, value);
            return;
        }

        if (this.getType(setting) == 'string' || this.getType(setting) == 'path') {
            if (typeof value == 'string') {
                this._settings.set_string(setting, value);
                return;
            }
            else {
                throw new Errors.SettingsTypeError(setting, 'string', value);
            }
        }

        if (this.getType(setting) == 'integer') {
            if (typeof value == 'number') {
                this._settings.set_int(setting, value);
                return;
            }
            else {
                throw new Errors.SettingsTypeError(setting, 'integer', value);
            }
        }

        if (this.getType(setting) == 'dictionary') {
            let variant = null;
            if (this.getValueObject(setting) !== null) {
                let keyType = new GLib.VariantType(this.getSignature(setting)).element().key();
                let dictToWrite = [];
                for (let key in value) {
                    if (value.hasOwnProperty(key)) {
                        dictToWrite.push(GLib.Variant.new_dict_entry(new GLib.Variant(keyType.dup_string(),
                            key), value[key].toVariant()));
                    }
                }
                variant = GLib.Variant.new_array(null, dictToWrite);
            }
            else {
                variant = new GLib.Variant(this.getSignature(setting), value);
            }
            this._settings.set_value(setting, variant);
            return;
        }

        if (this.getType(setting) == 'shortcut') {
            this._settings.set_strv(setting, [value]);
            return;
        }
        this.logger.error('Trying to set non-existing setting ' + setting);
    },

    getGioSettings: function() {
        return this._settings;
    },

    registerForChange: function(setting, callback) {
        this.logger.debug('Registering ' + callback + ' for ' + setting);
        try {
            this._connectedSignals.push(this._settings.connect('changed::' + setting, callback));
        }
        catch (err) {
            this.logger.error('Could not register for changed signal on setting ' + setting + ' : ' + err);
        }
    },

    unregisterCallbacks: function() {
        if (this._connectedSignals !== null) {
            this._connectedSignals.forEach(Lang.bind(this, function(signal) {
                if (signal !== undefined && signal !== null && signal !== 0) {
                    this._settings.disconnect(signal);
                }
            }));
        }
        this._connectedSignals = [];
    },

    getCategory: function(name) {
        let [setting, category, subcontainer] = this._recursiveSearch(name, this._loadedSettings);
        if (!Utils.isValid(setting)) {
            return null;
        }
        return category;
    },

    getSubContainer: function(name) {
        let [setting, category, subcontainer] = this._recursiveSearch(name, this._loadedSettings);
        if (!Utils.isValid(setting)) {
            return null;
        }
        if (Utils.isValid(this._loadedSettings[category][name])) {
            // TODO: the recursive search function should handle this case
            return null;
        }
        return subcontainer;
    },

    getAllInCategory: function(category) {
        if (!Utils.isValid(this._loadedSettings[category])) {
            return [];
        }
        let toReturn = [];
        let catArr = this._loadedSettings[category];
        for (let key in catArr) {
            if (catArr.hasOwnProperty(key)) {
                if (key == 'type') {
                    continue;
                }
                if (this._isSubcontainer(catArr[key])) {
                    for (let subkey in catArr[key]) {
                        if (catArr[key].hasOwnProperty(subkey)) {
                            if (subkey == 'type') {
                                continue;
                            }
                            toReturn.push([subkey, catArr[key][subkey]]);
                        }
                    }
                    continue;
                }
                toReturn.push([key, catArr[key]]);
            }
        }
        return toReturn;
    },

    getAllInSubcontainer: function(category, subcontainer) {
        if (!Utils.isChildValid(this._loadedSettings[category], subcontainer)) {
            return [];
        }
        let toReturn = [];
        for (let key in this._loadedSettings[category][subcontainer]) {
            if (this._loadedSettings[category][subcontainer].hasOwnProperty(key)) {
                if (key == 'type') {
                    continue;
                }
                toReturn.push([key, this._loadedSettings[key]]);
            }
        }
        return toReturn;
    },

    getAll: function(type) {
        let toReturn = [];
        for (let setting in this._flatSettings) {
            if (this.getType(setting) == type) {
                toReturn.push([setting, this._loadedSettings[setting]]);
            }
        }
        return toReturn;
    },

    getAllCategories: function() {
        let toReturn = [];
        for (let category in this.getAll('category')) {
            if (this.getAll('category').hasOwnProperty(category)) {
                toReturn.push(this.getAll('category')[category][0]);
            }
        }
        return toReturn;
    },

    getAllSubContainers: function(category) {
        let toReturn = [];
        for (let element in this._loadedSettings[category]) {
            if (this._loadedSettings[category].hasOwnProperty(element)) {
                if (element == 'type') {
                    continue;
                }
                let subElement = this._loadedSettings[category][element];
                if (!Utils.isValid(subElement.type)) {
                    continue;
                }
                if (this._isSubcontainer(subElement)) {
                    toReturn.push(element);
                }
            }
        }
        return toReturn;
    },

    getSummary: function(setting) {
        return this._getProperty(setting, 'summary', '');
    },

    getHumanName: function(setting) {
        return this._getProperty(setting, 'human_name', setting);
    },

    getHelp: function(setting) {
        return this._getProperty(setting, 'help', '');
    },

    getExtraParams: function(setting) {
        return this._getProperty(setting, 'extra_params', null);
    },

    getWidget: function(setting) {
        return this._getProperty(setting, 'widget', 'default');
    },

    getLevel: function(setting) {
        return this._getProperty(setting, 'level', '0');
    },

    _isContainer: function(element) {
        if (element.type == 'category') {
            return true;
        }
        return this._isSubcontainer(element);
    },

    _isSubcontainer: function(element) {
        if (element.type == 'subcategory') {
            return true;
        }
        if (element.type == 'subsection') {
            return true;
        }
        return false;
    },

    _recursiveSearch: function(needle, haystack, lastCategory, lastSubcontainer) {
        lastCategory = Utils.getDefaultIfInvalid(lastCategory, null);
        lastSubcontainer = Utils.getDefaultIfInvalid(lastSubcontainer, null);
        for (let element in haystack) {
            if (haystack.hasOwnProperty(element)) {
                let result = null;
                if (this._isContainer(haystack[element])) {
                    if (this._isSubcontainer(haystack[element])) {
                        lastSubcontainer = element;
                    }
                    else {
                        lastCategory = element;
                    }
                    [result, lastCategory, lastSubcontainer] = this._recursiveSearch(needle, haystack[element],
                        lastCategory, lastSubcontainer);
                }
                if (element == needle) {
                    result = haystack[element];
                }
                if (result !== null) {
                    return [result, lastCategory, lastSubcontainer];
                }
            }
        }
        return [null, lastCategory, lastSubcontainer];
    },

    _getSetting: function(name, inCategory) {
        let searchRoot = Utils.getDefaultIfInvalid(this._loadedSettings[inCategory], this._loadedSettings);
        let [setting, category, subcontainer] = this._recursiveSearch(name, searchRoot);
        if (setting === null) {
            this.logger.info('Non-existing setting requested: ' + name);
        }
        return setting;
    },

    hasSubcategories: function(category) {
        let subcontainers = this.getAllSubContainers(category);
        for (let i in subcontainers) {
            if (this._getSetting(subcontainers[i]).type == 'subcategory') {
                return true;
            }
        }
        return false;
    }
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
