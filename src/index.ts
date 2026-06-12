import { API } from 'homebridge';
import { RoborockMatterPlatform } from './platform';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';

/**
 * This is the entry point for the plugin.
 * Homebridge calls the exported function, passing the API object.
 */
export = (api: API) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, RoborockMatterPlatform);
};
