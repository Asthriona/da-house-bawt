require("dotenv").config();
const { readdirSync, readFileSync} = require("fs");
const path = require("path");
const { Client, Events, GatewayIntentBits, SlashCommandBuilder, Collection, PermissionsBitField } = require("discord.js");
const fetch = require("node-fetch")

const client = new Client({ intents: [ GatewayIntentBits.Guilds ]});

// Command Handler shit
client.commands = new Collection();

const commandPath = path.join(__dirname, "commands");
const commandFiles = readdirSync(commandPath).filter(file => file.endsWith(".js"));
for (const file of commandFiles) {
    const filePath = path.join(commandPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, readyClient => {
    console.log(`Client is ready as ${readyClient.user.tag}`);
    console.log(`Starting icon rotation`)
    const imageUrls = ["https://cdn.asthriona.com/i/2025/06/guildimg1.png", "https://cdn.asthriona.com/i/2025/06/guildimg2.png", "https://cdn.asthriona.com/i/2025/06/firefox_250603-131308.png", "https://cdn.asthriona.com/i/2025/06/firefox_250603-131322.png"];
    iconRotation(client, process.env.GUILDID, imageUrls);
})


client.on(Events.InteractionCreate, interaction => {
    if(interaction.isChatInputCommand) {
        console.log(interaction.guild.id)
        const { commandName } = interaction;
        const command = client.commands.get(commandName);
        if(!command) return;
        try {
            command.execute(client, interaction);
        } catch (err) {
            return console.error(err)
        }
    }
})


// Function to do the shit.
/** 
    * Starts a loop that update the server icon every hours or so. I guess. who cares?
    * @param {Client} client - The discord bot duh.
    * @param {string} guildId -  The guild to which we want to change the icon.
    * @param {string[]} imageURL - Array of image URLs.
*/
async function iconRotation(client, guildId, imageUrls) {
    const guild = await client.guilds.fetch(guildId);
    if(!guild) {
        return console.error(`Can't find guild with Id ${guildId}`);
    }
    const me = guild.members.me;
    if(!me.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return console.error(`I'm missing the Manage Guild permission in ${guild.name}`);
    }

    let index = 0;
    const rotate = async () => {
        const imageURl = imageUrls[index % imageUrls.length];
        try {
            const res = await fetch(imageURl);
            const buffer = await res.buffer();

            await guild.setIcon(buffer);
            console.log(`[ICON]: Changed guild Icon to ${imageURl}`);
        } catch (err) {
            console.error(err);
        }
        index++;
    }
    rotate();
    setInterval(rotate, 2000*60*60);
}


client.login(process.env.TOKEN);
