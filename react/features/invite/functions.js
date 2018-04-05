// @flow

declare var $: Function;
declare var interfaceConfig: Object;

const logger = require('jitsi-meet-logger').getLogger(__filename);

import { getLocalParticipant, PARTICIPANT_ROLE } from '../base/participants';

/**
 * Get the position of the invite option in the interfaceConfig.INVITE_OPTIONS
 * list.
 *
 * @param {string} name - The invite option name.
 * @private
 * @returns {number} - The position of the option in the list.
 */
export function getInviteOptionPosition(name: string): number {
    return interfaceConfig.INVITE_OPTIONS.indexOf(name);
}

/**
 * Sends a post request to an invite service.
 *
 * @param {string} inviteServiceUrl - The invite service that generates the
 * invitation.
 * @param {string} inviteUrl - The url to the conference.
 * @param {string} jwt - The jwt token to pass to the search service.
 * @param {Immutable.List} inviteItems - The list of the "user" or "room"
 * type items to invite.
 * @returns {Promise} - The promise created by the request.
 */
function invitePeopleAndChatRooms( // eslint-disable-line max-params
        inviteServiceUrl: string,
        inviteUrl: string,
        jwt: string,
        inviteItems: Array<Object>): Promise<void> {
    if (!inviteItems || inviteItems.length === 0) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        $.post(
                `${inviteServiceUrl}?token=${jwt}`,
                JSON.stringify({
                    'invited': inviteItems,
                    'url': inviteUrl
                }),
                resolve,
                'json')
            .fail((jqxhr, textStatus, error) => reject(error));
    });
}

/**
 * Indicates if an invite option is enabled in the configuration.
 *
 * @param {string} name - The name of the option defined in
 * interfaceConfig.INVITE_OPTIONS.
 * @returns {boolean} - True to indicate that the given invite option is
 * enabled, false - otherwise.
 */
export function isInviteOptionEnabled(name: string) {
    return getInviteOptionPosition(name) !== -1;
}

/**
 * Sends an ajax request to a directory service.
 *
 * @param {string} serviceUrl - The service to query.
 * @param {string} jwt - The jwt token to pass to the search service.
 * @param {string} text - Text to search.
 * @param {Array<string>} queryTypes - Array with the query types that will be
 * executed - "conferenceRooms" | "user" | "room".
 * @returns {Promise} - The promise created by the request.
 */
export function searchDirectory( // eslint-disable-line max-params
        serviceUrl: string,
        jwt: string,
        text: string,
        queryTypes: Array<string> = [ 'conferenceRooms', 'user', 'room' ]
): Promise<Array<Object>> {
    const query = encodeURIComponent(text);
    const queryTypesString = encodeURIComponent(JSON.stringify(queryTypes));

    return new Promise((resolve, reject) => {
        $.getJSON(
                `${serviceUrl}?query=${query}&queryTypes=${
                    queryTypesString}&jwt=${jwt}`,
                resolve)
            .catch((jqxhr, textStatus, error) => reject(error));
    });
}

/**
 * RegExp to use to determine if some text might be a phone number.
 *
 * @returns {RegExp}
 */
function isPhoneNumberRegex(): RegExp {
    let regexString = '^[0-9+()-\\s]*$';

    if (typeof interfaceConfig !== 'undefined') {
        regexString = interfaceConfig.PHONE_NUMBER_REGEX || regexString;
    }

    return new RegExp(regexString);
}

/**
 * Sends an ajax request to check if the phone number can be called.
 *
 * @param {string} dialNumber - The dial number to check for validity.
 * @param {string} dialOutAuthUrl - The endpoint to use for checking validity.
 * @returns {Promise} - The promise created by the request.
 */
export function checkDialNumber(
        dialNumber: string, dialOutAuthUrl: string): Promise<Object> {
    if (!dialOutAuthUrl) {
        // no auth url, let's say it is valid
        const response = {
            allow: true,
            phone: `+${dialNumber}`
        };

        return Promise.resolve(response);
    }

    const fullUrl = `${dialOutAuthUrl}?phone=${dialNumber}`;

    return new Promise((resolve, reject) => {
        $.getJSON(fullUrl)
            .then(resolve)
            .catch(reject);
    });
}

/**
 * Removes all non-numeric characters from a string.
 *
 * @param {string} text - The string from which to remove all characters
 * except numbers.
 * @private
 * @returns {string} A string with only numbers.
 */
function getDigitsOnly(text: string = ''): string {
    return text.replace(/\D/g, '');
}

/**
 * Combines directory search with phone number validation to produce a single
 * set of invite search results.
 *
 * @param  {string} query - Text to search.
 * @param  {boolean} enableAddPeople - Whether or not to search for people.
 * @param  {boolean} enableDialOut - Whether or not to check phone numbers.
 * @param  {string} jwt - The jwt token to pass to the search service.
 * @param  {string} peopleSearchUrl - The url to query for people.
 * @param  {Array<string>} peopleSearchQueryTypes - Array with the query types
 * that will be executed - "conferenceRooms" | "user" | "room".
 * @param  {string} dialOutAuthUrl - The endpoint to use for checking phone
 * number validity.
 * @returns {Promise<*>}
 */
export function getInviteResultsForQuery( // eslint-disable-line max-params
        query: string,
        enableAddPeople: boolean,
        enableDialOut: boolean,
        jwt: string,
        peopleSearchUrl: string,
        peopleSearchQueryTypes: Array<string>,
        dialOutAuthUrl: string): Promise<*> {
    const text = query.trim();

    let peopleSearchPromise;

    if (enableAddPeople) {
        peopleSearchPromise = searchDirectory(
            peopleSearchUrl,
            jwt,
            text,
            peopleSearchQueryTypes);
    } else {
        peopleSearchPromise = Promise.resolve([]);
    }


    const hasCountryCode = text.startsWith('+');
    let phoneNumberPromise;

    if (enableDialOut && isMaybeAPhoneNumber(text)) {
        let numberToVerify = text;

        // When the number to verify does not start with a +, we assume no
        // proper country code has been entered. In such a case, prepend 1
        // for the country code. The service currently takes care of
        // prepending the +.
        if (!hasCountryCode && !text.startsWith('1')) {
            numberToVerify = `1${numberToVerify}`;
        }

        // The validation service works properly when the query is digits
        // only so ensure only digits get sent.
        numberToVerify = getDigitsOnly(numberToVerify);

        phoneNumberPromise
            = checkDialNumber(numberToVerify, dialOutAuthUrl);
    } else {
        phoneNumberPromise = Promise.resolve({});
    }

    return Promise.all([ peopleSearchPromise, phoneNumberPromise ])
        .then(([ peopleResults, phoneResults ]) => {
            const results = [
                ...peopleResults
            ];

            /**
             * This check for phone results is for the day the call to
             * searching people might return phone results as well. When
             * that day comes this check will make it so the server checks
             * are honored and the local appending of the number is not
             * done. The local appending of the phone number can then be
             * cleaned up when convenient.
             */
            const hasPhoneResult = peopleResults.find(
                result => result.type === 'phone');

            if (!hasPhoneResult
                    && typeof phoneResults.allow === 'boolean') {
                results.push({
                    allowed: phoneResults.allow,
                    country: phoneResults.country,
                    type: 'phone',
                    number: phoneResults.phone,
                    originalEntry: text,
                    showCountryCodeReminder: !hasCountryCode
                });
            }

            return results;
        });
}

/**
 * Checks whether a string looks like it could be for a phone number.
 *
 * @param {string} text - The text to check whether or not it could be a
 * phone number.
 * @private
 * @returns {boolean} True if the string looks like it could be a phone
 * number.
 */
function isMaybeAPhoneNumber(text: string): boolean {
    if (!isPhoneNumberRegex().test(text)) {
        return false;
    }

    const digits = getDigitsOnly(text);

    return Boolean(digits.length);
}

/**
 * Send invites for a list of items (may be a combination of users, rooms, phone
 * numbers, and video rooms).
 *
 * @param  {Array<Object>} items - Items for which invites should be sent.
 * @param  {boolean} enableAddPeople - Whether or not to search for people.
 * @param  {boolean} enableDialOut - Whether or not to check phone numbers.
 * @param  {string} jwt - The jwt token to pass to the search service.
 * @param  {Object} conference - Conference object used to dial out.
 * @param  {string} inviteServiceUrl - The URL to send invites through.
 * @param  {string} inviteUrl - The URL sent with each invite.
 * @param  {Function} inviteVideoRooms - The function used to invite video
 * rooms.
 * @returns {Promise} Promise containing the list of invites that were not sent.
 */
export function sendInvitesForItems( // eslint-disable-line max-params
        items: Array<Object>,
        enableAddPeople: boolean,
        enableDialOut: boolean,
        jwt: string,
        conference: Object,
        inviteServiceUrl: string,
        inviteUrl: string,
        inviteVideoRooms: (Object, Array<Object>) => boolean
): Promise<Array<Object>> {

    let allInvitePromises = [];
    let invitesLeftToSend = [ ...items ];

    // First create all promises for dialing out.
    if (enableDialOut && conference) {
        const phoneNumbers = invitesLeftToSend.filter(
            item => item.type === 'phone');

        // For each number, dial out. On success, remove the number from
        // {@link invitesLeftToSend}.
        const phoneInvitePromises = phoneNumbers.map(item => {
            const numberToInvite = getDigitsOnly(item.number);

            return conference.dial(numberToInvite)
                    .then(() => {
                        invitesLeftToSend
                            = invitesLeftToSend.filter(invite =>
                                invite !== item);
                    })
                    .catch(error => logger.error(
                        'Error inviting phone number:', error));

        });

        allInvitePromises = allInvitePromises.concat(phoneInvitePromises);
    }

    if (enableAddPeople) {
        const usersAndRooms = invitesLeftToSend.filter(item =>
            item.type === 'user' || item.type === 'room');

        if (usersAndRooms.length) {
            // Send a request to invite all the rooms and users. On success,
            // filter all rooms and users from {@link invitesLeftToSend}.
            const peopleInvitePromise = invitePeopleAndChatRooms(
                inviteServiceUrl,
                inviteUrl,
                jwt,
                usersAndRooms)
                .then(() => {
                    invitesLeftToSend = invitesLeftToSend.filter(item =>
                        item.type !== 'user' && item.type !== 'room');
                })
                .catch(error => logger.error(
                    'Error inviting people:', error));

            allInvitePromises.push(peopleInvitePromise);
        }

        // Sipgw calls are fire and forget. Invite them to the conference
        // then immediately remove them from {@link invitesLeftToSend}.
        const vrooms = invitesLeftToSend.filter(item =>
            item.type === 'videosipgw');

        conference
            && vrooms.length > 0
            && inviteVideoRooms(conference, vrooms);

        invitesLeftToSend = invitesLeftToSend.filter(item =>
            item.type !== 'videosipgw');
    }

    return Promise.all(allInvitePromises)
        .then(() => invitesLeftToSend);
}

/**
 * Determines if adding people is currently enabled.
 *
 * @param {boolean} state - Current state.
 * @returns {boolean} Indication of whether adding people is currently enabled.
 */
export function isAddToCallEnabled(state: Object): boolean {
    const { app } = state['features/app'];

    const { isGuest } = state['features/base/jwt'];

    return !isGuest && Boolean(app && app.props.addPeopleEnabled);
}

/**
 * Determines if dial out is currently enabled or not.
 *
 * @param {boolean} state - Current state.
 * @returns {boolean} Indication of whether dial out is currently enabled.
 */
export function isDialOutEnabled(state: Object): boolean {
    const { conference } = state['features/base/conference'];
    const { isGuest } = state['features/base/jwt'];
    const { enableUserRolesBasedOnToken } = state['features/base/config'];

    const participant = getLocalParticipant(state);

    return participant && participant.role === PARTICIPANT_ROLE.MODERATOR
                && conference && conference.isSIPCallingSupported()
                && (!enableUserRolesBasedOnToken || !isGuest);
}
