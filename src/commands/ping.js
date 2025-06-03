const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("pong"),

    async execute(client, interaction) {
        await interaction.reply("pong");
    }
}
