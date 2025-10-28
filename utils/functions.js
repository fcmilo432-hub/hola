import moment from "moment";
import { saveConfig } from "./storage.js";
import { getAdminList, sendReport } from "../commands/moderation.js";
import { handleSystemCommand } from "../commands/system.js";
import { handleLevelsCommand, handleDeleteLevelCommand, handleListLevelsCommand } from "../commands/levels.js";
// import { randomDelay, commandDelay, reportDelay, responseDelay } from "./delay.js"; // ← AÑADIR ESTA LÍNEA

// Variable global para almacenar el tiempo de inicio
let startTime = Date.now();

export async function handleMessage(sock, msg, config) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const body =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    "";

  // 🎯 COMANDO KICK SIEMPRE CON # (independiente del prefijo configurado)
  if (body.startsWith('#kick')) {
    // Verificar si el bot está activo en este chat
    if (config.botActive && config.botActive[from] === false) {
      return;
    }

    // Solo ejecutar en grupos
    if (!from.endsWith("@g.us")) {
      await sock.sendMessage(from, {
        text: "> ❌ El comando #kick solo funciona en grupos.",
      });
      return;
    }

    try {
      // Obtener lista de administradores
      const admins = await getAdminList(sock, from);
      const isSenderAdmin = admins.includes(sender);

      // Obtener número del bot
      const botNumber = sock.user.id.split(":")[0] + "@s.whatsapp.net";

      // Si no es admin, no puede usar el comando
      if (!isSenderAdmin) {
        await sock.sendMessage(from, {
          text: "> ❌ Solo los administradores pueden usar el comando #kick.",
        });
        return;
      }

      // Determinar el usuario objetivo
      let targetUser = null;
      if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
        targetUser = msg.message.extendedTextMessage.contextInfo.participant;
      } else if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
        targetUser = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
      }

      // Si no se menciona o responde a alguien
      if (!targetUser) {
        await sock.sendMessage(from, {
          text: "> ❌ Debes mencionar o responder al usuario que será expulsado.",
        });
        return;
      }

      // Evitar auto-expulsión o expulsar al bot
      if (targetUser === sender || targetUser === botNumber) {
        return;
      }

      // Verificar si el objetivo es administrador
      const isTargetAdmin = admins.some(a => a.replace(/@s\.whatsapp\.net$/, '') === targetUser.replace(/@s\.whatsapp\.net$/, ''));
      if (isTargetAdmin) {
        await sock.sendMessage(from, {
          text: "> ❌ No puedo eliminar a un administrador del grupo.",
        });
        return;
      }

      // ✅ Expulsar al usuario
      await sock.groupParticipantsUpdate(from, [targetUser], "remove");
     

      // ✅ SISTEMA DE REPORTES - Se ejecuta después de la expulsión exitosa
      await sendReport(sock, msg, body, config, sender, from);

    } catch (error) {
      console.error("Error en comando #kick:", error);
      await sock.sendMessage(from, {
        text: "Z ❌ Error al intentar eliminar al usuario del grupo.",
      });
    }
    return;
  }

  // 🧩 RESTO DE COMANDOS CON EL PREFIJO CONFIGURADO
  if (!body.startsWith(config.prefix)) return;

  const [command, ...args] = body.slice(config.prefix.length).trim().split(/ +/);

  // Verificar si el bot está activo en este chat
  if (config.botActive && config.botActive[from] === false) {
    // ✅ EXCEPCIÓN: Estos comandos SIEMPRE funcionan aunque el bot esté desactivado
    const alwaysAllowedCommands = ["bot", "estado", "setrev", "setg1", "setg2", "report", "reload", "prefix", "setowner", "rev"];
    const isAlwaysAllowed = alwaysAllowedCommands.includes(command.toLowerCase());

    if (!isAlwaysAllowed) {
      return; // Solo bloquea comandos que NO son .bot o .estado
    }
  }

  // Obtener lista de admins solo si es grupo
  let admins = [];
  let isAdmin = false;
  if (from.endsWith("@g.us")) {
    admins = await getAdminList(sock, from);
    isAdmin = admins.includes(sender);
  }

  const isOwner = sender === config.owner;

  // 🧱 Solo admins pueden usar comandos (en grupos)
  // En chats privados, solo el owner puede usar comandos
  if (from.endsWith("@g.us")) {
    // En grupos: solo admins pueden usar comandos
    if (!isAdmin) {
      return sock.sendMessage(from, {
        text: "❌ Solo los administradores pueden usar comandos del bot.",
      });
    }
  } else {
    // En chats privados: solo el owner puede usar comandos
    if (!isOwner) {
      return sock.sendMessage(from, {
        text: "❌ Solo el owner puede usar comandos en chats privados.",
      });
    }
  }

  // 🔄 RETRASO ANTES DE PROCESAR COMANDO
  //await responseDelay();

  switch (command.toLowerCase()) {
    case "prefix":
    case "bot":
    case "report":
    case "reload":
    case "setowner":
    case "setg1":
    case "setg2":
    case "setrev":
      await handleSystemCommand(sock, from, sender, command, args, config, isOwner);
      break;

    case "addlevel":
      await handleLevelsCommand(sock, from, args, config, isOwner);
      break;

    case "dellevel":
      await handleDeleteLevelCommand(sock, from, args, config, isOwner);
      break;

    case "level":
    case "levels":
      await handleListLevelsCommand(sock, from, config);
      break;

    case "ping":
    case "p":
      const start = Date.now();
      await sock.sendMessage(from, { text: "🏓 Pong!" });
      const latency = Date.now() - start;
      await sock.sendMessage(from, { text: `⚡ Velocidad de respuesta: ${latency}ms` });
      break;

    case "rev":
      await handleRevCommand(sock, msg, config, sender, from);
      break;

    case "uso":
    case "help":
    case "ayuda":
      const usoText = `
      ═══━━━─── •◆• ───━━━═══╗
      𓆩 𝐌𝐀𝐍𝐔𝐀𝐋 𝐃𝐄 𝐔𝐒𝐎 𝐃𝐄𝐋 𝐁𝐎𝐓 𓆪
═══━━━─── •◆• ───━━━═══╝

✦•๑⋅⋯ 𝐈. 𝐑𝐄𝐏𝐎𝐑𝐓𝐄𝐒 ⋯⋅๑·✦
❒ Comando: #kick  
   • #kick @usuario motivo  
   • #kick (respondiendo al mensaje) motivo  

📋 Efecto:  
   Expulsa al usuario y envía reporte automático al grupo G1 o G2.  

📢 Ejemplo de reporte:  
   — Grupo origen: G1  
   — Expulsión por: @Milo  
   — Usuario expulsado: @muzan kibutsuji  
   — Fecha: 16/10/2025 17:14  
   — Motivo: escribir al prv sin permiso  
   — Gravedad: 🟡

═══━━━─── •◆• ───━━━═══╗
      𓆩 𝐌𝐎́𝐃𝐔𝐋𝐎: 𝐍𝐈𝐕𝐄𝐋𝐄𝐒 𝐃𝐄 𝐅𝐀𝐋𝐓𝐀𝐒 𓆪
═══━━━─── •◆• ───━━━═══╝

✦•๑⋅⋯ 𝐈𝐈. 𝐍𝐈𝐕𝐄𝐋𝐄𝐒 ⋯⋅๑·✦
❒ Agregar nivel: addlevel palabra emoji  
   Ej: ${config.prefix}addlevel spam 🟡  

❒ Eliminar nivel: ${config.prefix}dellevel palabra  
   Ej: ${config.prefix}dellevel spam  

❒ Ver niveles: ${config.prefix}level

═══━━━─── •◆• ───━━━═══╗
      𓆩 𝐌𝐎́𝐃𝐔𝐋𝐎: 𝐑𝐄𝐕𝐈𝐒𝐈𝐎́𝐍 𝐃𝐄 𝐂𝐎𝐍𝐓𝐄𝐍𝐈𝐃𝐎 𓆪
═══━━━─── •◆• ───━━━═══╝

✦•๑⋅⋯ 𝐈𝐈𝐈. 𝐑𝐄𝐕𝐈𝐒𝐈𝐎́𝐍 ⋯⋅๑·✦
❒ Reenviar contenido: ${config.prefix}rev  
   (Debe responder al mensaje que se desea enviar)

═══━━━─── •◆• ───━━━═══╗
 𓆩 𝐌𝐎́𝐃𝐔𝐋𝐎: 𝐆𝐄𝐒𝐓𝐈𝐎́𝐍 𝐃𝐄 𝐆𝐑𝐔𝐏𝐎𝐒 𓆪
═══━━━─── •◆• ───━━━═══╝

✦•๑⋅⋯ 𝐈𝐕. 𝐆𝐑𝐔𝐏𝐎𝐒 ⋯⋅๑·✦
❒ ${config.prefix}setg1 on/off → Configura grupo como G1  
❒ ${config.prefix}setg2 on/off → Configura grupo como G2  
❒ ${config.prefix}report g1 on/off → Activa reportes de G1  
❒ ${config.prefix}report g2 on/off → Activa reportes de G2

═══━━━─── •◆• ───━━━═══╗
      𓆩 𝐌𝐎́𝐃𝐔𝐋𝐎: 𝐑𝐄𝐄𝐍𝐕𝐈𝐎𝐒 𓆪
═══━━━─── •◆• ───━━━═══╝

✦•๑⋅⋯ 𝐕. 𝐑𝐄𝐄𝐍𝐕𝐈𝐎𝐒 ⋯⋅๑·✦
❒ ${config.prefix}setrev g1 on/off → Destino de reenvíos G1  
❒ ${config.prefix}setrev g2 on/off → Destino de reenvíos G2  
❒ ${config.prefix}rev → Reenvía contenido (responder al mensaje)

═══━━━─── •◆• ───━━━═══╗
      𓆩 𝐌𝐎́𝐃𝐔𝐋𝐎: 𝐂𝐎𝐍𝐅𝐈𝐆𝐔𝐑𝐀𝐂𝐈𝐎́𝐍 𓆪
═══━━━─── •◆• ───━━━═══╝

✦•๑⋅⋯ 𝐕𝐈. 𝐂𝐎𝐍𝐅𝐈𝐆𝐔𝐑𝐀𝐂𝐈𝐎́𝐍 ⋯⋅๑·✦
❒ ${config.prefix}bot on/off → Activa o desactiva el bot en el grupo

✦•๑⋅⋯ 𝐕𝐈𝐈. 𝐂𝐎𝐌𝐀𝐍𝐃𝐎𝐒 𝐀𝐃𝐃𝐈𝐂𝐈𝐎𝐍𝐀𝐋𝐄𝐒 ⋯⋅๑·✦
❒ ${config.prefix}estado → Estado del bot y configuración  
❒ ${config.prefix}ping o ${config.prefix}p → Velocidad de respuesta  
❒ ${config.prefix}menu → Lista de comandos disponibles  
❒ ${config.prefix}uso → Ver este manual

═══━━━─── •◆• ───━━━═══╗
      𓆩 𝐅𝐈𝐍 𝐃𝐄𝐋 𝐌𝐀𝐍𝐔𝐀𝐋 𓆪
═══━━━─── •◆• ───━━━═══╝
                       `.trim();

      await sock.sendMessage(from, { text: usoText });
      break;

    case "menu":
      const menu = `
╭━━━[ 🌟 *Menú DataCheck* 🌟 ]━━━╮
┃ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ ⚙️ *${config.prefix}prefix* - Cambiar prefijo
┃ 🤖 *${config.prefix}bot on/off* - Activar/desactivar bot
┃ 🏷️ *${config.prefix}setg1 on/off* - Configurar grupo como G1
┃ 🏷️ *${config.prefix}setg2 on/off* - Configurar grupo como G2
┃ ➕ *${config.prefix}addlevel* - Añadir nivel
┃ ❌ *${config.prefix}dellevel* - Eliminar nivel
┃ 📋 *${config.prefix}level* - Ver niveles
┃ 📤 *${config.prefix}report g1 on/off* - Destino de reportes para G1
┃ 📤 *${config.prefix}report g2 on/off* - Destino de reportes para G2
┃ 📤 *${config.prefix}setrev g1 on/off* - Destino de reenvíos para G1
┃ 📤 *${config.prefix}setrev g2 on/off* - Destino de reenvíos para G2
┃ 📤 *${config.prefix}rev* - Reenviar contenido
┃ 🔄 *${config.prefix}reload* - Reiniciar bot
┃ 👑 *${config.prefix}setowner* - Cambiar owner
┃ 🩺 *${config.prefix}estado* - Ver estado del bot
┃ 🏓 *${config.prefix}ping* - Ver velocidad
┃ 📖 *${config.prefix}uso* - Manual de uso
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

*💡 NOTAS IMPORTANTES:*
• #kick siempre usa el prefijo # (no cambia)
• Los niveles asignan gravedad automáticamente
• Ej: "spam" → 🟡, "estafa" → 🟠, "+18" → ⚫
• Los reportes se envían al chat configurado *G1 o G2*
`;
      await sock.sendMessage(from, { text: menu });
      break;

    case "estado":
      const botStatus = config.botActive && config.botActive[from] ? "✅ Activado" : "❌ Desactivado";

      // Obtener configuración de grupo - CORREGIDO
      const groupType = config.groupTypes && config.groupTypes[from] ? config.groupTypes[from] : null;
      const groupStatus = groupType ? `🏷️ ${groupType.toUpperCase()}` : "❌ No configurado";

      // Verificar reportes activos para este grupo - CORREGIDO
      let reportStatus = "❌ Desactivado";
      if (groupType && config.reportGroupActive && config.reportGroupActive[groupType]) {
        reportStatus = "✅ Activado";
      }

      // Verificar reenvíos activos para este grupo - CORREGIDO
      let revStatus = "❌ Desactivado";
      if (groupType && config.revGroupActive && config.revGroupActive[groupType]) {
        revStatus = "✅ Activado";
      }

      // Calcular uptime
      const uptime = calculateUptime();

      // Mostrar solo el número de niveles
      const numeroNiveles = Object.keys(config.levels || {}).length;

      await sock.sendMessage(from, {
        text: `🤖 *Estado del Bot*\n\n` +
          `⚙️ Prefijo actual: ${config.prefix}\n` +
          `🎯 Comando kick: # (fijo)\n` +
          `📊 Reportes: ${reportStatus}\n` +
          `📤 Reenvíos: ${revStatus}\n` +
          `🔧 Bot: ${botStatus}\n` +
          `🏷️ Tipo de grupo: ${groupStatus}\n` +
          `⏰ Uptime: ${uptime}\n` +
          `👑 Owner: ${config.owner ? config.owner.split('@')[0] : 'No configurado'}\n` +
          `👥 Modo: ${from.endsWith('@g.us') ? 'Grupo - Comandos para admins' : 'Privado - Solo owner'}\n` +
          `📋 Niveles: ${numeroNiveles}`
      });
      break;
  }
}

// Función para manejar el comando rev
async function handleRevCommand(sock, msg, config, sender, from) {
  try {
    // Verificar configuración de grupo específico - CORREGIDO
    const groupType = config.groupTypes && config.groupTypes[from] ? config.groupTypes[from] : null;

    let revChat = null;
    let revsActive = false;

    if (groupType && config.revGroups && config.revGroups[groupType]) {
      // Usar configuración de reenvíos para este grupo
      revChat = config.revGroups[groupType];
      revsActive = config.revGroupActive && config.revGroupActive[groupType] === true;
    }

    // Verificar si los reenvíos están activos
    if (!revsActive) {
      await sock.sendMessage(from, { text: "❌ Los reenvíos están desactivados para este grupo." });
      return;
    }

    if (!revChat) {
      await sock.sendMessage(from, {
        text: `❌ No hay chat configurado para reenvíos de ${groupType ? groupType.toUpperCase() : 'este grupo'}. Usa ${config.prefix}setrev ${groupType || 'g1'} on en el chat destino.`
      });
      return;
    }

    const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMessage) {
      await sock.sendMessage(from, { text: "❌ Debes responder a un mensaje para reenviarlo." });
      return;
    }

    // Obtener información del remitente original
    const quotedSender = msg.message.extendedTextMessage.contextInfo.participant;
    const originalSenderNumber = quotedSender.split('@')[0];
    const originalSenderFormatted = formatPhoneNumber(originalSenderNumber);

    // Obtener información del que ejecuta el comando
    const executorNumber = sender.split('@')[0];
    const executorFormatted = formatPhoneNumber(executorNumber);

    // Enviar encabezado del reenvío CON MENCIONES
    await sock.sendMessage(revChat, {
      text: `📤 *CONTENIDO REENVIADO - ${groupType ? groupType.toUpperCase() : 'GRUPO'}*\n\n👤 *De:* @${originalSenderFormatted}\n🔄 *Reenviado por:* @${executorFormatted}\n📅 *Fecha:* ${moment().format("DD/MM/YYYY HH:mm")}`,
      mentions: [quotedSender, sender] // Mencionar al remitente original y al que reenvía
    });

    // Recrear el mensaje original EXACTAMENTE igual que en #kick
    const copy = (obj) => JSON.parse(JSON.stringify(obj));

    let fakeMsg = copy(msg);
    fakeMsg.key.fromMe = false;
    fakeMsg.key.remoteJid = revChat;

    let who = msg.message.extendedTextMessage.contextInfo.participant;

    // Si es un grupo, usar el participante original
    if (from.endsWith("@g.us")) {
      fakeMsg.key.participant = who;
    } else {
      fakeMsg.key.participant = who;
    }

    // Copiar el mensaje original exactamente
    fakeMsg.message = copy(quotedMessage);

    // Enviar el mensaje recreado (igual que Summi Bot)
    await sock.relayMessage(revChat, fakeMsg.message, {
      messageId: fakeMsg.key.id
    });

  } catch (error) {
    console.error("❌ Error en comando rev:", error);
    await sock.sendMessage(from, {
      text: "❌ Error al reenviar el contenido."
    });
  }
}

// Función para calcular el uptime en formato legible
function calculateUptime() {
  const now = Date.now();
  const uptimeMs = now - startTime;

  // Convertir milisegundos a formato legible
  const seconds = Math.floor(uptimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts = [];

  if (days > 0) {
    parts.push(`${days} día${days > 1 ? 's' : ''}`);
  }
  if (hours % 24 > 0) {
    parts.push(`${hours % 24} hora${hours % 24 > 1 ? 's' : ''}`);
  }
  if (minutes % 60 > 0 && days === 0) {
    parts.push(`${minutes % 60} minuto${minutes % 60 > 1 ? 's' : ''}`);
  }
  if (seconds % 60 > 0 && hours === 0 && days === 0) {
    parts.push(`${seconds % 60} segundo${seconds % 60 > 1 ? 's' : ''}`);
  }

  return parts.join(', ') || '0 segundos';
}

// Función auxiliar para formatear números de teléfono
function formatPhoneNumber(number) {
  // Remover cualquier caracter no numérico
  const cleanNumber = number.replace(/\D/g, '');

  // Formatear según la longitud del número
  if (cleanNumber.length === 12) {
    // Formato: 57 318 035 5926
    return cleanNumber.replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '$1 $2 $3 $4');
  } else if (cleanNumber.length === 11) {
    // Formato: 57 318 035 592
    return cleanNumber.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4');
  } else if (cleanNumber.length === 10) {
    // Formato: 318 035 5926
    return cleanNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
  } else if (cleanNumber.length === 9) {
    // Formato: 318 035 592
    return cleanNumber.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  }

  // Si no coincide con ningún formato conocido, devolver el número limpio
  return cleanNumber;
}