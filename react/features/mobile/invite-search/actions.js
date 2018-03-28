// @flow

import {
    LAUNCH_NATIVE_INVITE,
    SEND_INVITE_FAILURE
} from './actionTypes';

/**
 * Launches the native invite dialog.
 *
 * @returns {{
 *     type: LAUNCH_NATIVE_INVITE
 * }}
 */
export function launchNativeInvite() {
    return {
        type: LAUNCH_NATIVE_INVITE
    };
}

/**
 * Indicates that some native invites failed to send successfully.
 *
 * @param  {Array<*>} items - Invite items that failed to send.
 * @returns {void}
 */
export function sendInviteFailure(items: Array<*>) {
    return {
        type: SEND_INVITE_FAILURE,
        items
    };
}
