const { SlashCommandBuilder } = require("discord.js");
const fetch = require("node-fetch")
module.exports = {
    data: new SlashCommandBuilder()
        .setName("rotate")
        .setDescription("rotate icon")
        .addStringOption(option => 
            option.setName("url")
                .setDescription("Fuck you.")
                .setRequired(true)),

    async execute(client, interaction) {

        const url = interaction.options.getString('url');
        if(!url.endsWith(".png") && !url.endsWith(".jpg")) return interaction.reply("error, URL invalid.");
        try { 
            console.log("Getting the image abd wgarbnit")
            const res = await fetch(url);
            const buffer = await res.buffer();

            await interaction.guild.setIcon(buffer)
            .then(() => {
                interaction.reply("OK~!")
            })
        } catch(err) {
            console.error(err);
            return interaction.reply(`Shit went wrong.\n\`\`\`${err.message}\`\`\``)
        }
    }
}
