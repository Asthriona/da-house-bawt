const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("user")
        .setDescription("Provides information about the user."),

    async execute(client, interaction) {
        await interaction.reply(`This commands was ran by ur mom lmao ${interaction.user.username} - ${interaction.member.joinedAt}`);
    }
}
