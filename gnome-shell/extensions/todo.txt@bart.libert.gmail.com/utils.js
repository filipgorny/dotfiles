const GLib = imports.gi.GLib;
const Gettext = imports.gettext;
const Gtk = imports.gi.Gtk;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Logger = Extension.imports.third_party.logger.logger.Logger;
const Shared = Extension.imports.sharedConstants;

function getDefaultLogger() {
    let logger = new Logger();
    logger.setPrefix('[todo.txt]');
    logger.addLevel('error', '[ERROR  ]', Shared.LOG_ERROR);
    logger.addLevel('warning', '[WARNING]', Shared.LOG_WARNING);
    logger.addLevel('info', '[INFO   ]', Shared.LOG_INFO);
    logger.addLevel('detail', '[DETAIL ]', Shared.LOG_DETAIL);
    logger.addLevel('debug', '[DEBUG  ]', Shared.LOG_DEBUG);
    logger.addLevel('flow', '[FLOW   ]', Shared.LOG_FLOW);
    if (getDefaultLogger.caller.name != 'enable') {
        logger.warning('Using default logger instead of injected one');
    }
    return logger;
}

function isValid(object) {
    if (typeof object == 'undefined') {
        return false;
    }
    if (object === null) {
        return false;
    }
    return true;
}

function isChildValid(object, child) {
    if (!isValid(object)) {
        return false;
    }
    return isValid(object[child]);
}

function getDefaultIfInvalid(object, defaultValue) {
    if (!isValid(object)) {
        return defaultValue;
    }
    return object;
}

function initTranslations(extension) {
    let localeDir = extension.dir.get_child('locale').get_path();

    // Extension installed in .local
    if (GLib.file_test(localeDir, GLib.FileTest.EXISTS)) {
        Gettext.bindtextdomain('todotxt', localeDir);
    }
    // Extension installed system-wide
    else {
        Gettext.bindtextdomain('todotxt', extension.metadata.locale);
    }
}

function getFirstExistingIcon(names) {
    if (!isValid(names)) {
        return '';
    }
    let theme = Gtk.IconTheme.get_default();
    for (let i = 0, len = names.length; i < len; i++) {
        if (theme.has_icon(names[i])) {
            return names[i];
        }
    }
    return '';
}

/* vi: set expandtab tabstop=4 shiftwidth=4: */
