const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Extension.imports.settings.Settings;
const Utils = Extension.imports.utils;


const schema = 'org.gnome.shell.extensions.TodoTxt';

function init() {
    Utils.initTranslations(Extension);
}

function buildPrefsWidget() {
    let prefs = new Prefs(schema);
    return prefs.buildPrefsWidget();
}

const Prefs = new Lang.Class({
    Name: 'Prefs',
    settings: null,
    hiddenTabs: [],
    hiddenSections: [],
    shownSections: [],

    _removeFromArray: function(array, toRemove) {
        for (let remove in toRemove) {
            if (toRemove.hasOwnProperty(remove)) {
                let index = array.indexOf(toRemove[remove]);
                if (index > -1) {
                    array.splice(index, 1);
                }
            }
        }
    },

    _showHiddenSectionsIfApplicable: function() {
        let updated = false;
        let removeMe = [];
        for (let section in this.hiddenSections) {
            if (this.hiddenSections[section][1].isVisible()) {
                this.hiddenSections[section][0].add(this.hiddenSections[section][1]);
                updated = true;
                removeMe.push(this.hiddenSections[section]);
                this.shownSections.push(this.hiddenSections[section]);
            }
        }
        this._removeFromArray(this.hiddenSections, removeMe);
        return updated;
    },

    _hideSectionsIfApplicable: function() {
        let updated = false;
        let removeMe = [];
        for (let section in this.shownSections) {
            if (this.shownSections.hasOwnProperty(section)) {
                if (this.shownSections[section][1].isVisible() === false) {
                    this.shownSections[section][0].remove(this.shownSections[section][1]);
                    updated = true;
                    removeMe.push(this.shownSections[section]);
                    this.hiddenSections.push(this.shownSections[section]);
                }
            }
        }
        this._removeFromArray(this.shownSections, removeMe);
        return updated;
    },

    _visibilityHasChanged: function() {
        let updated = this._showHiddenSectionsIfApplicable();
        updated = updated || this._hideSectionsIfApplicable();
        if (updated) {
            this.frame.show_all();
        }
    },

    _init: function(schema) {
        let params = {
            settingsFile: Extension.path + '/settings.json',
            schema: schema
        };
        this.settings = new Settings(params);
        this.creator = new Extension.imports.prefsCreator.PrefsCreator(this.settings);
    },

    buildSubCategorySection: function(category, subcategory) {
        let section = this.creator.getSubCategoryWidget(category, subcategory);
        let allInSubContainer = this.settings.getAllInSubcontainer(category, subcategory);
        for (let setting in allInSubContainer) {
            if (allInSubContainer.hasOwnProperty(setting)) {
                let widget = this.creator.getWidget(allInSubContainer[setting][0]);
                section.add(widget);
                if (widget !== null) {
                    widget.connect('visibility-changed', Lang.bind(this, this._visibilityHasChanged));
                }
            }
        }
        return section;
    },

    buildCategoryTab: function(category) {
        let page = this.creator.getCategoryWidget(category);
        let allSubContainers = this.settings.getAllSubContainers(category);
        for (let subCategory in allSubContainers) {
            if (allSubContainers.hasOwnProperty(subCategory)) {
                let section = this.buildSubCategorySection(category, allSubContainers[subCategory]);
                if (section.isVisible()) {
                    page.add(section);
                    this.shownSections.push([page, section]);
                }
                else {
                    this.hiddenSections.push([page, section]);
                }
            }
        }
        return page;
    },

    buildPrefsWidget: function() {
        this.notebook = new Gtk.Notebook();
        this.notebook.set_tab_pos(Gtk.PositionType.TOP);
        let allCategories = this.settings.getAllCategories();
        for (let category in allCategories) {
            if (allCategories.hasOwnProperty(category)) {
                let tab = this.buildCategoryTab(allCategories[category]);
                if (tab.isVisible()) {
                    this.notebook.append_page(tab, tab.getTitle());
                }
                else {
                    this.hiddenTabs.push(tab);
                }
            }
        }
        this.frame = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            border_width: 10,
        });

        this.frame.add(this.notebook);

        this.frame.show_all();

        return this.frame;
    }
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
