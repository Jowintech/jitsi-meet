package org.jitsi.meet.sdk;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

/**
 * Native module for Invite Search
 */
class InviteSearchModule extends ReactContextBaseJavaModule {

    private Map<String, InviteSearchController> searchControllers = new HashMap<>();

    public InviteSearchModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    /**
     * Launch the native user invite flow
     *
     * @param externalAPIScope a string that represents a connection to a specific JitsiMeetView
     */
    @ReactMethod
    public void launchNativeInvite(String externalAPIScope) {
        JitsiMeetView viewToLaunchInvite = JitsiMeetView.findViewByExternalAPIScope(externalAPIScope);

        if(viewToLaunchInvite == null) {
            return;
        }

        if(viewToLaunchInvite.getListener() == null) {
            return;
        }

        InviteSearchController controller = createSearchControllerForScope(externalAPIScope);

        Map<String, Object> data = new HashMap<>();
        data.put("userSearch", controller);
        viewToLaunchInvite.getListener().launchNativeInvite(data);
    }

    /**
     * Callback for results received from the JavaScript invite search call
     *
     * @param results the results in a ReadableArray of ReadableMap objects
     * @param query the query associated with the search
     * @param scope a string that represents a connection to a specific JitsiMeetView
     */
    @ReactMethod
    public void receivedResults(ReadableArray results, String query, String scope) {
        InviteSearchController controller = searchControllers.get(scope);

        if(controller != null) {
            controller.receivedResultsForQuery(results, query);
        }
    }

    /**
     * Callback for invitation failures
     *
     * @param items the items for which the invitation failed
     * @param scope a string that represents a connection to a specific JitsiMeetView
     */
    @ReactMethod
    public void inviteFailedForItems(ReadableArray items, String scope) {
        JitsiMeetView viewToLaunchInvite = JitsiMeetView.findViewByExternalAPIScope(scope);

        if(viewToLaunchInvite == null) {
            return;
        }

        if(viewToLaunchInvite.getListener() == null) {
            return;
        }

        ArrayList<Map<String, Object>> jvmItems = new ArrayList<>();
        for(int i=0; i<items.size(); i++) {
            ReadableMap item = items.getMap(i);
            jvmItems.add(item.toHashMap());
        }

        Map<String, Object> data = new HashMap<>();
        data.put("items", jvmItems);
        viewToLaunchInvite.getListener().inviteFailedForItems(data);
    }

    @Override
    public String getName() {
        return "InviteSearch";
    }

    private InviteSearchController createSearchControllerForScope(String scope) {
        InviteSearchController searchController = new InviteSearchController();
        searchControllers.put(scope, searchController);
        return searchController;
    }
}