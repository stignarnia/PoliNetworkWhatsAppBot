import * as wa from '@adiwajshing/baileys'
import * as fs from 'fs'
import * as readline from 'readline'

const conn = new wa.WAConnection() // instantiate
var ready = 0
var myGroups = []
var thrustedUsers = []

async function main() {
    conn.autoReconnect = wa.ReconnectMode.onConnectionLost // only automatically reconnect when the connection breaks
    // conn.logger.level = 'debug' // set to 'debug' to see what kind of stuff you can implement
    // attempt to reconnect at most 10 times in a row
    conn.connectOptions.maxRetries = 10

    // loads the auth file credentials if present
    /*  Note: one can take this auth_info.json file and login again from any computer without having to scan the QR code, 
        and get full access to one's WhatsApp. Despite the convenience, be careful with this file */
    fs.existsSync('./auth_info.json') && conn.loadAuthInfo('./auth_info.json')

    await conn.connect()
    // credentials are updated on every connect
    const authInfo = conn.base64EncodedAuthInfo() // get all the auth info we need to restore this session
    fs.writeFileSync('./auth_info.json', JSON.stringify(authInfo, null, '\t')) // save this info to a file

    conn.on('contacts-received', () => {
        ready++
        initialize()
    })
    conn.on('chats-received', () => {
        ready++
        initialize()
    })

    /**
     * The universal event for anything that happens
     * New messages, updated messages, read & delivered messages, participants typing etc.
     */
    conn.on('chat-update', async chat => {
        // only do something when a new message is received
        if (!chat.hasNewMessage) {
            return
        }

        const m = chat.messages.all()[0] // pull the new message from the update
        const messageContent = m.message
        const id = chat.jid

        if (wa.isGroupID(id)) {
            updateGroups(id)
            /*var participants = (await conn.groupMetadata(id)).participants
            participants.forEach(element => {
                console.log(element)
            })*/
        }

        // if it is not a regular text or media message
        if (!messageContent) {
            return
        }

        var sender = m.key.remoteJid
        const messageType = Object.keys(messageContent)[0] // message will always contain one key signifying what kind of message
        if (messageType == wa.MessageType.text && thrustedUsers.includes(sender)) {
            const text = m.message.conversation
            if (text == "!resetGroups") {
                resetGroups();
            } else if (text.includes("!addThrustedUser")) {

            }
        }

        /*
        // send a reply after 3 seconds
        setTimeout(async () => {
            await conn.chatRead(m.key.remoteJid) // mark chat read

            const options: wa.MessageOptions = { quoted: m }
            let content
            let type: wa.MessageType
            content = 'hello!' // send a "hello!" & quote the message recieved
            type = wa.MessageType.text
            const response = await conn.sendMessage(m.key.remoteJid, content, type, options)
            console.log("sent message with ID '" + response.key.id + "' successfully")
        }, 3 * 1000)
        */
    })

    conn.on('close', ({ reason, isReconnecting }) => (
        console.log('oh no got disconnected: ' + reason + ', reconnecting: ' + isReconnecting)
    ))
}

function initialize() {
    if (ready == 2) {
        getGroups()
        getThrustedUsers()
    }
}

async function getThrustedUsers() {
    if (fs.existsSync('./thrusted_users.json')) {
        thrustedUsers = JSON.parse(fs.readFileSync('./thrusted_users.json').toString())
    } else {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        await rl.question("There are no thrusted users that can give commands to this bot, please provide one via their phone number (you will be able to add more using !newThrustedUser <number> inside the bot) [example: +39 123 456 789 becomes 39123456789]\n", async (answer) => {
            const exists = await conn.isOnWhatsApp(answer)
            if (exists) {
                console.log("Thrusted user added successfully, running the bot")
                thrustedUsers.push(exists.jid)
                fs.writeFileSync('./thrusted_users.json', JSON.stringify(thrustedUsers, null, '\t'))
                rl.close();
            } else {
                console.log("What you entered is not a WhatsApp user, please retry")
                throw new Error()
            }
        });
    }
}

function getGroups() {
    conn.chats.all().forEach(element => {
        if (wa.isGroupID(element.jid)) {
            myGroups.push(element.jid)
        }
    })
}

function updateGroups(id) {
    if (!myGroups.includes(id)) {
        myGroups.push(id)
    }
}

function resetGroups() {
    myGroups = []
    getGroups()
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

main().catch((err) => console.log(`encountered error: ${err}`))