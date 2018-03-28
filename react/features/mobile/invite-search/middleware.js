/* @flow */

import i18next from 'i18next';
import { NativeModules, NativeEventEmitter } from 'react-native';

import { MiddlewareRegistry } from '../../base/redux';
import { APP_WILL_MOUNT, APP_WILL_UNMOUNT } from '../../app';
import { getInviteURL } from '../../base/connection';
import {
    getInviteResultsForQuery,
    isAddToCallEnabled,
    isDialOutEnabled,
    sendInvitesForItems
} from '../../invite';
import { inviteVideoRooms } from '../../videosipgw';

import { sendInviteFailure } from './actions';
import {
    _SET_INVITE_SEARCH_SUBSCRIPTIONS,
    LAUNCH_NATIVE_INVITE,
    SEND_INVITE_FAILURE
} from './actionTypes';

/**
 * Middleware that captures Redux actions and uses the InviteSearch module to
 * turn them into native events so the application knows about them.
 *
 * @param {Store} store - Redux store.
 * @returns {Function}
 */
MiddlewareRegistry.register(store => next => action => {
    const result = next(action);

    switch (action.type) {

    case APP_WILL_MOUNT:
        return _appWillMount(store, next, action);

    case APP_WILL_UNMOUNT:
        store.dispatch({
            type: _SET_INVITE_SEARCH_SUBSCRIPTIONS,
            subscriptions: undefined
        });
        break;

    case LAUNCH_NATIVE_INVITE:
        launchNativeInvite(store);
        break;

    case SEND_INVITE_FAILURE:
        onSendInviteFailure(store, action.items);
        break;
    }

    return result;
});

/**
 * Notifies the feature jwt that the action {@link APP_WILL_MOUNT} is being
 * dispatched within a specific redux {@code store}.
 *
 * @param {Store} store - The redux store in which the specified {@code action}
 * is being dispatched.
 * @param {Dispatch} next - The redux dispatch function to dispatch the
 * specified {@code action} to the specified {@code store}.
 * @param {Action} action - The redux action {@code APP_WILL_MOUNT} which is
 * being dispatched in the specified {@code store}.
 * @private
 * @returns {*}
 */
function _appWillMount({ dispatch, getState }, next, action) {
    const result = next(action);

    const emitter = new NativeEventEmitter(NativeModules.InviteSearch);

    const context = {
        dispatch,
        getState
    };
    const subscriptions = [
        emitter.addListener(
            'performQueryAction',
            _onPerformQueryAction,
            context),
        emitter.addListener(
            'performSubmitInviteAction',
            _onPerformSubmitInviteAction,
            context)
    ];

    dispatch({
        type: _SET_INVITE_SEARCH_SUBSCRIPTIONS,
        subscriptions
    });

    return result;
}

/**
 * Sends a request to the native counterpart of InviteSearch to launch a native.
 * invite search.
 *
 * @param {Object} store - The redux store.
 * @private
 * @returns {void}
 */
function launchNativeInvite(store: { getState: Function }) {
    // The JavaScript App needs to provide uniquely identifying information
    // to the native module so that the latter may match the former
    // to the native JitsiMeetView which hosts it.
    const { app } = store.getState()['features/app'];

    if (app) {
        const { externalAPIScope } = app.props;

        if (externalAPIScope) {
            NativeModules.InviteSearch.launchNativeInvite(externalAPIScope);
        }
    }
}

/**
 * Sends a notification to the native counterpart of InviteSearch that some
 * invite items failed to send successfully.
 *
 * @param  {Object} store - The redux store.
 * @param  {Array<*>} items - Invite items that failed to send.
 * @returns {void}
 */
function onSendInviteFailure(store: { getState: Function }, items: Array<*>) {
    // The JavaScript App needs to provide uniquely identifying information
    // to the native module so that the latter may match the former
    // to the native JitsiMeetView which hosts it.
    const { app } = store.getState()['features/app'];

    if (app) {
        const { externalAPIScope } = app.props;

        if (externalAPIScope) {
            NativeModules.InviteSearch.inviteFailedForItems(
                items,
                externalAPIScope
            );
        }
    }
}

/**
 * Handles InviteSearch's event {@code performQueryAction}.
 *
 * @param {Object} event - The details of the InviteSearch event
 * {@code performQueryAction}.
 * @returns {void}
 */
function _onPerformQueryAction({ query }) {
    const { getState } = this; // eslint-disable-line no-invalid-this

    const state = getState();

    const { app } = state['features/app'];

    const {
        dialOutAuthUrl,
        peopleSearchQueryTypes,
        peopleSearchUrl
    } = state['features/base/config'];

    getInviteResultsForQuery(
        query,
        isAddToCallEnabled(state),
        isDialOutEnabled(state),
        state['features/base/jwt'].jwt,
        peopleSearchUrl,
        peopleSearchQueryTypes,
        dialOutAuthUrl
    )
    .catch(() => [])
    .then(results => {
        const translatedResults = results.map(result => {
            if (result.type === 'phone') {
                result.title = i18next.t('addPeople.telephone', {
                    number: result.number
                });

                if (result.showCountryCodeReminder) {
                    result.subtitle = i18next.t('addPeople.countryReminder');
                }
            }

            return result;
        }).filter(result => result.type !== 'phone' || result.allowed);

        NativeModules.InviteSearch.receivedResults(
            translatedResults,
            query,
            app.props.externalAPIScope);
    });
}

/**
 * Handles InviteSearch's event {@code performSubmitInviteAction}.
 *
 * @param {Array<string>} selectedItems - The items to invite.
 * @returns {void}
 */
function _onPerformSubmitInviteAction(selectedItems: Array<string>) {
    const { dispatch, getState } = this; // eslint-disable-line no-invalid-this

    const state = getState();

    const { conference } = state['features/base/conference'];

    const {
        inviteServiceUrl
    } = state['features/base/config'];

    sendInvitesForItems( // eslint-disable-line max-params
            selectedItems,
            isAddToCallEnabled(state),
            isDialOutEnabled(state),
            state['features/base/jwt'].jwt,
            conference,
            inviteServiceUrl,
            getInviteURL(state),
            inviteVideoRooms)
        .then(invitesLeftToSend => {
            if (invitesLeftToSend.length) {
                dispatch(sendInviteFailure(invitesLeftToSend));
            }
        });
}
