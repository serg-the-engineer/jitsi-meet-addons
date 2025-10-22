var MEET_DOMAIN = PropertiesService.getScriptProperties().getProperty('MEET_DOMAIN');

// Web app entry point
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Manage')
    .setTitle('Conference Room Management')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Gets the user's events, showing only future events
 * and only the next upcoming instance of any recurring series.
 */
function getUserMeetEvents() {
  var now = new Date();
  var oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  var events = Calendar.Events.list('primary', {
    timeMin: now.toISOString(), // Start searching from the current time
    timeMax: oneMonthLater.toISOString(),
    singleEvents: true, // This is important, 'true' expands series into individual instances
    orderBy: 'startTime' // Mandatory sorting by start time
  });

  var userEmail = Session.getActiveUser().getEmail();
  var result = [];

  // A store for series IDs that we have already added to the list
  var processedSeriesIds = {};

  if (events.items) {
    for (var i = 0; i < events.items.length; i++) {
      var event = events.items[i];
      var creator = event.creator && event.creator.email ? event.creator.email.toLowerCase() : '';
      var currentUser = userEmail.toLowerCase();

      if (creator !== currentUser) {
        continue;
      }

      // Check if we have already added an event from this series
      if (event.recurringEventId) {
        var seriesId = event.recurringEventId;
        if (processedSeriesIds[seriesId]) {
          continue;
        }
        processedSeriesIds[seriesId] = true;
      }

      if (event.conferenceData && event.conferenceData.entryPoints) {
        for (var j = 0; j < event.conferenceData.entryPoints.length; j++) {
          var ep = event.conferenceData.entryPoints[j];
          if (ep.uri && ep.uri.indexOf(MEET_DOMAIN) >= 0) {

            result.push({
              eventId: event.id,
              title: event.summary || '(no title)',
              roomName: event.conferenceData.conferenceId || '',
              start: event.start.dateTime || event.start.date,
              creatorEmail: creator,
              canEdit: true,
              isRecurring: !!event.recurringEventId
            });
            break;
          }
        }
      }
    }
  }
  return result;
}

/**
 * Updates the room name for an event with a creator permission check.
 * Handles both single events and entire recurring series efficiently.
 * @param {string} eventId The ID of the event to update.
 * @param {string} newRoomName The new name for the conference room.
 * @return {Object} An object indicating success or failure.
 */
function updateEventRoom(eventId, newRoomName) {
  var userEmail = Session.getActiveUser().getEmail().toLowerCase();

  try {
    // 1. Get the event instance that the user clicked on
    var eventInstance = Calendar.Events.get('primary', eventId);
    var creator = eventInstance.creator && eventInstance.creator.email ? eventInstance.creator.email.toLowerCase() : '';

    if (creator !== userEmail) {
      return { success: false, message: 'Only the event creator can edit the room' };
    }

    // 2. Check if this event is part of a series
    if (eventInstance.recurringEventId) {
      var masterEventId = eventInstance.recurringEventId;
      var masterEvent = Calendar.Events.get('primary', masterEventId);
      var updated = updateConferenceDetails(masterEvent, newRoomName);
      if (!updated) {
        return { success: false, message: 'Conference room in the master event not found' };
      }

      // Send ONE request to update the master event.
      // Google Calendar will automatically apply these changes to all future events.
      Calendar.Events.update(masterEvent, 'primary', masterEvent.id, { conferenceDataVersion: 1 });

      return { success: true, message: 'The event template has been updated. Changes will apply to the entire series.' };

    } else {
      var updated = updateConferenceDetails(eventInstance, newRoomName);
      if (!updated) {
        return { success: false, message: 'Conference room to update was not found' };
      }
      Calendar.Events.update(eventInstance, 'primary', eventId, { conferenceDataVersion: 1 });
      return { success: true, message: 'Room name has been updated.' };
    }

  } catch (e) {
    return { success: false, message: 'Error: ' + e.message };
  }
}

/**
 * Helper function to update conference data within an event object.
 * This helps to avoid code duplication.
 * @param {Object} eventToModify - The Calendar event object.
 * @param {string} newRoomName - The new room name.
 * @return {boolean} - true if the update was successful, otherwise false.
 */
function updateConferenceDetails(eventToModify, newRoomName) {
  var updated = false;
  if (eventToModify.conferenceData && eventToModify.conferenceData.entryPoints) {
    for (var i = 0; i < eventToModify.conferenceData.entryPoints.length; i++) {
      var ep = eventToModify.conferenceData.entryPoints[i];
      if (ep.uri && ep.uri.indexOf(MEET_DOMAIN) >= 0) {
        ep.uri = 'https://' + MEET_DOMAIN + '/' + newRoomName;
        updated = true;
      }
    }
  }

  if (updated) {
    eventToModify.conferenceData.conferenceId = newRoomName;
    eventToModify.conferenceData.notes = 'Room: ' + newRoomName;
  }

  return updated;
}