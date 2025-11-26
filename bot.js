// bot.js
// Bot minimalista para "Impostor" usando mineflayer
// Funcionalidad:
// - Conectarse a servidor Minecraft
// - Escuchar comandos desde chat (!startimpostor, !fin)
// - Tomar lista de jugadores conectados
// - Elegir impostor y palabra aleatoria desde dictionary.txt
// - Enviar mensajes privados con /tell (o comando configurado)
// - Anunciar impostor en chat al finalizar

const fs = require('fs');
const path = require('path');
const mineflayer = require('mineflayer');

const {
  MINECRAFT_HOST = 'localhost',
  MINECRAFT_PORT = '25565',
  BOT_USERNAME = 'ImpostorBot',
  BOT_PASSWORD = '',
  AUTH_TYPE = 'offline', // 'mojang' or 'microsoft' or 'offline'
  DICT_PATH = '/data/dictionary.txt',
  PM_CMD = 'tell', // comando para mensajes privados: "tell" o "msg"
  ADMIN_USERS = '', // coma-separado, si vacío cualquiera puede usar comandos
  MIN_PLAYERS = '2'
} = process.env;

const minPlayers = parseInt(MIN_PLAYERS, 10) || 2;
const adminUsers = ADMIN_USERS.split(',').map(s => s.trim()).filter(Boolean);

// create bot
const bot = mineflayer.createBot({
  host: MINECRAFT_HOST,
  port: parseInt(MINECRAFT_PORT, 10),
  username: BOT_USERNAME,
  password: BOT_PASSWORD || undefined,
  auth: (AUTH_TYPE === 'offline') ? 'offline' : AUTH_TYPE
});

let currentRound = null; // {id, players, impostor, word, startedAt}
let dictionary = [];
const encoding = 'utf8';

// load dictionary
function loadDictionary() {
  try {
    const content = fs.readFileSync(path.resolve(DICT_PATH), encoding);
    dictionary = content.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    console.log(`[DICT] Cargadas ${dictionary.length} palabras desde ${DICT_PATH}`);
  } catch (err) {
    console.error(`[DICT] Error al leer ${DICT_PATH}:`, err.message);
    dictionary = [];
  }
}

// utility: pick random element
function sample(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

// get online players (except bot itself)
function getOnlinePlayers() {
  // mineflayer mantiene bot.players - keys son nombres
  try {
    const players = Object.keys(bot.players || {})
      .filter(n => n && n !== bot.username);
    // In some servers bot.players may not include players immediately.
    return players;
  } catch (err) {
    return [];
  }
}

// send private message (using configured cmd)
function sendPrivate(player, message) {
  const cmd = PM_CMD || 'tell';
  // Use chat command to send private message:
  // /tell <player> <message>
  const full = `/${cmd} ${player} ${message}`;
  console.log(`[PM] -> ${player}: ${message}`);
  bot.chat(full);
}

// start round
function startRound(initiator) {
  if (currentRound) {
    bot.chat(`Ya hay una ronda en curso. Usa !fin para finalizarla.`);
    return;
  }

  // refresh dictionary
  loadDictionary();
  if (dictionary.length === 0) {
    bot.chat(`No hay palabras en el diccionario. Revisa ${DICT_PATH}`);
    return;
  }

  // get players (best-effort)
  let players = getOnlinePlayers();
  // If no players found (some servers), try requesting list via /list and wait for a short time
  if (!players || players.length === 0) {
    console.log('[INFO] No players detected via bot.players, intentando /list para obtener lista...');
    // send /list and collect from chat messages for a short time
    let listCaptured = null;
    const onMessageForList = (jsonMsg, position, message) => {
      try {
        const text = message.toString ? message.toString() : String(message);
        // Some servers print: "There are X/X players online: name, name"
        // We'll attempt to extract names after ':' if present
        const colonIndex = text.indexOf(':');
        if (colonIndex !== -1 && text.toLowerCase().includes('players')) {
          const after = text.slice(colonIndex + 1).trim();
          if (after.length > 0) {
            listCaptured = after.split(',').map(s => s.trim()).filter(Boolean);
          }
        }
      } catch (e) { /* ignore */ }
    };

    bot.on('message', onMessageForList);
    bot.chat('/list');

    // wait up to 1500ms for response
    const waitUntil = Date.now() + 1500;
    while (Date.now() < waitUntil && listCaptured === null) {
      // busy-wait small pause
      const now = Date.now();
      const end = now + 50;
      while (Date.now() < end) {}
    }
    bot.removeListener('message', onMessageForList);
    if (listCaptured && listCaptured.length > 0) players = listCaptured.filter(n => n !== bot.username);
  }

  // final filter and dedupe
  players = Array.from(new Set((players || []).map(s => s.trim()).filter(Boolean)));
  if (players.length < minPlayers) {
    bot.chat(`No hay suficientes jugadores conectados (mínimo ${minPlayers}). Conectados: ${players.length}`);
    return;
  }

  const word = sample(dictionary);
  const impostor = sample(players);

  // assign words to players: everyone gets the same word except impostor who gets "IMPOSTOR"
  currentRound = {
    id: Date.now(),
    players,
    impostor,
    word,
    startedAt: new Date().toISOString()
  };

  // send PMs
  players.forEach(p => {
    if (p === impostor) {
      sendPrivate(p, 'ERES EL IMPOSTOR');
    } else {
      sendPrivate(p, `Tu palabra es: ${word}`);
    }
  });

  //bot.chat(`Ronda iniciada por ${initiator || 'admin'}. Jugadores: ${players.length}. ¡Suerte!`);
  console.log(`[ROUND START] id=${currentRound.id} impostor=${impostor} word=${word} players=${players.join(', ')}`);
}

// end round
function endRound(requester) {
  if (!currentRound) {
    bot.chat('No hay ninguna ronda en curso.');
    return;
  }

  bot.chat(`La ronda ha terminado. El impostor era: ${currentRound.impostor}. La palabra era: ${currentRound.word}`);
  console.log(`[ROUND END] id=${currentRound.id}`);
  currentRound = null;
}

// check if username is admin
function isAdmin(username) {
  if (!adminUsers || adminUsers.length === 0) return true; // if no admins configured, allow anyone
  return adminUsers.includes(username);
}

// handle chat commands
bot.on('chat', (username, message) => {
  try {
    // ignore messages from the bot itself
    if (username === bot.username) return;

    const msg = (message || '').trim();
    if (!msg.startsWith('!')) return;

    const parts = msg.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    if (!isAdmin(username)) {
      bot.chat(`Usuario ${username} no autorizado para usar comandos.`);
      return;
    }

    if (cmd === '!startimpostor') {
      bot.chat("SE INICIA UNA NUEVA RONDA DEL IMPOSTOR");
      startRound(username);
    } else if (cmd === '!fin' || cmd === '!endimpostor') {
      endRound(username);
    } else if (cmd === '!status') {
      if (!currentRound) {
        bot.chat('No hay ronda en curso.');
      } else {
        bot.chat(`Ronda activa. Jugadores: ${currentRound.players.length}. Iniciada por: ${username}.`);
      }
    } else if (cmd === '!reloadwords') {
      loadDictionary();
      bot.chat(`Diccionario recargado. Palabras disponibles: ${dictionary.length}`);
    }
  } catch (err) {
    console.error('Error procesando chat:', err);
  }
});

// log connection events
bot.on('login', () => {
  console.log(`[BOT] Conectado como ${bot.username} a ${MINECRAFT_HOST}:${MINECRAFT_PORT}`);
  loadDictionary();
});

bot.on('end', () => {
  console.log('[BOT] Desconectado del servidor.');
  // don't exit, let docker restart policy handle reconnection
});

bot.on('error', (err) => {
  console.error('[BOT ERROR]', err && err.message ? err.message : err);
});
