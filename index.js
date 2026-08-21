const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('Bot online!'));
app.listen(process.env.PORT || 3000);

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { 
  joinVoiceChannel, 
  VoiceConnectionStatus, 
  entersState 
} = require('@discordjs/voice');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let voiceConnection = null;
let tempoEntrada = null;
const ARCHIVE_CALL = './call_salva.json';

// Salva a call em arquivo
function salvarDadosCall(guildId, channelId, timestamp) {
  const dados = { guildId, channelId, timestamp };
  fs.writeFileSync(ARCHIVE_CALL, JSON.stringify(dados, null, 2));
}

// Apaga o registro salvo quando o bot sai com o comando
function limparDadosCall() {
  if (fs.existsSync(ARCHIVE_CALL)) {
    fs.unlinkSync(ARCHIVE_CALL);
  }
}

// Conecta na call
function conectarNaCall(channel, guild) {
  voiceConnection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false
  });

  voiceConnection.on(VoiceConnectionStatus.Disconnected, async () => {
    // Se a conexão foi destruída propositalmente pelo /saircall, ignora
    if (!voiceConnection) return;

    console.log('⚠️ Conexão oscilou! Tentando reconectar imediatamente...');
    try {
      await Promise.race([
        entersState(voiceConnection, VoiceConnectionStatus.Signalling, 5000),
        entersState(voiceConnection, VoiceConnectionStatus.Connecting, 5000),
      ]);
    } catch (error) {
      console.log('❌ Falha na reconexão rápida. Forçando reconexão do zero...');
      conectarNaCall(channel, guild);
    }
  });

  voiceConnection.on(VoiceConnectionStatus.Ready, () => {
    console.log(`✅ Conectado firmemente no canal: ${channel.name}`);
  });
}

client.on('ready', async () => {
  console.log(`🤖 Bot Imorrível ligado como ${client.user.tag}!`);

  if (fs.existsSync(ARCHIVE_CALL)) {
    try {
      const dados = JSON.parse(fs.readFileSync(ARCHIVE_CALL));
      const guild = client.guilds.cache.get(dados.guildId);
      if (guild) {
        const channel = guild.channels.cache.get(dados.channelId);
        if (channel) {
          tempoEntrada = dados.timestamp;
          console.log(`🔄 Bot reiniciou! Voltando automaticamente para a call: ${channel.name}`);
          conectarNaCall(channel, guild);
        }
      }
    } catch (e) {
      console.error('Erro ao ler arquivo de call salva:', e);
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // COMANDO: /entrarcall
  if (interaction.commandName === 'entrarcall') {
    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({ 
        content: 'Você precisa estar em um canal de voz para eu entrar!', 
        ephemeral: true 
      });
    }

    if (voiceConnection || tempoEntrada) {
      return interaction.reply({
        content: `❌ **Eu já estou morando em uma call!** Use \`/temponacall\` para ver há quanto tempo estou lá.`,
        ephemeral: true
      });
    }

    tempoEntrada = Date.now();
    salvarDadosCall(interaction.guild.id, voiceChannel.id, tempoEntrada);
    conectarNaCall(voiceChannel, interaction.guild);

    interaction.reply(`Entrei na call **${voiceChannel.name}**. Salvei o canal no meu sistema: **EU NUNCA MAIS SAIO DAQUI!** ⛺`);
  }

  // COMANDO: /saircall (NOVO)
  if (interaction.commandName === 'saircall') {
    if (!voiceConnection && !tempoEntrada) {
      return interaction.reply({
        content: 'Eu nem estou em nenhuma call para poder sair!',
        ephemeral: true
      });
    }

    // Apaga a gravação em arquivo para ele não voltar ao reiniciar
    limparDadosCall();

    if (voiceConnection) {
      const conn = voiceConnection;
      voiceConnection = null; // Anula antes de destruir para o listener de auto-reconexão ignorar
      conn.destroy();
    }

    tempoEntrada = null;
    interaction.reply('👋 Tchau galera! Me tiraram do meu lar, até a próxima.');
  }

  // COMANDO: /temponacall
  if (interaction.commandName === 'temponacall') {
    if (!tempoEntrada) {
      return interaction.reply({ 
        content: 'Eu nem tô em nenhuma call ainda! Usa `/entrarcall` primeiro.', 
        ephemeral: true 
      });
    }

    const msNaCall = Date.now() - tempoEntrada;
    const segundosTotais = Math.floor(msNaCall / 1000);
    const dias = Math.floor(segundosTotais / 86400);
    const horas = Math.floor((segundosTotais % 86400) / 3600);
    const minutos = Math.floor((segundosTotais % 3600) / 60);
    const segundos = segundosTotais % 60;

    let textoTempo = '';
    if (dias > 0) textoTempo += `${dias}d `;
    if (horas > 0 || dias > 0) textoTempo += `${horas}h `;
    if (minutos > 0 || horas > 0 || dias > 0) textoTempo += `${minutos}m `;
    textoTempo += `${segundos}s`;

    interaction.reply(`Estou morando nessa call há exatamente **${textoTempo}** sem sair! 🏆`);
  }

  // COMANDO: /roleta
  if (interaction.commandName === 'roleta') {
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({ 
        content: 'Você precisa estar em um canal de voz para jogar a roleta!', 
        ephemeral: true 
      });
    }

    const membros = voiceChannel.members.filter(m => !m.user.bot);

    if (membros.size === 0) {
      return interaction.reply({ 
        content: 'Não tem nenhuma pessoa real na call para ser desconectada!', 
        ephemeral: true 
      });
    }

    const vitima = membros.random();

    try {
      await vitima.voice.disconnect('Perdeu na roleta russa de voz!');
      interaction.reply(`🎰 A roleta girou... e o **${vitima.user.username}** FOI EXPULSO DA CALL! 💥`);
    } catch (error) {
      interaction.reply(`🎰 O sorteado foi **${vitima.user.username}**, mas não consegui desconectar ele! (Verifique se tenho a permissão de *Mover Membros*).`);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);