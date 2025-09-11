# Twitch Stream Notifications

## Notes
- doesnt work if you added more than 5 channels to listening, cuz total event cost is 10, stream.online and stream.offline costs 1 (if channel you listening not belongs to user of token, otherwise cost is 0), to fix that we need to have tokens of each added twitch channel and use them when subscribing to event (websocket session is the same)

## How to use this module?
- Go to [parent repository](https://github.com/TheLeerName/db-module-core) and read `README.md` file

## TODO
- discord_message_id became null when vod was gotten
- see changes of polling_channels_id, cuz nothing is updated when stream is live