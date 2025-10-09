function createMyMeetConference(arg) {
    console.log("start");
    const eventData = arg.eventData;

    const suggestedName = generateRoomName(eventData);

    return createConferenceWithCustomName(eventData, suggestedName);
}

function createConferenceWithCustomName(eventData, roomName) {
    const roomUrl = "https://meet.mydomain.com/" + roomName;

    var dataBuilder = ConferenceDataService.newConferenceDataBuilder();

    var videoEntryPoint = ConferenceDataService.newEntryPoint()
        .setEntryPointType(ConferenceDataService.EntryPointType.VIDEO)
        .setUri(roomUrl);

    dataBuilder
        .setConferenceId(roomName)
        .addEntryPoint(videoEntryPoint)
        .setNotes("Room: " + roomName);

    return dataBuilder.build();
}

function generateRoomName() {
    return "meeting-" + Math.floor(100000 + Math.random() * 900000);
}
