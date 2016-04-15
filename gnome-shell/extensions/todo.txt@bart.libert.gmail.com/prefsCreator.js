const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Section = Extension.imports.preferences.subCategorySection.SubCategorySection;
const Subcategory = Extension.imports.preferences.subCategoryTab.SubCategoryTab;
const Tab = Extension.imports.preferences.categoryTab.CategoryTab;
const TabWithSubtabs = Extension.imports.preferences.categoryTabWithSubtabs.CategoryTabWithSubtabs;

const PrefsCreator = new imports.lang.Class({
    Name: 'PrefsCreator',
    _settings: null,
    _init: function(settings) {
        this._settings = settings;
    },

    getWidget: function(setting) {
        let widgetType = this._settings.getType(setting);
        if (widgetType === null || typeof widgetType == 'undefined') {
            return null;
        }
        if (this._settings.getWidget(setting) == 'none') {
            return null;
        }
        if (this._settings.getWidget(setting) != 'default') {
            widgetType = this._settings.getWidget(setting);
        }
        return new Extension.imports.preferences[widgetType + 'Widget'][widgetType.charAt(0).toUpperCase() +
            widgetType.substring(1) + 'Widget'](setting, this._settings);
    },

    getCategoryWidget: function(category) {
        if (this._settings.hasSubcategories(category)) {
            return new TabWithSubtabs(category);
        }
        return new Tab(category);
    },

    getSubCategoryWidget: function(category, subcategory) {
        if (this._settings.getType(subcategory, category) == 'subsection') {
            return new Section(subcategory, this._settings.getHelp(subcategory));
        }
        return new Subcategory(subcategory, this._settings.getHelp(subcategory));
    }
});

/* vi: set expandtab tabstop=4 shiftwidth=4: */
