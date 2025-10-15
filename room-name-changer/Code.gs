var MEET_DOMAIN = PropertiesService.getScriptProperties().getProperty('MEET_DOMAIN');

// Entrypoint
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Manage')
    .setTitle('Conferences management')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getUserRoboMeetEvents() {
  var now = new Date();
  var oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  var oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  var events = Calendar.Events.list('primary', {
    timeMin: oneWeekAgo.toISOString(),
    timeMax: oneMonthLater.toISOString(),
    singleEvents: true,
    orderBy: 'startTime'
  });

  var userEmail = Session.getActiveUser().getEmail();
  var result = [];

  if (events.items) {
    for (var i = 0; i < events.items.length; i++) {
      var event = events.items[i];
      if (event.conferenceData && event.conferenceData.entryPoints) {
        for (var j = 0; j < event.conferenceData.entryPoints.length; j++) {
          var ep = event.conferenceData.entryPoints[j];
          if (ep.uri && ep.uri.indexOf(MEET_DOMAIN) >= 0) {
            // Only if creator for security reasons
            var creator = event.creator && event.creator.email ? event.creator.email.toLowerCase() : '';
            var currentUser = userEmail.toLowerCase();
            var canEdit = (creator === currentUser);

            result.push({
              eventId: event.id,
              title: event.summary || '(no name)',
              roomName: event.conferenceData.conferenceId || '',
              start: event.start.dateTime || event.start.date,
              creatorEmail: creator,
              canEdit: canEdit
            });
            break;
          }
        }
      }
    }
  }
  return result;
}

function updateEventRoom(eventId, newRoomName) {
  var userEmail = Session.getActiveUser().getEmail().toLowerCase();

  try {
    var event = Calendar.Events.get('primary', eventId);
    var creator = event.creator && event.creator.email ? event.creator.email.toLowerCase() : '';

    if (creator !== userEmail) {
      return { success: false, message: 'Only creator can edit room' };
    }

    var updated = false;

    if (event.conferenceData && event.conferenceData.entryPoints) {
      for (var i = 0; i < event.conferenceData.entryPoints.length; i++) {
        var ep = event.conferenceData.entryPoints[i];
        if (ep.uri && ep.uri.indexOf('meet.redmadrobot.com') >= 0) {
          ep.uri = 'https://' + MEET+DOMAIN + '/' + newRoomName;
          updated = true;
        }
      }
    }

    if (!updated) {
      return { success: false, message: 'Room was updated' };
    }

    event.conferenceData.conferenceId = newRoomName;
    event.conferenceData.notes = 'Room: ' + newRoomName;

    Calendar.Events.update(event, 'primary', eventId, { conferenceDataVersion: 1 });
    return { success: true };

  } catch (e) {
    return { success: false, message: 'Error: ' + e.message };
  }
}
