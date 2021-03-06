/* @flow */

import _ from 'lodash';

import { equals, ReducerRegistry, set } from '../redux';

import {
    CONFIG_WILL_LOAD,
    LOAD_CONFIG_ERROR,
    SET_CONFIG
} from './actionTypes';

/**
 * The initial state of the feature base/config when executing in a
 * non-React Native environment. The mandatory configuration to be passed to
 * JitsiMeetJS#init(). The app will download config.js from the Jitsi Meet
 * deployment and take its values into account but the values bellow will be
 * enforced (because they are essential to the correct execution of the
 * application).
 *
 * @type {Object}
 */
const INITIAL_NON_RN_STATE = {
};

/**
 * The initial state of the feature base/config when executing in a React Native
 * environment. The mandatory configuration to be passed to JitsiMeetJS#init().
 * The app will download config.js from the Jitsi Meet deployment and take its
 * values into account but the values bellow will be enforced (because they are
 * essential to the correct execution of the application).
 *
 * @type {Object}
 */
const INITIAL_RN_STATE = {
    // FIXME The support for audio levels in lib-jitsi-meet polls the statistics
    // of WebRTC at a short interval multiple times a second. Unfortunately,
    // React Native is slow to fetch these statistics from the native WebRTC
    // API, through the React Native bridge and eventually to JavaScript.
    // Because the audio levels are of no interest to the mobile app, it is
    // fastest to merely disable them.
    disableAudioLevels: true,

    p2p: {
        disableH264: false,
        preferH264: true
    }
};

ReducerRegistry.register(
    'features/base/config',
    (state = _getInitialState(), action) => {
        switch (action.type) {
        case CONFIG_WILL_LOAD:
            return {
                error: undefined
            };

        case LOAD_CONFIG_ERROR:
            return {
                error: action.error
            };

        case SET_CONFIG:
            return _setConfig(state, action);

        default:
            return state;
        }
    });

/**
 * Gets the initial state of the feature base/config. The mandatory
 * configuration to be passed to JitsiMeetJS#init(). The app will download
 * config.js from the Jitsi Meet deployment and take its values into account but
 * the values bellow will be enforced (because they are essential to the correct
 * execution of the application).
 *
 * @returns {Object}
 */
function _getInitialState() {
    return (
        navigator.product === 'ReactNative'
            ? INITIAL_RN_STATE
            : INITIAL_NON_RN_STATE);
}

/**
 * Reduces a specific Redux action SET_CONFIG of the feature
 * base/lib-jitsi-meet.
 *
 * @param {Object} state - The Redux state of the feature base/lib-jitsi-meet.
 * @param {Action} action - The Redux action SET_CONFIG to reduce.
 * @private
 * @returns {Object} The new state of the feature base/lib-jitsi-meet after the
 * reduction of the specified action.
 */
function _setConfig(state, { config }) {
    // The mobile app bundles jitsi-meet and lib-jitsi-meet at build time and
    // does not download them at runtime from the deployment on which it will
    // join a conference. The downloading is planned for implementation in the
    // future (later rather than sooner) but is not implemented yet at the time
    // of this writing and, consequently, we must provide legacy support in the
    // meantime.

    // eslint-disable-next-line no-param-reassign
    config = _translateLegacyConfig(config);

    const newState = _.merge(
        {},
        config,
        { error: undefined },

        // The config of _getInitialState() is meant to override the config
        // downloaded from the Jitsi Meet deployment because the former contains
        // values that are mandatory.
        _getInitialState()
    );

    return equals(state, newState) ? state : newState;
}

/**
 * Constructs a new config {@code Object}, if necessary, out of a specific
 * config {@code Object} which is in the latest format supported by jitsi-meet.
 * Such a translation from an old config format to a new/the latest config
 * format is necessary because the mobile app bundles jitsi-meet and
 * lib-jitsi-meet at build time and does not download them at runtime from the
 * deployment on which it will join a conference.
 *
 * @param {Object} oldValue - The config {@code Object} which may or may not be
 * in the latest form supported by jitsi-meet and from which a new config
 * {@code Object} is to be constructed if necessary.
 * @returns {Object} A config {@code Object} which is in the latest format
 * supported by jitsi-meet.
 */
function _translateLegacyConfig(oldValue: Object) {
    // jitsi/jitsi-meet#3ea2f005787c9f49c48febaeed9dc0340fe0a01b

    let newValue = oldValue;

    // At the time of this writing lib-jitsi-meet will rely on config having a
    // property with the name p2p and with a value of type Object.
    if (typeof oldValue.p2p !== 'object') {
        newValue = set(newValue, 'p2p', {});
    }

    /* eslint-disable indent */

    // Translate the old config properties into the new config.p2p properties.
    for (const [ oldKey, newKey ]
            of [
                [ 'backToP2PDelay', 'backToP2PDelay' ],
                [ 'enableP2P', 'enabled' ],
                [ 'p2pStunServers', 'stunServers' ]
            ]) {

    /* eslint-enable indent */

        if (oldKey in newValue && !(newKey in newValue.p2p)) {
            const v = newValue[oldKey];

            // Do not modify oldValue.
            if (newValue === oldValue) {
                newValue = {
                    ...newValue
                };
            }
            delete newValue[oldKey];

            // Do not modify p2p because it may be from oldValue i.e. do not
            // modify oldValue.
            newValue.p2p = {
                ...newValue.p2p,
                [newKey]: v
            };
        }
    }

    return newValue;
}
