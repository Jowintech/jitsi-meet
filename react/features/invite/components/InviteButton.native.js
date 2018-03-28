// @flow

import React, { Component } from 'react';
import { connect } from 'react-redux';

import { getLocalParticipant, PARTICIPANT_ROLE } from '../../base/participants';
import { ToolbarButton } from '../../toolbox';

import { launchNativeInvite } from '../../mobile/invite-search';

/**
 * The type of {@link EnterPictureInPictureToobarButton}'s React
 * {@code Component} props.
 */
type Props = {

    /**
     * Indicates if the "Add to call" feature is available.
     */
    enableAddPeople: boolean,

    /**
     * Indicates if the "Dial out" feature is available.
     */
    enableDialOut: boolean,

    /**
     * Launches native invite dialog.
     *
     * @protected
     */
    onLaunchNativeInvite: Function,
};

/**
 * Implements a {@link ToolbarButton} to enter Picture-in-Picture.
 */
class InviteButton extends Component<Props> {

    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     * @returns {ReactElement}
     */
    render() {
        const {
            enableAddPeople,
            enableDialOut,
            onLaunchNativeInvite,
            ...props
        } = this.props;

        if (!enableAddPeople && !enableDialOut) {
            return null;
        }

        return (
            <ToolbarButton
                iconName = { 'add' }
                onClick = { onLaunchNativeInvite }
                { ...props } />
        );
    }
}

/**
 * Maps redux actions to {@link InviteButton}'s React
 * {@code Component} props.
 *
 * @param {Function} dispatch - The redux action {@code dispatch} function.
 * @returns {{
*      onLaunchNativeInvite
 * }}
 * @private
 */
function _mapDispatchToProps(dispatch) {
    return {

        /**
         * Launches native invite dialog.
         *
         * @private
         * @returns {void}
         * @type {Function}
         */
        onLaunchNativeInvite() {
            dispatch(launchNativeInvite());
        }
    };
}

/**
 * Maps (parts of) the Redux state to the associated {@code InviteButton}'s
 * props.
 *
 * @param {Object} state - The Redux state.
 * @private
 * @returns {{
 *     _isAddToCallAvailable: boolean
 * }}
 */
function _mapStateToProps(state) {
    const { app } = state['features/app'];

    const { conference } = state['features/base/conference'];
    const { isGuest } = state['features/base/jwt'];
    const { enableUserRolesBasedOnToken } = state['features/base/config'];

    const addPeopleEnabled = !isGuest
        && Boolean(app && app.props.addPeopleEnabled);

    const isDialOutAvailable
        = getLocalParticipant(state).role === PARTICIPANT_ROLE.MODERATOR
                && conference && conference.isSIPCallingSupported()
                && (!enableUserRolesBasedOnToken || !isGuest);

    return {
        enableAddPeople: addPeopleEnabled,
        enableDialOut: isDialOutAvailable
    };
}

export default connect(_mapStateToProps, _mapDispatchToProps)(InviteButton);

