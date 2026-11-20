const { AttachmentBuilder, SlashCommandBuilder } = require("discord.js");
const { GIFEncoder, applyPalette, quantize } = require("gifenc");
const fetch = require("node-fetch");
const sharp = require("sharp");

const SIZE = 256;
const FRAME_COUNT = 20;
const USERNAME_EASTER_EGG_CHANCE = 0.01;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const TRANSPARENT_BACKGROUND = { r: 255, g: 255, b: 255, alpha: 0 };

module.exports = {
    data: new SlashCommandBuilder()
        .setName("spin")
        .setDescription("Make a spinning GIF from an image.")
        .addAttachmentOption(option =>
            option.setName("image")
                .setDescription("Image to spin; otherwise the latest image above is used.")),

    async execute(client, interaction) {
        await interaction.deferReply();

        try {
            const imageUrl = await getImageUrl(interaction);
            let image;

            if (imageUrl) {
                try {
                    image = await downloadImage(imageUrl);
                } catch (error) {
                    console.warn("Could not use the selected image; using the avatar instead.", error);
                }
            }

            if (!image) {
                if (Math.random() < USERNAME_EASTER_EGG_CHANCE) {
                    image = Buffer.from(createUsernameSvg(interaction.user.username));
                } else {
                    const avatarUrl = interaction.user.displayAvatarURL({ extension: "png", size: SIZE });
                    image = await downloadImage(avatarUrl);
                }
            }

            const gif = await createSpinningGif(image);
            const attachment = new AttachmentBuilder(gif, { name: "spin.gif" });
            await interaction.editReply({ files: [attachment] });
        } catch (error) {
            console.error("Failed to create spinning GIF:", error);
            await interaction.editReply("I couldn't create the spinning GIF. Please try another image.");
        }
    }
};

async function getImageUrl(interaction) {
    const suppliedImage = interaction.options.getAttachment("image");
    if (suppliedImage) return suppliedImage.url;

    try {
        const messages = await interaction.channel.messages.fetch({ limit: 10 });
        const previousMessage = messages.find(message => message.author.id !== interaction.client.user.id);
        if (!previousMessage) return null;

        const attachment = previousMessage.attachments.find(item =>
            !item.contentType || item.contentType.startsWith("image/"));
        if (attachment) return attachment.url;

        const previewImage = previousMessage.embeds
            .flatMap(embed => [embed.image, embed.thumbnail])
            .find(image => image?.proxyURL);
        if (previewImage) return previewImage.proxyURL;

        const linkedImage = previousMessage.content.match(/https?:\/\/[^\s<>]+/g)
            ?.map(link => link.replace(/[),.!?]+$/, ""))
            .find(isDiscordImageUrl);
        return linkedImage ?? null;
    } catch (error) {
        console.warn("Could not inspect the previous channel message:", error);
        return null;
    }
}

async function downloadImage(url) {
    if (!isDiscordImageUrl(url)) {
        throw new Error("Image URL must use a Discord image CDN host");
    }

    const response = await fetch(url, { timeout: 15000, redirect: "error" });
    if (!response.ok) throw new Error(`Image request failed with status ${response.status}`);

    const contentLength = Number(response.headers.get("content-length"));
    if (contentLength > MAX_IMAGE_BYTES) throw new Error("Image exceeds the 15 MB limit");

    const image = await response.buffer();
    if (image.length > MAX_IMAGE_BYTES) throw new Error("Image exceeds the 15 MB limit");
    return image;
}

function isDiscordImageUrl(url) {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.protocol === "https:"
            && (parsedUrl.hostname === "cdn.discordapp.com"
                || parsedUrl.hostname === "media.discordapp.net"
                || /^images-ext-\d+\.discordapp\.net$/.test(parsedUrl.hostname));
    } catch {
        return false;
    }
}

function createUsernameSvg(username) {
    const safeUsername = username.replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;"
    })[character]);
    const fontSize = Math.min(42, Math.max(10, Math.floor(220 / username.length)));

    return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="white"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="${fontSize}" font-weight="700" fill="#202020">${safeUsername}</text></svg>`;
}

async function createSpinningGif(image) {
    const circleMask = Buffer.from(
        `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg"><circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2}" fill="white"/></svg>`
    );
    const normalized = await sharp(image)
        .rotate()
        .resize(SIZE, SIZE, { fit: "cover", position: "centre" })
        .composite([{ input: circleMask, blend: "dest-in" }])
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const encoder = GIFEncoder();

    for (let frameNumber = 0; frameNumber < FRAME_COUNT; frameNumber++) {
        const angle = frameNumber * (360 / FRAME_COUNT);
        const rotated = await sharp(normalized.data, {
            raw: { width: SIZE, height: SIZE, channels: normalized.info.channels }
        })
            .rotate(angle, { background: TRANSPARENT_BACKGROUND })
            .toBuffer({ resolveWithObject: true });
        const frame = await sharp(rotated.data, {
            raw: {
                width: rotated.info.width,
                height: rotated.info.height,
                channels: rotated.info.channels
            }
        })
            .extract({
                left: Math.floor((rotated.info.width - SIZE) / 2),
                top: Math.floor((rotated.info.height - SIZE) / 2),
                width: SIZE,
                height: SIZE
            })
            .ensureAlpha()
            .raw()
            .toBuffer();
        const palette = quantize(frame, 256, { format: "rgba4444", oneBitAlpha: true });
        const transparentIndex = palette.findIndex(color => color[3] === 0);
        const indexedFrame = applyPalette(frame, palette, "rgba4444");

        encoder.writeFrame(indexedFrame, SIZE, SIZE, {
            palette,
            transparent: transparentIndex !== -1,
            transparentIndex: Math.max(transparentIndex, 0),
            delay: 80,
            repeat: 0
        });
    }

    encoder.finish();
    return Buffer.from(encoder.bytes());
}