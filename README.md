# Twitch Notifications Discord Bot

## How to use
1. Install [node.js](https://nodejs.org/)
2. Enter command in terminal: `npm i`
3. Build with command: `npx tsc` (everytime when you changing `.ts` files u need to do this)
4. Go to `config.json` file and put some things:
- `token` - [Discord bot token](https://discord.com/developers/applications/)
- `activity` - This will appear as activity of discord bot
- `twitchClientID` - [Twitch App Client ID](https://dev.twitch.tv/console/apps/)
- `twitchAccessToken` - [Twitch App Access Token](https://dev.twitch.tv/console/apps/) (resets after 2 months as i remember)
5. Now start bot with `run.bat` script