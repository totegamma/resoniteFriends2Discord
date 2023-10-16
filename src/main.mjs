import {
    HubConnectionBuilder,
    HttpTransportType,
    LogLevel,
} from "@microsoft/signalr";
import discord from 'discord.js';
const { Client } = discord;
import dotenv from 'dotenv';

dotenv.config();

const username = process.env.USERNAME;
const password = process.env.PASSWORD;
const machineId = process.env.MACHINEID;

const message_prefix = process.env.MESSAGE_PREFIX;
const discord_bot_token = process.env.DISCORD_BOT_TOKEN;
const discord_channel_id = process.env.DISCORD_CHANNEL_ID;
const discord_message_id = process.env.DISCORD_MESSAGE_ID;

console.log('username: ' + username);

// login to discord
const client = new Client({ intents: [] });

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.login(discord_bot_token);


const loginreq = await fetch("https://api.resonite.com/userSessions", {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'UID': '52588cddda0c008bdf947d365418066f0e48f874e7a1f1459c17cfb5c5858086'
    },
    body: JSON.stringify({
        "secretMachineId": machineId,
        "ownerId": null,
        "email": null,
        "username": username,
        "authentication": {
            "$type": "password",
            "password": password,
            "recoveryCode": null 
        },
        "rememberMe": true
    })
})

const login = await loginreq.json();

const userID = login.entity.userId;
const token = login.entity.token;
const authHeader = `res ${userID}:${token}`;

const onlineUsers = {}
const userDict = {}
let userSessionDict = {}

const printOnlineUsers = async () => {
    let message = `ONLINE LIST: (最終更新: <t:${Math.floor(Date.now() / 1000)}:R>)\n`;
    message += message_prefix + '\n';

    for (const [userId, userSession] of Object.entries(onlineUsers)) {
        const sessions = userSessionDict[userId] ? userSessionDict[userId].join(', ') : 'Private';
        const user = await getUserInfo(userId);
        const device = userSession.outputDevice ? `(${userSession.outputDevice})` : '';
        message += `${user.username}${device} @${sessions}\n`
    }

    console.log(message);

    const channel = await client.channels.fetch(discord_channel_id);
    const targetMessage = await channel.messages.fetch(discord_message_id);

    await targetMessage.edit(message);
}

const getUserInfo = async (userId) => {
    if (!userDict[userId]) {
        const res = await fetch(`https://api.resonite.com/users/${userId}`, {
            method: 'GET',
        })
        const user = await res.json();
        userDict[userId] = user;
    }
    return await userDict[userId];
}

const connection = new HubConnectionBuilder()
    .withUrl("https://api.resonite.com/hub", {
        headers: {
            Authorization: authHeader,
            UID: "3938864707906751945764780632753630221639192417011504763765762939",
            SecretClientAccessKey: "",
        },
        skipNegotiation: true,
        transport: HttpTransportType.WebSockets,
    })
    .configureLogging(LogLevel.Error)
    .build();

connection.on("receivestatusupdate", async (message) => {
    if (message.onlineStatus === "Online") {
        if (!onlineUsers[message.userId]) {
            onlineUsers[message.userId] = message;
            printOnlineUsers();
        }
    } else {
        if (onlineUsers[message.userId]) {
            delete onlineUsers[message.userId];
            printOnlineUsers();
        }
    }
})

async function updateSessionCache() {
    console.log('updating session cache...');
    const sessionsResponse = await fetch('https://api.resonite.com/sessions?includeEmptyHeadless=false&minActiveUsers=1');
    const sessionCache = await sessionsResponse.json();
    let dict = {};
    for (const session of sessionCache) {
        for (const user of session.sessionUsers) {
            if (dict[user.userID]) {
                dict[user.userID].push(session.name);
            } else {
                dict[user.userID] = [session.name];
            }
        }
    }

    userSessionDict = dict;
    printOnlineUsers();
}

setInterval(
    updateSessionCache,
    1000 * 60
);
await updateSessionCache();

console.log('connecting...');
await connection.start();
console.log('connected');

await connection.invoke("InitializeStatus");
await connection.invoke("RequestStatus", null, false);


console.log('READY');

