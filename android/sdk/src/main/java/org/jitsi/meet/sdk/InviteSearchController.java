package org.jitsi.meet.sdk;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableNativeArray;
import com.facebook.react.bridge.WritableNativeMap;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Controller object used by native code to query and submit user selections for the user invitation flow
 */
public class InviteSearchController {

    private InviteSearchControllerDelegate searchControllerDelegate;
    private Map<String, ReadableMap> items = new HashMap<>();

    public InviteSearchController() { }

    /**
     * Start a search for entities to invite with the given query.
     * Results will be returned through the associated InviteSearchControllerDelegate's
     * onReceiveResults method.
     *
     * @param query
     */
    public void query(String query) {
        JitsiMeetView.onInviteQuery(query);
    }

    /**
     * Send invites to selected users based on their item ids
     *
     * @param ids
     */
    public void submitSelectedItemIds(List<String> ids) {
        WritableArray selectedItems = new WritableNativeArray();
        for(int i=0; i<ids.size(); i++) {
            if(items.containsKey(ids.get(i))) {
                WritableNativeMap map = new WritableNativeMap();
                map.merge(items.get(ids.get(i)));
                selectedItems.pushMap(map);
            } else {
                // if the id doesn't exist in the map, we can't do anything, so just skip it
            }
        }

        JitsiMeetView.submitSelectedItems(selectedItems);
    }

    /**
     * Caches results received by the search into a local map for use
     * later when the items are submitted.  Submission requires the full
     * map of information, but only the IDs are returned back to the delegate.
     * Using this map means we don't have to send the whole map back to the delegate.
     *
     * @param results
     * @param query
     */
    void receivedResultsForQuery(ReadableArray results, String query) {

        List<Map<String, Object>> jvmResults = new ArrayList<>();
        // cache results for use in submission later
        // convert to jvm array
        for(int i=0; i<results.size(); i++) {
            ReadableMap map = results.getMap(i);
            if(map.getString("type").equals("user") ||
                    map.getString("type").equals("videosipgw")) {
                items.put(map.getString("id"), map);
            } else if(map.getString("type").equals("phone")) {
                items.put(map.getString("number"), map);
            }

            jvmResults.add(map.toHashMap());
        }


        searchControllerDelegate.onReceiveResults(this, jvmResults, query);
    }

    public InviteSearchControllerDelegate getSearchControllerDelegate() {
        return searchControllerDelegate;
    }

    public void setSearchControllerDelegate(InviteSearchControllerDelegate searchControllerDelegate) {
        this.searchControllerDelegate = searchControllerDelegate;
    }

    public interface InviteSearchControllerDelegate {
        /**
         * Called when results are received for a query called through InviteSearchController.query()
         *
         * @param searchController
         * @param results a List of Map<String, Object> objects that represent items returned by the query.
         *                The object at key "type" describes the type of item: "user", "videosipgw" (conference room), or "phone".
         *                "user" types have properties at "id", "name", and "avatar"
         *                "videosipgw" types have properties at "id" and "name"
         *                "phone" types have properties at "number", "title", "and "subtitle"
         * @param query the query that generated the given results
         */
        void onReceiveResults(InviteSearchController searchController, List<Map<String, Object>> results, String query);
    }
}