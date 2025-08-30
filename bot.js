
import 'dotenv/config'; // esta línea debe ser la primera
import fs from 'fs';
import path from 'path';
import RSSParser from 'rss-parser';
import { Octokit } from '@octokit/rest';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Variables de entorno para GitHub y YouTube (debe ir antes de cualquier uso)
const {
  DISCORD_TOKEN,
  DISCORD_CHANNEL_WELCOME,
  DISCORD_CHANNEL_MEMES,
  DISCORD_CHANNEL_HENTAI,
  DISCORD_CHANNEL_PORNOLAND,
  DISCORD_CHANNEL_FETICHES,
  DISCORD_CHANNEL_PIES,
  DISCORD_CHANNEL_JUEGOS_NOPOR,
  DISCORD_CHANNEL_NEW_VIDEOS,
  YOUTUBE_CHANNEL_ID,
  YOUTUBE_API_KEY,
  GITHUB_TOKEN,
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_BRANCH = "main",
  DISCORD_ROLE_MIEMBRO,
  DISCORD_CHANNEL_ACTIVITY_LOG,
} = process.env;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


// --- Cola de promesas para guardar participantes del sorteo ---
class PromiseQueue {
  constructor() {
    this.queue = Promise.resolve();
  }
  add(fn) {
    this.queue = this.queue.then(() => fn()).catch(() => {});
    return this.queue;
  }
}
const sorteoGitHubQueue = new PromiseQueue();

import {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  InteractionResponseType,
} from 'discord.js';

// IDs configurables (cambia según tu servidor)
const CANAL_AYUDA_ID = process.env.CANAL_AYUDA_ID || "1391222796453019749";
const CATEGORIA_TICKETS_ID = process.env.CATEGORIA_TICKETS_ID || "1391222553799954442";
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "1372066132957331587";
const CANAL_SORTEO_ID = process.env.CANAL_SORTEO_ID || "1396642489464520776";
const CANAL_ANUNCIOS_ID = process.env.CANAL_ANUNCIOS_ID || "1372061643105898527";

// Canales para anuncios de novelas (ambos canales)
const CANALES_ANUNCIOS_NOVELAS = [
  "1372063183446999071", // Canal de anuncios de videos de YouTube
  "1396729794325905479",
  "1409604201704722614",
  "1411195764117344286"
    // Canal adicional
];

// Canal específico para videos de YouTube
const CANAL_VIDEOS_YOUTUBE = process.env.DISCORD_CHANNEL_NEW_VIDEOS || "1400695385919324201";

// Variables para anuncios de novelas y YouTube
const NOVELAS_ANUNCIADAS_PATH = "./data/novelasAnunciadas.json";
// Configuración para guardar las anunciadas en otro repo
const ANUNCIADAS_GITHUB_OWNER = 'MundoEroVisual';
const ANUNCIADAS_GITHUB_REPO = 'Bot-de-Discord';
const ANUNCIADAS_GITHUB_BRANCH = 'main';
const ANUNCIADAS_JSON_GITHUB_PATH = 'data/anunciadas.json';
const VIDEOS_ANUNCIADOS_PATH = "./data/videosAnunciados.json";
let novelasAnunciadas = new Set();
let videosAnunciados = new Set();

// Variable global para el sorteo actual - CORREGIDO
let sorteoActual = null;

// Variable para controlar verificaciones automáticas - NUEVO
let verificacionesAutomaticasActivas = true;

// Carga inicial de novelas anunciadas (si existe)
(async () => {
  try {
  // console.log("📚 Cargando novelas anunciadas...");
    
    // Intentar cargar desde el repo externo siempre
    try {
  // console.log("🔍 Intentando cargar desde repo externo...");
      const octokit = new Octokit({ auth: GITHUB_TOKEN });
      let novelasAnunciadasData = [];
      try {
        const { data } = await octokit.repos.getContent({
          owner: ANUNCIADAS_GITHUB_OWNER,
          repo: ANUNCIADAS_GITHUB_REPO,
          path: ANUNCIADAS_JSON_GITHUB_PATH,
          ref: ANUNCIADAS_GITHUB_BRANCH
        });
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        novelasAnunciadasData = JSON.parse(content);
      } catch (e) {
        // Si no existe el archivo, lo crea vacío
        await octokit.repos.createOrUpdateFileContents({
          owner: ANUNCIADAS_GITHUB_OWNER,
          repo: ANUNCIADAS_GITHUB_REPO,
          path: ANUNCIADAS_JSON_GITHUB_PATH,
          message: 'Crear archivo de novelas anunciadas',
          content: Buffer.from(JSON.stringify([], null, 2)).toString('base64'),
          branch: ANUNCIADAS_GITHUB_BRANCH
        });
        novelasAnunciadasData = [];
      }
      if (Array.isArray(novelasAnunciadasData)) {
        novelasAnunciadas = new Set(novelasAnunciadasData);
  console.log(`✅ Novelas anunciadas cargadas desde repo externo: ${novelasAnunciadas.size} novelas`);
  // console.log(`📋 Primeras 5 novelas anunciadas:`, Array.from(novelasAnunciadas).slice(0, 5));
      } else {
  console.log("⚠️ Datos del repo externo no son un array válido");
  // console.log("📄 Tipo de datos recibidos:", typeof novelasAnunciadasData);
  // console.log("📄 Contenido:", novelasAnunciadasData);
      }
    } catch (githubError) {
  console.log("⚠️ No se pudo cargar novelas desde el repo externo:", githubError.message);
  // console.log("🔍 Stack trace completo:", githubError.stack);
    }
    
    // Solo usar fallback local si no se pudo cargar desde GitHub o si novelasAnunciadas está vacío
    if (novelasAnunciadas.size === 0 && fs.existsSync(NOVELAS_ANUNCIADAS_PATH)) {
      try {
        const data = JSON.parse(fs.readFileSync(NOVELAS_ANUNCIADAS_PATH, "utf-8"));
        if (Array.isArray(data)) {
          novelasAnunciadas = new Set(data);
          console.log(`✅ Novelas anunciadas cargadas desde archivo local: ${novelasAnunciadas.size} novelas`);
          console.log(`📋 Primeras 5 novelas anunciadas:`, Array.from(novelasAnunciadas).slice(0, 5));
        } else {
          console.log("⚠️ Archivo local de novelas no contiene un array válido");
        }
      } catch (localError) {
        console.log("⚠️ Error leyendo archivo local de novelas:", localError.message);
      }
    }
    
    if (novelasAnunciadas.size === 0) {
      console.log("ℹ️ No se pudieron cargar novelas anunciadas, empezando con lista vacía");
    }
    
    // Cargar videos anunciados
    console.log("🎥 Cargando videos anunciados...");
    
    // Intentar cargar videos desde GitHub primero
    if (isGitHubConfigured()) {
      try {
        const videosAnunciadosData = await getJsonFromGitHub('data/videosAnunciados.json');
        if (Array.isArray(videosAnunciadosData)) {
          videosAnunciados = new Set(videosAnunciadosData);
          console.log(`✅ Videos anunciados cargados desde GitHub: ${videosAnunciados.size} videos`);
        }
      } catch (githubError) {
        console.log("⚠️ No se pudo cargar videos desde GitHub, intentando archivo local...");
      }
    }
    
    // Fallback a archivo local para videos
    if (fs.existsSync(VIDEOS_ANUNCIADOS_PATH)) {
      const data = JSON.parse(fs.readFileSync(VIDEOS_ANUNCIADOS_PATH, "utf-8"));
      if (Array.isArray(data)) {
        videosAnunciados = new Set(data);
        console.log(`✅ Videos anunciados cargados desde archivo local: ${videosAnunciados.size} videos`);
      } else {
        console.log("⚠️ Archivo local de videos no contiene un array válido");
      }
    } else {
      console.log("ℹ️ No existe archivo local de videos anunciados, empezando con lista vacía");
    }
    
    // REVISAR NOVELAS NUEVAS AL ARRANCAR
    console.log("🚀 Revisando novelas nuevas al arrancar...");
    await checkNovelas();
    
  } catch (e) {
    console.error("❌ Error cargando datos anunciados:", e);
    console.log("ℹ️ Empezando con listas vacías");
  }
})();

// Validación completa de variables críticas - CORREGIDO
function validateEnvironmentVariables() {
  const requiredVars = {
    'DISCORD_TOKEN': DISCORD_TOKEN,
    'YOUTUBE_API_KEY': YOUTUBE_API_KEY,
    'YOUTUBE_CHANNEL_ID': YOUTUBE_CHANNEL_ID,
    'GITHUB_TOKEN': GITHUB_TOKEN,
    'GITHUB_OWNER': GITHUB_OWNER,
    'GITHUB_REPO': GITHUB_REPO
  };

  const missingVars = Object.entries(requiredVars)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    throw new Error(`Faltan variables de entorno requeridas: ${missingVars.join(', ')}`);
  }

  console.log('✅ Todas las variables de entorno requeridas están configuradas');
}

// Validar variables de entorno al inicio
validateEnvironmentVariables();

// Función para debuggear canales disponibles
function debugCanales() {
  console.log("🔍 === DEBUGGING CANALES ===");
  console.log("📋 Canales configurados:");
  console.log(`   - Novelas: ${CANALES_ANUNCIOS_NOVELAS.join(', ')}`);
  console.log(`   - Videos YouTube: ${CANAL_VIDEOS_YOUTUBE}`);
  
  if (client.isReady()) {
    console.log("📊 Canales disponibles en el servidor:");
    client.guilds.cache.forEach(guild => {
      console.log(`   Servidor: ${guild.name} (${guild.id})`);
      guild.channels.cache.forEach(channel => {
        if (channel.type === ChannelType.GuildText) {
          console.log(`     - #${channel.name} (${channel.id})`);
        }
      });
    });
  } else {
    console.log("⚠️ Cliente Discord no está listo aún");
  }
  console.log("🔍 === FIN DEBUGGING ===");
}

// --- Cliente Discord ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

// Manejador global de errores para interacciones - MEJORADO
process.on('unhandledRejection', (error) => {
  console.error('❌ Error no manejado:', error);
});

client.on('error', (error) => {
  console.error('❌ Error del cliente Discord:', error);
});

// Función helper para responder a interacciones de manera segura
async function safeReply(interaction, content, options = {}) {
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(content);
    } else if (interaction.replied) {
      await interaction.followUp(content);
    } else if (interaction.deferred) {
      await interaction.editReply(content);
    }
  } catch (error) {
    console.error('Error en safeReply:', error);
  }
}

// Rate limiting para APIs externas - NUEVO
class RateLimiter {
  constructor() {
    this.requests = new Map();
  }

  canMakeRequest(key, maxRequests = 10, windowMs = 60000) {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Limpiar requests antiguos
    const validRequests = requests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(key, validRequests);
    return true;
  }
}

const rateLimiter = new RateLimiter();

// ---------------------
// 1. SISTEMA DE TICKETS
// ---------------------
client.once("ready", async () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  await cargarSorteoActivo();

  // Verificar configuración del sistema de tickets
  console.log("🔧 Verificando configuración del sistema de tickets...");
  console.log(`📁 Categoría de tickets: ${CATEGORIA_TICKETS_ID}`);
  console.log(`👥 Rol de staff: ${STAFF_ROLE_ID}`);
  console.log(`📞 Canal de ayuda: ${CANAL_AYUDA_ID}`);

  const guild = client.guilds.cache.first();
  if (guild) {
    const botMember = guild.members.cache.get(client.user.id);
    if (botMember) {
      const hasManageChannels = botMember.permissions.has(PermissionFlagsBits.ManageChannels);
      const hasManageRoles = botMember.permissions.has(PermissionFlagsBits.ManageRoles);
      console.log(`🔐 Bot tiene permisos de canales: ${hasManageChannels}`);
      console.log(`🔐 Bot tiene permisos de roles: ${hasManageRoles}`);
      if (!hasManageChannels) {
        console.log("❌ ADVERTENCIA: El bot no tiene permisos para gestionar canales");
      }
    }
    console.log("🔍 Verificando elementos del sistema de tickets...");
    const categoria = guild.channels.cache.get(CATEGORIA_TICKETS_ID);
    if (categoria) {
      console.log(`✅ Categoría de tickets encontrada: ${categoria.name}`);
    } else {
      console.log(`❌ Categoría de tickets NO encontrada: ${CATEGORIA_TICKETS_ID}`);
    }
    const staffRole = guild.roles.cache.get(STAFF_ROLE_ID);
    if (staffRole) {
      console.log(`✅ Rol de staff encontrado: ${staffRole.name}`);
    } else {
      console.log(`❌ Rol de staff NO encontrado: ${STAFF_ROLE_ID}`);
    }
    const canalAyuda = guild.channels.cache.get(CANAL_AYUDA_ID);
    if (canalAyuda) {
      console.log(`✅ Canal de ayuda encontrado: ${canalAyuda.name}`);
    } else {
      console.log(`❌ Canal de ayuda NO encontrado: ${CANAL_AYUDA_ID}`);
    }
    
    // Debugging de canales de anuncios
    console.log("🔍 === VERIFICACIÓN DE CANALES DE ANUNCIOS ===");
    console.log(`📋 Canales configurados para novelas: ${CANALES_ANUNCIOS_NOVELAS.join(', ')}`);
    console.log(`📋 Canal configurado para videos: ${CANAL_VIDEOS_YOUTUBE}`);
    
    // Verificar canales de novelas
    CANALES_ANUNCIOS_NOVELAS.forEach(canalId => {
      const canal = guild.channels.cache.get(canalId);
      if (canal) {
        console.log(`✅ Canal de novelas encontrado: #${canal.name} (${canalId})`);
      } else {
        console.log(`❌ Canal de novelas NO encontrado: ${canalId}`);
      }
    });
    
    // Verificar canal de videos
    const canalVideos = guild.channels.cache.get(CANAL_VIDEOS_YOUTUBE);
    if (canalVideos) {
      console.log(`✅ Canal de videos encontrado: #${canalVideos.name} (${CANAL_VIDEOS_YOUTUBE})`);
    } else {
      console.log(`❌ Canal de videos NO encontrado: ${CANAL_VIDEOS_YOUTUBE}`);
    }
    
    console.log("🔍 === FIN VERIFICACIÓN ===");
    
    // Verificar permisos del bot en los canales
    console.log("🔐 === VERIFICACIÓN DE PERMISOS ===");
    if (botMember) {
      // Verificar permisos en canales de novelas
      CANALES_ANUNCIOS_NOVELAS.forEach(canalId => {
        const canal = guild.channels.cache.get(canalId);
        if (canal) {
          const permissions = botMember.permissionsIn(canal);
          const canSend = permissions.has(PermissionFlagsBits.SendMessages);
          const canEmbed = permissions.has(PermissionFlagsBits.EmbedLinks);
          console.log(`🔐 Permisos en #${canal.name}: Enviar=${canSend}, Embeds=${canEmbed}`);
        }
      });
      
      // Verificar permisos en canal de videos
      const canalVideos = guild.channels.cache.get(CANAL_VIDEOS_YOUTUBE);
      if (canalVideos) {
        const permissions = botMember.permissionsIn(canalVideos);
        const canSend = permissions.has(PermissionFlagsBits.SendMessages);
        const canEmbed = permissions.has(PermissionFlagsBits.EmbedLinks);
        console.log(`🔐 Permisos en #${canalVideos.name}: Enviar=${canSend}, Embeds=${canEmbed}`);
      }
    }
    console.log("🔐 === FIN VERIFICACIÓN DE PERMISOS ===");
  }

  // Registrar comandos slash
  try {
    console.log("🔄 Registrando comandos...");
    
    const commands = [
      // Comandos básicos
      new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Ver latencia del bot"),
      
      new SlashCommandBuilder()
        .setName("ticket")
        .setDescription("Abrir un ticket de soporte"),
      
      // Comandos de sorteos
      new SlashCommandBuilder()
        .setName("crearsorteo")
        .setDescription("Crear un sorteo VIP")
        .addStringOption((option) =>
          option
            .setName("tipo")
            .setDescription("Tipo de sorteo")
            .setRequired(false)
            .addChoices(
              { name: "VIP", value: "VIP" },
              { name: "Premium", value: "Premium" }
            )
        )
        .addStringOption((option) =>
          option
            .setName("duracion")
            .setDescription("Duración del sorteo (ej: 45m, 2h, 1d)")
            .setRequired(false)
        ),
      
      new SlashCommandBuilder()
        .setName("sorteo")
        .setDescription("Ver información del sorteo activo"),
      
      new SlashCommandBuilder()
        .setName("agregarparticipante")
        .setDescription("Añadir manualmente a un usuario al sorteo (solo admins)")
        .addUserOption((option) =>
          option
            .setName("usuario")
            .setDescription("Usuario a añadir al sorteo")
            .setRequired(true)
        ),
      
      new SlashCommandBuilder()
        .setName("sorteocantidad")
        .setDescription("Muestra la cantidad y lista de usuarios participando en el sorteo VIP"),
      
      new SlashCommandBuilder()
        .setName("terminarsorteo")
        .setDescription("Terminar el sorteo actual inmediatamente"),
      
      new SlashCommandBuilder()
        .setName("actualizarsorteo")
        .setDescription("Actualiza el sorteo actual para funcionar en ambos canales"),
      
      new SlashCommandBuilder()
        .setName("ultimanovela")
        .setDescription("Vuelve a anunciar la última novela subida"),
      
      new SlashCommandBuilder()
        .setName("vipnovelas")
        .setDescription("Anuncia todas las novelas en el canal VIP de descargas"),
      
      new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Borrar mensajes del canal")
        .addIntegerOption((option) =>
          option
            .setName("cantidad")
            .setDescription("Cantidad de mensajes a borrar")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
        ),
      
      new SlashCommandBuilder()
        .setName("clearall")
        .setDescription("Borrar todos los mensajes del canal actual"),
      
      // Comandos de VIP
      new SlashCommandBuilder()
        .setName("vip")
        .setDescription("Gestionar usuarios VIP")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("agregar")
            .setDescription("Agregar usuario VIP")
            .addUserOption((option) =>
              option
                .setName("usuario")
                .setDescription("Usuario a hacer VIP")
                .setRequired(true)
            )
            .addStringOption((option) =>
              option
                .setName("duracion")
                .setDescription("Duración del VIP (ej: 30d, 90d)")
                .setRequired(true)
            )
            .addStringOption((option) =>
              option
                .setName("nombreweb")
                .setDescription("Nombre del usuario en la web")
                .setRequired(false)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("remover")
            .setDescription("Remover usuario VIP")
            .addUserOption((option) =>
              option
                .setName("usuario")
                .setDescription("Usuario a remover VIP")
                .setRequired(true)
            )
            .addStringOption((option) =>
              option
                .setName("nombreweb")
                .setDescription("Nombre del usuario en la web")
                .setRequired(false)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("listar")
            .setDescription("Listar usuarios VIP")
        ),
      
      new SlashCommandBuilder()
        .setName("reanunciar-novelas")
        .setDescription("Vuelve a anunciar todas las novelas (resetea la lista)"),
      
      new SlashCommandBuilder()
        .setName("refrescar-novelas")
        .setDescription("Fuerza la relectura del JSON y reanuncia novelas nuevas"),
      
      new SlashCommandBuilder()
        .setName("anuncio")
        .setDescription("Envía un anuncio a todos los canales configurados")
        .addStringOption((option) =>
          option
            .setName("mensaje")
            .setDescription("Mensaje del anuncio")
            .setRequired(true)
        ),
      
      // Comandos de moderación básicos
      new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Expulsar usuario del servidor")
        .addUserOption((option) =>
          option
            .setName("usuario")
            .setDescription("Usuario a expulsar")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("razon")
            .setDescription("Razón de la expulsión")
            .setRequired(false)
        ),
      
      new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Banear usuario del servidor")
        .addUserOption((option) =>
          option
            .setName("usuario")
            .setDescription("Usuario a banear")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("razon")
            .setDescription("Razón del baneo")
            .setRequired(false)
        ),
      
      // Comando unban - IMPLEMENTADO
      new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Desbanear usuario del servidor")
        .addStringOption((option) =>
          option
            .setName("usuario_id")
            .setDescription("ID del usuario a desbanear")
            .setRequired(true)
        ),
      
      // Comando timeout - IMPLEMENTADO
      new SlashCommandBuilder()
        .setName("timeout")
        .setDescription("Silenciar usuario temporalmente")
        .addUserOption((option) =>
          option
            .setName("usuario")
            .setDescription("Usuario a silenciar")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("duracion")
            .setDescription("Duración del silencio (ej: 5m, 1h, 1d)")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("razon")
            .setDescription("Razón del silencio")
            .setRequired(false)
        ),
      
      // Comando say - IMPLEMENTADO
      new SlashCommandBuilder()
        .setName("say")
        .setDescription("Hacer que el bot diga algo")
        .addStringOption((option) =>
          option
            .setName("mensaje")
            .setDescription("Mensaje a decir")
            .setRequired(true)
        ),
      
      // Comando role - IMPLEMENTADO
      new SlashCommandBuilder()
        .setName("role")
        .setDescription("Gestionar roles de usuario")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("agregar")
            .setDescription("Agregar rol a usuario")
            .addUserOption((option) =>
              option
                .setName("usuario")
                .setDescription("Usuario")
                .setRequired(true)
            )
            .addRoleOption((option) =>
              option
                .setName("rol")
                .setDescription("Rol a agregar")
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("remover")
            .setDescription("Remover rol de usuario")
            .addUserOption((option) =>
              option
                .setName("usuario")
                .setDescription("Usuario")
                .setRequired(true)
            )
            .addRoleOption((option) =>
              option
                .setName("rol")
                .setDescription("Rol a remover")
                .setRequired(true)
            )
        ),
      
      // Comandos de información
      new SlashCommandBuilder()
        .setName("userinfo")
        .setDescription("Ver información de un usuario")
        .addUserOption((option) =>
          option
            .setName("usuario")
            .setDescription("Usuario a consultar")
            .setRequired(false)
        ),
      
      new SlashCommandBuilder()
        .setName("serverinfo")
        .setDescription("Ver información del servidor"),
      
      new SlashCommandBuilder()
        .setName("botinfo")
        .setDescription("Ver información del bot"),
      
      // Comandos de utilidad
      new SlashCommandBuilder()
        .setName("avatar")
        .setDescription("Ver avatar de un usuario")
        .addUserOption((option) =>
          option
            .setName("usuario")
            .setDescription("Usuario a consultar")
            .setRequired(false)
        ),
      
      // Comandos de entretenimiento
      new SlashCommandBuilder()
        .setName("8ball")
        .setDescription("Pregunta a la bola mágica")
        .addStringOption((option) =>
          option
            .setName("pregunta")
            .setDescription("Tu pregunta")
            .setRequired(true)
        ),
      
      new SlashCommandBuilder()
        .setName("coinflip")
        .setDescription("Lanzar una moneda"),
      
      // Comando dice - IMPLEMENTADO
      new SlashCommandBuilder()
        .setName("dice")
        .setDescription("Lanzar dados")
        .addIntegerOption((option) =>
          option
            .setName("cantidad")
            .setDescription("Cantidad de dados")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        )
        .addIntegerOption((option) =>
          option
            .setName("caras")
            .setDescription("Número de caras")
            .setRequired(false)
            .setMinValue(2)
            .setMaxValue(100)
        ),
      
      new SlashCommandBuilder()
        .setName("novelasestado")
        .setDescription("Ver estado de novelas anunciadas (solo admins)"),
      
      new SlashCommandBuilder()
        .setName("resetearnovelas")
        .setDescription("Resetear lista de novelas anunciadas (solo admins)"),
      
      new SlashCommandBuilder()
        .setName("videosestado")
        .setDescription("Ver estado de videos anunciados (solo admins)"),
      
      new SlashCommandBuilder()
        .setName("resetearvideos")
        .setDescription("Resetear lista de videos anunciados (solo admins)"),
      
      new SlashCommandBuilder()
        .setName("reanunciarnovela")
        .setDescription("Re-anunciar una novela específica")
        .addStringOption(option =>
          option
            .setName("id")
            .setDescription("ID de la novela a re-anunciar")
            .setRequired(true)
        ),
      new SlashCommandBuilder()
        .setName("debugnovelas")
        .setDescription("Mostrar información de debug sobre novelas anunciadas"),
      new SlashCommandBuilder()
        .setName("recargarnovelas")
        .setDescription("Recargar novelas anunciadas desde GitHub"),
      new SlashCommandBuilder()
        .setName("verificarjson")
        .setDescription("Verificar contenido del archivo JSON en GitHub"),
      new SlashCommandBuilder()
        .setName("controlnovelas")
        .setDescription("Activar/desactivar verificaciones automáticas de novelas")
        .addStringOption(option =>
          option
            .setName("accion")
            .setDescription("Acción a realizar")
            .setRequired(true)
            .addChoices(
              { name: "Activar verificaciones", value: "activar" },
              { name: "Desactivar verificaciones", value: "desactivar" },
              { name: "Ver estado", value: "estado" }
            )
        ),
      new SlashCommandBuilder()
        .setName("revisarnovelas")
        .setDescription("Forzar revisión manual de novelas nuevas"),
              new SlashCommandBuilder()
          .setName("verificarformato")
          .setDescription("Verificar formato del archivo JSON de novelas anunciadas"),
                new SlashCommandBuilder()
          .setName("corregirformato")
          .setDescription("Forzar corrección del formato JSON de novelas anunciadas"),
        new SlashCommandBuilder()
          .setName("debugvideos")
          .setDescription("Mostrar información de debug sobre videos anunciados"),
        new SlashCommandBuilder()
          .setName("recargarvideos")
          .setDescription("Recargar videos anunciados desde GitHub"),
    ];

    console.log(`📝 Registrando ${commands.length} comandos...`);
    await client.application.commands.set(commands);
    console.log("✅ Comandos registrados exitosamente");
    
    // Verificar comandos registrados
    const registeredCommands = await client.application.commands.fetch();
    console.log(`📋 Comandos registrados: ${registeredCommands.size}`);
    registeredCommands.forEach(cmd => {
      console.log(`  - /${cmd.name}: ${cmd.description}`);
    });
    
  } catch (error) {
    console.error("❌ Error registrando comandos:", error);
    console.error("Detalles del error:", error.message);
  }

  // Iniciar tareas automáticas - REACTIVADO checkNovelas
  setInterval(checkNovelas, 5 * 60 * 1000); // Cada 5 minutos - REACTIVADO
  setInterval(checkYouTube, 10 * 60 * 1000); // Cada 10 minutos
  setInterval(revisarYCancelarVipExpirado, 60 * 60 * 1000); // Cada hora
  setInterval(limpiarTicketsHuerfanos, 6 * 60 * 60 * 1000); // Cada 6 horas
  setInterval(revisarRolesMiembroFaltantes, 5 * 60 * 1000); // Cada 5 minutos - Revisar roles de miembro
});

// ---------------------
// 2. MANEJADOR DE INTERACCIONES
// ---------------------
client.on("interactionCreate", async (interaction) => {

  if (interaction.isButton()) {
    if (interaction.customId === "abrir_ticket") {
      // Responder inmediatamente para evitar timeout
      await interaction.deferReply({ flags: [1] });
      
      try {
        const { guild, user } = interaction;
        
        if (!guild) {
          await interaction.editReply({ content: "Este comando solo puede usarse en un servidor." });
          return;
        }
        
        // Verificar canal existente
        const nombreCanal = `ticket-${user.username.toLowerCase()}`;
        const canalExistente = guild.channels.cache.find((c) => c.name === nombreCanal);
        
        if (canalExistente) {
          await interaction.editReply({ 
            content: `Ya tienes un ticket abierto: <#${canalExistente.id}>`
          });
          return;
        }
        
        // Verificar configuración
        const categoria = guild.channels.cache.get(CATEGORIA_TICKETS_ID);
        const staffRole = guild.roles.cache.get(STAFF_ROLE_ID);
        
        if (!categoria || !staffRole) {
          await interaction.editReply({ 
            content: "Error: Configuración de tickets incompleta. Contacta al administrador."
          });
          return;
        }
        
        // Crear canal
        const canal = await guild.channels.create({
          name: nombreCanal,
          type: ChannelType.GuildText,
          parent: CATEGORIA_TICKETS_ID,
          permissionOverwrites: [
            { 
              id: guild.id, 
              deny: [PermissionFlagsBits.ViewChannel] 
            },
            { 
              id: user.id, 
              allow: [
                PermissionFlagsBits.ViewChannel, 
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ] 
            },
            { 
              id: STAFF_ROLE_ID, 
              allow: [
                PermissionFlagsBits.ViewChannel, 
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels
              ] 
            },
          ],
        });
        
        // Responder al usuario
        await interaction.editReply({ 
          content: `🎫 Ticket creado exitosamente: <#${canal.id}>`
        });
        
        // Enviar mensaje de bienvenida de forma asíncrona
        setTimeout(async () => {
          try {
            const embed = new EmbedBuilder()
              .setTitle("🎫 Ticket Creado")
              .setDescription(`¡Bienvenido <@${user.id}>!\n\n**Por favor describe tu problema y el staff te atenderá lo antes posible.**\n\n• Sé específico con tu consulta\n• Proporciona detalles relevantes\n• Ten paciencia mientras el staff te responde`)
              .setColor("#00ff00")
              .setTimestamp();
            
            const rowClose = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("cerrar_ticket")
                .setLabel("🔒 Cerrar Ticket")
                .setStyle(4)
            );
            
            await canal.send({ embeds: [embed], components: [rowClose] });
          } catch (sendError) {
            console.error("Error enviando mensaje de bienvenida:", sendError);
          }
        }, 1000);
        
      } catch (e) {
        console.error("Error creando ticket:", e);
        
        // Manejar error de forma segura
        try {
          await interaction.editReply({ 
            content: "Error al crear el ticket. Contacta al staff."
          });
        } catch (replyError) {
          console.error("Error enviando respuesta de error:", replyError);
        }
      }
    } else if (interaction.customId === "cerrar_ticket") {
      // Responder inmediatamente
      await interaction.deferReply({ flags: [1] });
      
      try {
        await interaction.editReply({ 
          content: "🔒 Cerrando el ticket en 2 segundos..."
        });
        
        // Cerrar después de 2 segundos
        setTimeout(async () => {
          try {
            await interaction.channel.delete();
          } catch (e) {
            console.error("Error eliminando canal:", e);
          }
        }, 2000);
        
      } catch (e) {
        console.error("Error cerrando ticket:", e);
        try {
          await interaction.editReply({ 
            content: "Error al cerrar el ticket. Contacta al staff."
          });
        } catch (replyError) {
          console.error("Error enviando respuesta de error:", replyError);
        }
      }
    }
  }

  // --- SORTEO VIP ---
  if (interaction.isChatInputCommand() && interaction.commandName === "crearsorteo") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "Solo administradores pueden crear sorteos.", flags: [1] });
      return;
    }
    // Recoge los parámetros
    const tipo = interaction.options.getString("tipo") || "VIP";
    const duracion = interaction.options.getString("duracion") || "45m";
    const canal = interaction.options.getChannel("canal") || await client.channels.fetch(CANAL_SORTEO_ID);
    let msDuracion = 45 * 60 * 1000;
    let duracionTexto = "45 minutos";
    const duracionMatch = duracion.match(/^(\d+)([mhd])$/i);
    if (duracionMatch) {
      const valor = parseInt(duracionMatch[1]);
      const unidad = duracionMatch[2].toLowerCase();
      if (unidad === "m") {
        msDuracion = valor * 60 * 1000;
        duracionTexto = `${valor} minuto${valor === 1 ? '' : 's'}`;
      } else if (unidad === "h") {
        msDuracion = valor * 60 * 60 * 1000;
        duracionTexto = `${valor} hora${valor === 1 ? '' : 's'}`;
      } else if (unidad === "d") {
        msDuracion = valor * 24 * 60 * 60 * 1000;
        duracionTexto = `${valor} día${valor === 1 ? '' : 's'}`;
      }
    }
    const termina = Date.now() + msDuracion;
    sorteoActual = {
      tipo,
      premio: "VIP Gratis",
      ganadores: 1,
      termina,
      canalParticipacion: canal.id,
      participantes: new Set()
    };
    // Guardar sorteo en GitHub
    await guardarSorteoEnGitHub({
      tipo,
      premio: "VIP Gratis",
      ganadores: 1,
      termina,
      canalParticipacion: canal.id,
      participantes: []
    });
    
    const embed = new EmbedBuilder()
      .setTitle(`🎉 SORTEO ${tipo} CREADO`)
      .setDescription(`**¡Participa y gana ${sorteoActual.premio}!**\n\n⏰ **Duración:** ${duracionTexto}\n🎁 **Premio:** ${sorteoActual.premio}\n👥 **Ganadores:** ${sorteoActual.ganadores}\n\n**Para participar, reacciona con 🎉 en este mensaje!**`)
      .setColor("#ff6b6b")
      .setTimestamp();
    
    const message = await canal.send({ embeds: [embed] });
    await message.react("🎉");
    
    await interaction.reply({ 
      content: `✅ Sorteo ${tipo} creado exitosamente en <#${canal.id}>`, 
      flags: [1] 
    });
    
    // Programar finalización del sorteo
    setTimeout(() => finalizarSorteo(), msDuracion);
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "sorteo") {
    if (!sorteoActual) {
      await interaction.reply({ 
        content: "No hay ningún sorteo activo en este momento.", 
        flags: [1] 
      });
      return;
    }
    
    const tiempoRestante = sorteoActual.termina - Date.now();
    const minutosRestantes = Math.ceil(tiempoRestante / (1000 * 60));
    
    const embed = new EmbedBuilder()
      .setTitle(`🎉 SORTEO ${sorteoActual.tipo} ACTIVO`)
      .setDescription(`**¡Participa y gana ${sorteoActual.premio}!**\n\n⏰ **Tiempo restante:** ${minutosRestantes} minutos\n🎁 **Premio:** ${sorteoActual.premio}\n👥 **Participantes:** ${sorteoActual.participantes.size}\n👑 **Ganadores:** ${sorteoActual.ganadores}\n\n**Para participar, reacciona con 🎉 en el canal de sorteos!**`)
      .setColor("#ff6b6b")
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], flags: [1] });
  }

  // --- NUEVOS COMANDOS ADMINISTRATIVOS ---
  
  if (interaction.isChatInputCommand() && interaction.commandName === "agregarparticipante") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "Solo administradores pueden agregar participantes.", flags: [1] });
      return;
    }
    
    if (!sorteoActual) {
      await interaction.reply({ content: "No hay ningún sorteo activo.", flags: [1] });
      return;
    }
    
    const user = interaction.options.getUser("usuario");
    sorteoActual.participantes.add(user.id);
    
    await interaction.reply({ 
      content: `✅ **${user.tag}** agregado al sorteo ${sorteoActual.tipo}`, 
      flags: [1] 
    });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "sorteocantidad") {
    if (!sorteoActual) {
      await interaction.reply({ content: "No hay ningún sorteo activo.", flags: [1] });
      return;
    }
    
    const participantes = Array.from(sorteoActual.participantes);
    const embed = new EmbedBuilder()
      .setTitle(`📊 PARTICIPANTES DEL SORTEO ${sorteoActual.tipo}`)
      .setDescription(`**Total de participantes:** ${participantes.length}\n\n**Lista de participantes:**\n${participantes.map(id => `<@${id}>`).join('\n') || 'Ninguno'}`)
      .setColor("#00ff00")
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], flags: [1] });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "terminarsorteo") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "Solo administradores pueden terminar sorteos.", flags: [1] });
      return;
    }
    
    if (!sorteoActual) {
      await interaction.reply({ content: "No hay ningún sorteo activo.", flags: [1] });
      return;
    }
    
    await finalizarSorteo();
    await interaction.reply({ content: "✅ Sorteo terminado inmediatamente.", flags: [1] });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "actualizarsorteo") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "Solo administradores pueden actualizar sorteos.", flags: [1] });
      return;
    }
    
    if (!sorteoActual) {
      await interaction.reply({ content: "No hay ningún sorteo activo.", flags: [1] });
      return;
    }
    
    // Actualizar el sorteo para funcionar en ambos canales
    sorteoActual.canalParticipacion = CANAL_SORTEO_ID;
    await guardarSorteoEnGitHub(sorteoActual);
    
    await interaction.reply({ content: "✅ Sorteo actualizado para funcionar en ambos canales.", flags: [1] });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "ultimanovela") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "Solo administradores pueden reanunciar novelas.", flags: [1] });
      return;
    }
    
    try {
      const novelas = await getJsonFromGitHub('data/novelas-1.json');
      if (!Array.isArray(novelas) || novelas.length === 0) {
        await interaction.reply({ content: "No se encontraron novelas.", flags: [1] });
        return;
      }
      
      const ultimaNovela = novelas[novelas.length - 1];
      
      // Verificar si la novela ya fue anunciada
      if (novelasAnunciadas.has(ultimaNovela.id)) {
        await interaction.reply({ content: "La última novela ya fue anunciada anteriormente.", flags: [1] });
        return;
      }
      
      const canal = client.channels.cache.get(CANAL_ANUNCIOS_ID);
      
      if (canal) {
        const embed = new EmbedBuilder()
          .setTitle(`📖 ${ultimaNovela.titulo}`)
          .setDescription(ultimaNovela.descripcion || "Sin descripción disponible")
          .addFields(
            { name: "📱 Plataforma", value: ultimaNovela.plataforma || "No especificada", inline: true },
            { name: "📊 Estado", value: ultimaNovela.estado || "No especificado", inline: true },
            { name: "💾 Peso", value: ultimaNovela.peso || "No especificado", inline: true }
          )
          .setColor("#ff6b6b")
          .setTimestamp();
        
        if (ultimaNovela.imagen) {
          embed.setThumbnail(ultimaNovela.imagen);
        }
        
        // Anunciar en todos los canales configurados
        for (const canal of CANALES_ANUNCIOS_NOVELAS) {
          try {
            await client.channels.cache.get(canal).send({ embeds: [embed] });
            console.log(`✅ Novela "${ultimaNovela.titulo}" anunciada en ${canal}`);
          } catch (canalError) {
            console.error(`❌ Error anunciando en canal ${canal}:`, canalError);
          }
        }
        
        novelasAnunciadas.add(ultimaNovela.id);
        await guardarNovelasEnGitHub(novelasAnunciadas);
        await interaction.reply({ content: "✅ Última novela anunciada.", flags: [1] });
      } else {
        await interaction.reply({ content: "Canal de anuncios no encontrado.", flags: [1] });
      }
    } catch (error) {
      console.error("Error reanunciando última novela:", error);
      await interaction.reply({ content: "Error al reanunciar la última novela.", flags: [1] });
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "vipnovelas") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "Solo administradores pueden anunciar novelas VIP.", flags: [1] });
      return;
    }
    
    try {
      const novelas = await getJsonFromGitHub('data/novelas-1.json');
      if (!Array.isArray(novelas)) {
        await interaction.reply({ content: "No se pudieron cargar las novelas.", flags: [1] });
        return;
      }
      
      const canal = client.channels.cache.get(CANAL_ANUNCIOS_ID);
      if (!canal) {
        await interaction.reply({ content: "Canal de anuncios no encontrado.", flags: [1] });
        return;
      }
      
      let anunciadas = 0;
      let nuevasAnunciadas = 0;
      
      for (const novela of novelas) {
        // Solo anunciar si no ha sido anunciada anteriormente
        if (!novelasAnunciadas.has(novela.id)) {
          console.log(`✅ Anunciando novela nueva: ${novela.titulo}`);
          
          // Crear un embed más atractivo y completo
          const embed = new EmbedBuilder()
            .setTitle(`📖 ${novela.titulo}`)
            .setDescription(novela.desc || "Sin descripción disponible")
            .setColor("#ff6b6b")
            .setTimestamp();
          
          
          // Anunciar en todos los canales configurados
          for (const canal of CANALES_ANUNCIOS_NOVELAS) {
            try {
              await client.channels.cache.get(canal).send({ embeds: [embed] });
              console.log(`✅ Novela "${novela.titulo}" anunciada en ${canal}`);
            } catch (canalError) {
              console.error(`❌ Error anunciando en canal ${canal}:`, canalError);
            }
          }
          
          // AGREGAR INMEDIATAMENTE AL SET Y GUARDAR EN GITHUB
          novelasAnunciadas.add(novela.id);
          nuevasAnunciadas++;
          
          // GUARDAR INMEDIATAMENTE EN GITHUB PARA EVITAR PÉRDIDA DE DATOS
          console.log(`💾 Guardando novela "${novela.id}" en GitHub inmediatamente...`);
          await guardarNovelasEnGitHub(novelasAnunciadas);
          console.log(`✅ Novela "${novela.id}" guardada exitosamente`);
          
          // Esperar un poco entre anuncios para evitar rate limits
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.log(`⏭️ Novela ya anunciada, saltando: ${novela.titulo}`);
        }
      }
      
      // Las novelas ya se guardaron individualmente, no necesitamos guardar de nuevo
      
      await interaction.reply({ 
        content: `✅ ${nuevasAnunciadas} nuevas novelas anunciadas de ${anunciadas} totales.`, 
        flags: [1] 
      });
    } catch (error) {
      console.error("Error anunciando novelas VIP:", error);
      await interaction.reply({ content: "Error al anunciar novelas VIP.", flags: [1] });
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "clearall") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({ content: "No tienes permisos para limpiar mensajes.", flags: [1] });
      return;
    }
    
    try {
      const canal = interaction.channel;
      const mensajes = await canal.messages.fetch();
      await canal.bulkDelete(mensajes);
      await interaction.reply({ content: "✅ Todos los mensajes eliminados.", flags: [1] });
    } catch (error) {
      console.error("Error limpiando todos los mensajes:", error);
      await interaction.reply({ content: "Error al limpiar todos los mensajes.", flags: [1] });
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "reanunciar-novelas") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "Solo administradores pueden reanunciar novelas.", flags: [1] });
      return;
    }
    
    try {
      // Resetear la lista de novelas anunciadas
      novelasAnunciadas.clear();
      await guardarNovelasEnGitHub(novelasAnunciadas);
      
      await interaction.reply({ content: "✅ Lista de novelas anunciadas reseteada.", flags: [1] });
    } catch (error) {
      console.error("Error reseteando novelas:", error);
      await interaction.reply({ content: "Error al resetear novelas.", flags: [1] });
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "refrescar-novelas") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "Solo administradores pueden refrescar novelas.", flags: [1] });
      return;
    }
    
    try {
      await checkNovelas();
      await interaction.reply({ content: "✅ Novelas refrescadas y reanunciadas.", flags: [1] });
    } catch (error) {
      console.error("Error refrescando novelas:", error);
      await interaction.reply({ content: "Error al refrescar novelas.", flags: [1] });
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "anuncio") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "Solo administradores pueden enviar anuncios.", flags: [1] });
      return;
    }
    
    const mensaje = interaction.options.getString("mensaje");
    const canalesAnuncios = [
      CANAL_ANUNCIOS_ID,
      CANAL_SORTEO_ID,
      DISCORD_CHANNEL_WELCOME,
      DISCORD_CHANNEL_MEMES,
      DISCORD_CHANNEL_HENTAI,
      DISCORD_CHANNEL_PORNOLAND,
      DISCORD_CHANNEL_FETICHES,
      DISCORD_CHANNEL_PIES,
      DISCORD_CHANNEL_JUEGOS_NOPOR
    ].filter(id => id); // Filtrar IDs vacíos
    
    let enviados = 0;
    for (const canalId of canalesAnuncios) {
      try {
        const canal = client.channels.cache.get(canalId);
        if (canal) {
          const embed = new EmbedBuilder()
            .setTitle("📢 ANUNCIO IMPORTANTE")
            .setDescription(mensaje)
            .setColor("#ff0000")
            .setTimestamp();
          
          await canal.send({ embeds: [embed] });
          enviados++;
        }
      } catch (error) {
        console.error(`Error enviando anuncio a canal ${canalId}:`, error);
      }
    }
    
    await interaction.reply({ 
      content: `✅ Anuncio enviado a ${enviados} canales.`, 
      flags: [1] 
    });
  }

  // --- COMANDOS DE TICKETS ---
  if (interaction.isChatInputCommand() && interaction.commandName === "ticket") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("abrir_ticket")
        .setLabel("📩 Abrir Ticket")
        .setStyle(1)
    );
    
    // Enviar botón nuevo (reemplaza cualquier botón anterior)
    await interaction.reply({
      content: "Haz clic en el botón para abrir tu ticket privado.",
      components: [row],
      flags: [1],
    });
    
    // Eliminar el mensaje después de 15 segundos para limpiar - REDUCIDO
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (e) {
        // Ignorar error si el mensaje ya fue eliminado
      }
    }, 15000);
  }



  // --- COMANDOS DE VIP ---
  if (interaction.isChatInputCommand() && interaction.commandName === "vip") {
    const subcommand = interaction.options.getSubcommand();
    
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "Solo administradores pueden gestionar VIPs.", flags: [1] });
      return;
    }

    if (subcommand === "agregar") {
      const user = interaction.options.getUser("usuario");
      const duracion = interaction.options.getString("duracion");
      const nombreWeb = interaction.options.getString("nombreweb");
      
      // Parsear duración (ej: "30d" -> 30 días)
      const duracionMatch = duracion.match(/^(\d+)([dhms])$/i);
      if (!duracionMatch) {
        await interaction.reply({ content: "Formato de duración inválido. Usa: 30d, 2h, 45m", flags: [1] });
        return;
      }
      
      const valor = parseInt(duracionMatch[1]);
      const unidad = duracionMatch[2].toLowerCase();
      let msDuracion = 0;
      
      switch (unidad) {
        case 'd': msDuracion = valor * 24 * 60 * 60 * 1000; break;
        case 'h': msDuracion = valor * 60 * 60 * 1000; break;
        case 'm': msDuracion = valor * 60 * 1000; break;
        case 's': msDuracion = valor * 1000; break;
      }
      
      const expira = new Date(Date.now() + msDuracion);
      
      try {
        const usuarios = await getJsonFromGitHub('data/usuario.json');
        let usuario = usuarios.find(u => u.discordId === user.id);
        
        if (!usuario) {
          usuario = {
            usuario: nombreWeb || user.username,
            discordId: user.id,
            premium: true,
            premium_expira: expira.toISOString()
          };
          usuarios.push(usuario);
        } else {
          usuario.premium = true;
          usuario.premium_expira = expira.toISOString();
          if (nombreWeb) {
            usuario.usuario = nombreWeb;
          }
        }
        
        await updateFileOnGitHub('data/usuario.json', usuarios);
        
        // Asignar rol VIP si existe
        try {
          const vipRole = interaction.guild.roles.cache.find(role => 
            role.name.toLowerCase().includes('vip') || 
            role.name.toLowerCase().includes('premium')
          );
          if (vipRole) {
            await interaction.guild.members.cache.get(user.id)?.roles.add(vipRole);
          }
        } catch (roleError) {
          console.error("Error asignando rol VIP:", roleError);
        }
        
        const embed = new EmbedBuilder()
          .setTitle("👑 VIP Agregado")
          .setDescription(`**${user.tag}** ahora es VIP hasta **${expira.toLocaleDateString()}**${nombreWeb ? ` (${nombreWeb})` : ''}`)
          .setColor("#00ff00")
          .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
      } catch (error) {
        console.error("Error agregando VIP:", error);
        await interaction.reply({ content: "Error al agregar VIP.", flags: [1] });
      }
    }
    
    else if (subcommand === "remover") {
      const user = interaction.options.getUser("usuario");
      const nombreWeb = interaction.options.getString("nombreweb");
      
      try {
        const usuarios = await getJsonFromGitHub('data/usuario.json');
        const usuario = usuarios.find(u => u.discordId === user.id);
        
        if (usuario && usuario.premium) {
          usuario.premium = false;
          usuario.premium_expira = null;
          await updateFileOnGitHub('data/usuario.json', usuarios);
          
          // Remover rol VIP si existe
          try {
            const vipRole = interaction.guild.roles.cache.find(role => 
              role.name.toLowerCase().includes('vip') || 
              role.name.toLowerCase().includes('premium')
            );
            if (vipRole) {
              await interaction.guild.members.cache.get(user.id)?.roles.remove(vipRole);
            }
          } catch (roleError) {
            console.error("Error removiendo rol VIP:", roleError);
          }
          
          const embed = new EmbedBuilder()
            .setTitle("❌ VIP Removido")
            .setDescription(`**${user.tag}** ya no es VIP${nombreWeb ? ` (${nombreWeb})` : ''}`)
            .setColor("#ff0000")
            .setTimestamp();
          
          await interaction.reply({ embeds: [embed] });
        } else {
          await interaction.reply({ content: "Este usuario no es VIP.", flags: [1] });
        }
      } catch (error) {
        console.error("Error removiendo VIP:", error);
        await interaction.reply({ content: "Error al remover VIP.", flags: [1] });
      }
    }
    
    else if (subcommand === "listar") {
      try {
        const usuarios = await getJsonFromGitHub('data/usuario.json');
        const vips = usuarios.filter(u => u.premium && u.premium_expira);
        
        if (vips.length === 0) {
          await interaction.reply({ content: "No hay usuarios VIP activos.", flags: [1] });
          return;
        }
        
        const embed = new EmbedBuilder()
          .setTitle("👑 Usuarios VIP")
          .setDescription(vips.map(vip => 
            `• **${vip.usuario}** - Expira: ${new Date(vip.premium_expira).toLocaleDateString()}`
          ).join('\n'))
          .setColor("#ffd700")
          .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
      } catch (error) {
        console.error("Error listando VIPs:", error);
        await interaction.reply({ content: "Error al listar VIPs.", flags: [1] });
      }
    }
  }

  // --- COMANDOS DE MODERACIÓN ---
  if (interaction.isChatInputCommand() && interaction.commandName === "kick") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      await interaction.reply({ content: "No tienes permisos para expulsar usuarios.", flags: [1] });
      return;
    }
    
    const user = interaction.options.getUser("usuario");
    const razon = interaction.options.getString("razon") || "Sin razón especificada";
    
    try {
      await interaction.guild.members.kick(user, razon);
      await interaction.reply({ content: `✅ **${user.tag}** ha sido expulsado. Razón: ${razon}` });
    } catch (error) {
      console.error("Error expulsando usuario:", error);
      await interaction.reply({ content: "Error al expulsar al usuario.", flags: [1] });
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "ban") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({ content: "No tienes permisos para banear usuarios.", flags: [1] });
      return;
    }
    
    const user = interaction.options.getUser("usuario");
    const razon = interaction.options.getString("razon") || "Sin razón especificada";
    
    try {
      await interaction.guild.members.ban(user, { reason: razon });
      await interaction.reply({ content: `🔨 **${user.tag}** ha sido baneado. Razón: ${razon}` });
    } catch (error) {
      console.error("Error baneando usuario:", error);
      await interaction.reply({ content: "Error al banear al usuario.", flags: [1] });
    }
  }

  // --- COMANDOS DE MODERACIÓN IMPLEMENTADOS ---
  
  if (interaction.isChatInputCommand() && interaction.commandName === "unban") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({ content: "No tienes permisos para desbanear usuarios.", flags: [1] });
      return;
    }
    
    const userId = interaction.options.getString("usuario_id");
    
    try {
      await interaction.guild.members.unban(userId);
      await interaction.reply({ content: `✅ Usuario con ID **${userId}** ha sido desbaneado.` });
    } catch (error) {
      console.error("❌ Error desbaneando usuario:", error);
      await interaction.reply({ content: "Error al desbanear al usuario.", flags: [1] });
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "timeout") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: "No tienes permisos para silenciar usuarios.", flags: [1] });
      return;
    }
    
    const user = interaction.options.getMember("usuario");
    const duracion = interaction.options.getString("duracion");
    const razon = interaction.options.getString("razon") || "Sin razón especificada";
    
    // Parsear duración
    const duracionMatch = duracion.match(/^(\d+)([dhms])$/i);
    if (!duracionMatch) {
      await interaction.reply({ content: "Formato de duración inválido. Usa: 5m, 1h, 1d", flags: [1] });
      return;
    }
    
    const valor = parseInt(duracionMatch[1]);
    const unidad = duracionMatch[2].toLowerCase();
    let msDuracion = 0;
    
    switch (unidad) {
      case 'd': msDuracion = valor * 24 * 60 * 60 * 1000; break;
      case 'h': msDuracion = valor * 60 * 60 * 1000; break;
      case 'm': msDuracion = valor * 60 * 1000; break;
      case 's': msDuracion = valor * 1000; break;
    }
    
    try {
      await user.timeout(msDuracion, razon);
      await interaction.reply({ content: `🔇 **${user.user.tag}** ha sido silenciado por ${duracion}. Razón: ${razon}` });
    } catch (error) {
      console.error("❌ Error silenciando usuario:", error);
      await interaction.reply({ content: "Error al silenciar al usuario.", flags: [1] });
    }
  }

  // --- COMANDOS DE UTILIDAD IMPLEMENTADOS ---
  
  if (interaction.isChatInputCommand() && interaction.commandName === "say") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({ content: "No tienes permisos para usar este comando.", flags: [1] });
      return;
    }
    
    const mensaje = interaction.options.getString("mensaje");
    
    try {
      await safeReply(interaction, { content: "✅ Mensaje enviado.", flags: [1] });
      await interaction.channel.send(mensaje);
    } catch (error) {
      console.error("Error enviando mensaje:", error);
      await safeReply(interaction, { content: "Error al enviar el mensaje.", flags: [1] });
    }
  }

  // --- COMANDOS DE ROLES IMPLEMENTADOS ---
  
  if (interaction.isChatInputCommand() && interaction.commandName === "role") {
    const subcommand = interaction.options.getSubcommand();
    
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: "No tienes permisos para gestionar roles.", flags: [1] });
      return;
    }
    
    if (subcommand === "agregar") {
      const user = interaction.options.getMember("usuario");
      const role = interaction.options.getRole("rol");
      
      try {
        await user.roles.add(role);
        await safeReply(interaction, { content: `✅ Rol **${role.name}** agregado a **${user.user.tag}**` });
      } catch (error) {
        console.error("Error agregando rol:", error);
        await safeReply(interaction, { content: "Error al agregar el rol.", flags: [1] });
      }
    }
    
    else if (subcommand === "remover") {
      const user = interaction.options.getMember("usuario");
      const role = interaction.options.getRole("rol");
      
      try {
        await user.roles.remove(role);
        await safeReply(interaction, { content: `✅ Rol **${role.name}** removido de **${user.user.tag}**` });
      } catch (error) {
        console.error("Error removiendo rol:", error);
        await safeReply(interaction, { content: "Error al remover el rol.", flags: [1] });
      }
    }
  }

  // --- COMANDOS DE INFORMACIÓN ---
  if (interaction.isChatInputCommand() && interaction.commandName === "userinfo") {
    const user = interaction.options.getUser("usuario") || interaction.user;
    const member = interaction.guild.members.cache.get(user.id);
    
    const embed = new EmbedBuilder()
      .setTitle(`👤 Información de ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "🆔 ID", value: user.id, inline: true },
        { name: "📅 Cuenta creada", value: user.createdAt.toLocaleDateString(), inline: true },
        { name: "📥 Se unió", value: member ? member.joinedAt.toLocaleDateString() : "No disponible", inline: true },
        { name: "🎭 Roles", value: member ? member.roles.cache.map(r => r.name).join(', ') : "No disponible" }
      )
      .setColor("#0099ff")
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "serverinfo") {
    const guild = interaction.guild;
    
    const embed = new EmbedBuilder()
      .setTitle(`🏠 Información de ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: "👥 Miembros", value: guild.memberCount.toString(), inline: true },
        { name: "📊 Canales", value: guild.channels.cache.size.toString(), inline: true },
        { name: "🎭 Roles", value: guild.roles.cache.size.toString(), inline: true },
        { name: "📅 Creado", value: guild.createdAt.toLocaleDateString(), inline: true },
        { name: "👑 Propietario", value: `<@${guild.ownerId}>`, inline: true },
        { name: "🌍 Región", value: guild.preferredLocale || "No disponible", inline: true }
      )
      .setColor("#00ff00")
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "botinfo") {
    const embed = new EmbedBuilder()
      .setTitle("🤖 Información del Bot")
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "📛 Nombre", value: client.user.tag, inline: true },
        { name: "🆔 ID", value: client.user.id, inline: true },
        { name: "📅 Creado", value: client.user.createdAt.toLocaleDateString(), inline: true },
        { name: "🏠 Servidores", value: client.guilds.cache.size.toString(), inline: true },
        { name: "👥 Usuarios", value: client.users.cache.size.toString(), inline: true },
        { name: "⏱️ Latencia", value: `${client.ws.ping}ms`, inline: true }
      )
      .setColor("#ff6b6b")
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }

  // --- COMANDOS DE UTILIDAD ---
  if (interaction.isChatInputCommand() && interaction.commandName === "ping") {
    const embed = new EmbedBuilder()
      .setTitle("🏓 Pong!")
      .setDescription(`Latencia: **${client.ws.ping}ms**`)
      .setColor("#00ff00")
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "avatar") {
    const user = interaction.options.getUser("usuario") || interaction.user;
    
    const embed = new EmbedBuilder()
      .setTitle(`🖼️ Avatar de ${user.tag}`)
      .setImage(user.displayAvatarURL({ size: 1024, dynamic: true }))
      .setColor("#0099ff")
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "say") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({ content: "No tienes permisos para usar este comando.", flags: [1] });
      return;
    }
    
    const mensaje = interaction.options.getString("mensaje");
    
    try {
      await safeReply(interaction, { content: "✅ Mensaje enviado.", flags: [1] });
      await interaction.channel.send(mensaje);
    } catch (error) {
      console.error("Error enviando mensaje:", error);
      await safeReply(interaction, { content: "Error al enviar el mensaje.", flags: [1] });
    }
  }

  // --- COMANDOS DE ROLES ---
  if (interaction.isChatInputCommand() && interaction.commandName === "role") {
    const subcommand = interaction.options.getSubcommand();
    
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: "No tienes permisos para gestionar roles.", flags: [1] });
      return;
    }
    
    if (subcommand === "agregar") {
      const user = interaction.options.getMember("usuario");
      const role = interaction.options.getRole("rol");
      
      try {
        await user.roles.add(role);
        await safeReply(interaction, { content: `✅ Rol **${role.name}** agregado a **${user.user.tag}**` });
      } catch (error) {
        console.error("Error agregando rol:", error);
        await safeReply(interaction, { content: "Error al agregar el rol.", flags: [1] });
      }
    }
    
    else if (subcommand === "remover") {
      const user = interaction.options.getMember("usuario");
      const role = interaction.options.getRole("rol");
      
      try {
        await user.roles.remove(role);
        await safeReply(interaction, { content: `✅ Rol **${role.name}** removido de **${user.user.tag}**` });
      } catch (error) {
        console.error("Error removiendo rol:", error);
        await safeReply(interaction, { content: "Error al remover el rol.", flags: [1] });
      }
    }
  }

  // --- COMANDOS DE LIMPIEZA ---
  if (interaction.isChatInputCommand() && interaction.commandName === "clear") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({ content: "No tienes permisos para limpiar mensajes.", flags: [1] });
      return;
    }
    
    const cantidad = interaction.options.getInteger("cantidad");
    
    try {
      await interaction.channel.bulkDelete(cantidad);
      await safeReply(interaction, { content: `✅ **${cantidad}** mensajes eliminados.`, flags: [1] });
    } catch (error) {
      console.error("Error limpiando mensajes:", error);
      await safeReply(interaction, { content: "Error al limpiar mensajes.", flags: [1] });
    }
  }

  // --- COMANDOS DE ENTRETENIMIENTO ---
  if (interaction.isChatInputCommand() && interaction.commandName === "8ball") {
    const pregunta = interaction.options.getString("pregunta");
    const respuestas = [
      "Sí, definitivamente.",
      "Es seguro que sí.",
      "Sin duda.",
      "Sí, definitivamente.",
      "Puedes confiar en ello.",
      "Como yo lo veo, sí.",
      "Lo más probable.",
      "Buen pronóstico.",
      "Las señales apuntan a que sí.",
      "Respuesta confusa, intenta de nuevo.",
      "Pregunta más tarde.",
      "Mejor no decirte ahora.",
      "No puedo predecir ahora.",
      "Concéntrate y pregunta de nuevo.",
      "No cuentes con ello.",
      "Mi respuesta es no.",
      "Mis fuentes dicen que no.",
      "El pronóstico no es tan bueno.",
      "Muy dudoso."
    ];
    
    const respuesta = respuestas[Math.floor(Math.random() * respuestas.length)];
    
    const embed = new EmbedBuilder()
      .setTitle("🎱 8 Ball")
      .addFields(
        { name: "❓ Pregunta", value: pregunta },
        { name: "🔮 Respuesta", value: respuesta }
      )
      .setColor("#000000")
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "coinflip") {
    const resultado = Math.random() < 0.5 ? "🪙 Cara" : "🪙 Cruz";
    
    const embed = new EmbedBuilder()
      .setTitle("🪙 Lanzamiento de Moneda")
      .setDescription(`**Resultado:** ${resultado}`)
      .setColor("#ffd700")
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "dice") {
    const cantidad = interaction.options.getInteger("cantidad") || 1;
    const caras = interaction.options.getInteger("caras") || 6;
    
    try {
      const resultados = [];
      for (let i = 0; i < cantidad; i++) {
        resultados.push(Math.floor(Math.random() * caras) + 1);
      }
      
      const total = resultados.reduce((a, b) => a + b, 0);
      
      const embed = new EmbedBuilder()
        .setTitle("🎲 Lanzamiento de Dados")
        .setDescription(`**Dados:** ${cantidad}d${caras}\n**Resultados:** ${resultados.join(', ')}\n**Total:** ${total}`)
        .setColor("#ff6b6b")
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("❌ Error lanzando dados:", error);
      await interaction.reply({ content: "Error al lanzar los dados.", flags: [1] });
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "novelasestado") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "Solo administradores pueden ver el estado de novelas anunciadas.", flags: [1] });
      return;
    }
    
    try {
  const novelas = await getJsonFromGitHub(ANUNCIADAS_JSON_GITHUB_PATH, ANUNCIADAS_GITHUB_OWNER, ANUNCIADAS_GITHUB_REPO, ANUNCIADAS_GITHUB_BRANCH);
      if (!Array.isArray(novelas)) {
        await interaction.reply({ content: "Error al cargar las novelas anunciadas.", flags: [1] });
        return;
      }
      
      const totalNovelas = novelas.length;
      const totalAnunciadas = novelasAnunciadas.size;
      
      const embed = new EmbedBuilder()
        .setTitle("📚 Estado de Novelas Anunciadas")
        .setDescription(`**Total de novelas:** ${totalNovelas}\n**Novelas anunciadas:** ${totalAnunciadas}`)
        .setColor("#00ff00")
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error obteniendo estado de novelas:", error);
      await interaction.reply({ content: "Error al obtener el estado de novelas.", flags: [1] });
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "resetearnovelas") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "Solo administradores pueden resetear la lista de novelas anunciadas.", flags: [1] });
      return;
    }
    
    try {
      // Resetear la lista de novelas anunciadas
      novelasAnunciadas.clear();
      await guardarNovelasEnGitHub(novelasAnunciadas);
      
      await interaction.reply({ content: "✅ Lista de novelas anunciadas reseteada.", flags: [1] });
    } catch (error) {
      console.error("Error reseteando novelas:", error);
      await interaction.reply({ content: "Error al resetear novelas.", flags: [1] });
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "videosestado") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "Solo administradores pueden ver el estado de videos anunciados.", flags: [1] });
      return;
    }
    
    try {
      const videos = await getJsonFromGitHub('data/videosAnunciados.json');
      if (!Array.isArray(videos)) {
        await interaction.reply({ content: "Error al cargar los videos anunciados.", flags: [1] });
        return;
      }
      
      const totalVideos = videos.length;
      const totalAnunciados = videosAnunciados.size;
      
      const embed = new EmbedBuilder()
        .setTitle("📺 Estado de Videos Anunciados")
        .setDescription(`**Total de videos:** ${totalVideos}\n**Videos anunciados:** ${totalAnunciados}`)
        .setColor("#00ff00")
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error obteniendo estado de videos:", error);
      await interaction.reply({ content: "Error al obtener el estado de videos.", flags: [1] });
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "resetearvideos") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "Solo administradores pueden resetear la lista de videos anunciados.", flags: [1] });
      return;
    }
    
    try {
      // Resetear la lista de videos anunciados
      videosAnunciados.clear();
      await guardarVideosEnGitHub(videosAnunciados);
      
      await interaction.reply({ content: "✅ Lista de videos anunciados reseteada.", flags: [1] });
    } catch (error) {
      console.error("Error reseteando videos:", error);
      await interaction.reply({ content: "Error al resetear videos.", flags: [1] });
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "reanunciarnovela") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "Solo administradores pueden re-anunciar novelas.", flags: [1] });
      return;
    }
    
    try {
      const id = interaction.options.getString("id");
      const novela = await getJsonFromGitHub(`data/novelas-${id}.json`);
      if (!novela) {
        await interaction.reply({ content: "No se encontró la novela.", flags: [1] });
        return;
      }
      
      // Verificar si la novela ya fue anunciada
      if (novelasAnunciadas.has(novela.id)) {
        await interaction.reply({ content: "La novela ya fue anunciada anteriormente.", flags: [1] });
        return;
      }
      
      const canal = client.channels.cache.get(CANAL_ANUNCIOS_ID);
      
      if (canal) {
        const embed = new EmbedBuilder()
          .setTitle(`📖 ${novela.titulo}`)
          .setDescription(novela.descripcion || "Sin descripción disponible")
          .addFields(
            { name: "📱 Plataforma", value: novela.plataforma || "No especificada", inline: true },
            { name: "📊 Estado", value: novela.estado || "No especificado", inline: true },
            { name: "💾 Peso", value: novela.peso || "No especificado", inline: true }
          )
          .setColor("#ff6b6b")
          .setTimestamp();
        
        if (novela.imagen) {
          embed.setThumbnail(novela.imagen);
        }
        
        // Anunciar en todos los canales configurados
        for (const canal of CANALES_ANUNCIOS_NOVELAS) {
          try {
            await client.channels.cache.get(canal).send({ embeds: [embed] });
            console.log(`✅ Novela "${novela.titulo}" anunciada en ${canal}`);
          } catch (canalError) {
            console.error(`❌ Error anunciando en canal ${canal}:`, canalError);
          }
        }
        
        novelasAnunciadas.add(novela.id);
        await guardarNovelasEnGitHub(novelasAnunciadas);
        await interaction.reply({ content: "✅ Novela re-anunciada.", flags: [1] });
      } else {
        await interaction.reply({ content: "Canal de anuncios no encontrado.", flags: [1] });
      }
    } catch (error) {
      console.error("Error reanunciando novela:", error);
      await interaction.reply({ content: "Error al reanunciar la novela.", flags: [1] });
    }
  }

  // Comando para debuggear novelas anunciadas en tiempo real
  if (interaction.isChatInputCommand() && interaction.commandName === "debugnovelas") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await safeReply(interaction, "❌ No tienes permisos para usar este comando.");
      return;
    }
    
    try {
      const totalNovelas = novelasAnunciadas.size;
      const primeras5 = Array.from(novelasAnunciadas).slice(0, 5);
      const ultimas5 = Array.from(novelasAnunciadas).slice(-5);
      
      const embed = new EmbedBuilder()
        .setTitle("🔍 Debug Novelas Anunciadas")
        .setColor("#00ff00")
        .addFields(
          { name: "📊 Total Anunciadas", value: totalNovelas.toString(), inline: true },
          { name: "📋 Primeras 5", value: primeras5.length > 0 ? primeras5.join("\n") : "Ninguna", inline: false },
          { name: "📋 Últimas 5", value: ultimas5.length > 0 ? ultimas5.join("\n") : "Ninguna", inline: false }
        )
        .setTimestamp();
      
      await safeReply(interaction, { embeds: [embed] });
    } catch (error) {
      console.error("Error en debugnovelas:", error);
      await safeReply(interaction, "❌ Error obteniendo información de debug.");
    }
  }

  // Comando para recargar novelas anunciadas desde GitHub
  if (interaction.isChatInputCommand() && interaction.commandName === "recargarnovelas") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await safeReply(interaction, "❌ No tienes permisos para usar este comando.");
      return;
    }
    
    try {
      console.log("🔄 Recargando novelas anunciadas desde GitHub...");
      
      if (!isGitHubConfigured()) {
        await safeReply(interaction, "❌ GitHub no está configurado.");
        return;
      }
      
  const novelasAnunciadasData = await getJsonFromGitHub(ANUNCIADAS_JSON_GITHUB_PATH, ANUNCIADAS_GITHUB_OWNER, ANUNCIADAS_GITHUB_REPO, ANUNCIADAS_GITHUB_BRANCH);
      console.log("📥 Datos recibidos de GitHub:", novelasAnunciadasData);
      
      if (Array.isArray(novelasAnunciadasData)) {
        novelasAnunciadas = new Set(novelasAnunciadasData);
        console.log(`✅ Novelas anunciadas recargadas: ${novelasAnunciadas.size} novelas`);
        
        const embed = new EmbedBuilder()
          .setTitle("🔄 Novelas Anunciadas Recargadas")
          .setColor("#00ff00")
          .addFields(
            { name: "📊 Total Recargadas", value: novelasAnunciadas.size.toString(), inline: true },
            { name: "📋 Primeras 5", value: Array.from(novelasAnunciadas).slice(0, 5).join("\n") || "Ninguna", inline: false }
          )
          .setTimestamp();
        
        await safeReply(interaction, { embeds: [embed] });
      } else {
        await safeReply(interaction, "❌ Los datos de GitHub no son un array válido.");
      }
    } catch (error) {
      console.error("Error recargando novelas:", error);
      await safeReply(interaction, "❌ Error recargando novelas desde GitHub.");
    }
  }

  // Comando para verificar el contenido del archivo JSON en GitHub
  if (interaction.isChatInputCommand() && interaction.commandName === "verificarjson") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await safeReply(interaction, "❌ No tienes permisos para usar este comando.");
      return;
    }
    
    try {
      console.log("🔍 Verificando contenido del archivo JSON en GitHub...");
      
      if (!isGitHubConfigured()) {
        await safeReply(interaction, "❌ GitHub no está configurado.");
        return;
      }
      
  const novelasAnunciadasData = await getJsonFromGitHub(ANUNCIADAS_JSON_GITHUB_PATH, ANUNCIADAS_GITHUB_OWNER, ANUNCIADAS_GITHUB_REPO, ANUNCIADAS_GITHUB_BRANCH);
      console.log("📥 Contenido completo del archivo:", novelasAnunciadasData);
      
      const embed = new EmbedBuilder()
        .setTitle("🔍 Contenido del Archivo JSON")
        .setColor("#0099ff")
        .addFields(
          { name: "📄 Tipo de Datos", value: typeof novelasAnunciadasData, inline: true },
          { name: "📊 Total Elementos", value: Array.isArray(novelasAnunciadasData) ? novelasAnunciadasData.length.toString() : "No es array", inline: true },
          { name: "📋 Contenido Completo", value: JSON.stringify(novelasAnunciadasData, null, 2).substring(0, 1000) + (JSON.stringify(novelasAnunciadasData, null, 2).length > 1000 ? "..." : ""), inline: false }
        )
        .setTimestamp();
      
      await safeReply(interaction, { embeds: [embed] });
    } catch (error) {
      console.error("Error verificando JSON:", error);
      await safeReply(interaction, "❌ Error verificando el archivo JSON en GitHub.");
    }
  }

  // Comando para activar/desactivar verificaciones automáticas
  if (interaction.isChatInputCommand() && interaction.commandName === "controlnovelas") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await safeReply(interaction, "❌ No tienes permisos para usar este comando.");
      return;
    }
    
    const accion = interaction.options.getString("accion");
    
    try {
      if (accion === "activar") {
        verificacionesAutomaticasActivas = true;
        await safeReply(interaction, "✅ Verificaciones automáticas de novelas **ACTIVADAS**");
        console.log("🟢 Verificaciones automáticas de novelas activadas");
      } else if (accion === "desactivar") {
        verificacionesAutomaticasActivas = false;
        await safeReply(interaction, "⏸️ Verificaciones automáticas de novelas **DESACTIVADAS**");
        console.log("🔴 Verificaciones automáticas de novelas desactivadas");
      } else if (accion === "estado") {
        const estado = verificacionesAutomaticasActivas ? "🟢 ACTIVAS" : "🔴 DESACTIVADAS";
        await safeReply(interaction, `📊 Estado de verificaciones automáticas: **${estado}**`);
      }
    } catch (error) {
      console.error("Error controlando verificaciones:", error);
      await safeReply(interaction, "❌ Error controlando verificaciones automáticas.");
    }
  }

  // Comando para forzar revisión de novelas nuevas
  if (interaction.isChatInputCommand() && interaction.commandName === "revisarnovelas") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await safeReply(interaction, "❌ No tienes permisos para usar este comando.");
      return;
    }
    
    try {
      await safeReply(interaction, "🔍 Iniciando revisión manual de novelas nuevas...");
      console.log("🔍 Revisión manual de novelas iniciada por comando");
      await checkNovelas();
      await interaction.followUp({ content: "✅ Revisión de novelas completada.", flags: [1] });
    } catch (error) {
      console.error("Error en revisión manual:", error);
      await interaction.followUp({ content: "❌ Error durante la revisión de novelas.", flags: [1] });
    }
  }

  // Comando para verificar formato del archivo JSON
  if (interaction.isChatInputCommand() && interaction.commandName === "verificarformato") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await safeReply(interaction, "❌ No tienes permisos para usar este comando.");
      return;
    }
    
    try {
      console.log("🔍 Verificando formato del archivo JSON...");
      
      if (!isGitHubConfigured()) {
        await safeReply(interaction, "❌ GitHub no está configurado.");
        return;
      }
      
  const novelasAnunciadasData = await getJsonFromGitHub(ANUNCIADAS_JSON_GITHUB_PATH, ANUNCIADAS_GITHUB_OWNER, ANUNCIADAS_GITHUB_REPO, ANUNCIADAS_GITHUB_BRANCH);
      const videosAnunciadosData = await getJsonFromGitHub('data/videosAnunciados.json');
      console.log("📥 Contenido de novelas:", novelasAnunciadasData);
      console.log("📥 Contenido de videos:", videosAnunciadosData);
      
      const embed = new EmbedBuilder()
        .setTitle("🔍 Formato de Archivos JSON")
        .setColor("#00ff00")
        .addFields(
          { name: "📚 Novelas Anunciadas", value: `Total: ${Array.isArray(novelasAnunciadasData) ? novelasAnunciadasData.length : 'No es array'}`, inline: true },
          { name: "🎥 Videos Anunciados", value: `Total: ${Array.isArray(videosAnunciadosData) ? videosAnunciadosData.length : 'No es array'}`, inline: true },
          { name: "📄 Formato", value: "JSON limpio con indentación", inline: true },
          { name: "📋 Novelas Anunciadas", value: "```json\n" + JSON.stringify(novelasAnunciadasData, null, 2) + "\n```", inline: false },
          { name: "📋 Videos Anunciados", value: "```json\n" + JSON.stringify(videosAnunciadosData, null, 2) + "\n```", inline: false }
        )
        .setTimestamp();
      
      await safeReply(interaction, { embeds: [embed] });
    } catch (error) {
      console.error("Error verificando formato:", error);
      await safeReply(interaction, "❌ Error verificando el formato de los archivos JSON.");
    }
  }

  // Comando para forzar corrección del formato JSON
  if (interaction.isChatInputCommand() && interaction.commandName === "corregirformato") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await safeReply(interaction, "❌ No tienes permisos para usar este comando.");
      return;
    }
    
    try {
      console.log("🔧 Forzando corrección del formato JSON...");
      
      if (!isGitHubConfigured()) {
        await safeReply(interaction, "❌ GitHub no está configurado.");
        return;
      }
      
      // Corregir novelas anunciadas
  const novelasAnunciadasData = await getJsonFromGitHub(ANUNCIADAS_JSON_GITHUB_PATH, ANUNCIADAS_GITHUB_OWNER, ANUNCIADAS_GITHUB_REPO, ANUNCIADAS_GITHUB_BRANCH);
      let novelasOrdenadas = [];
      if (Array.isArray(novelasAnunciadasData)) {
        novelasOrdenadas = novelasAnunciadasData.sort();
  await updateFileOnGitHub(ANUNCIADAS_JSON_GITHUB_PATH, novelasOrdenadas);
      }
      
      // Corregir videos anunciados
      const videosAnunciadosData = await getJsonFromGitHub('data/videosAnunciados.json');
      let videosOrdenados = [];
      if (Array.isArray(videosAnunciadosData)) {
        videosOrdenados = videosAnunciadosData.sort();
        await updateFileOnGitHub('data/videosAnunciados.json', videosOrdenados);
      }
      
      const embed = new EmbedBuilder()
        .setTitle("🔧 Formato JSON Corregido")
        .setColor("#00ff00")
        .addFields(
          { name: "📚 Novelas", value: `${novelasOrdenadas.length} IDs ordenados`, inline: true },
          { name: "🎥 Videos", value: `${videosOrdenados.length} IDs ordenados`, inline: true },
          { name: "📄 Estado", value: "✅ Formato corregido", inline: true },
          { name: "📋 Novelas Corregidas", value: "```json\n" + JSON.stringify(novelasOrdenadas, null, 2) + "\n```", inline: false },
          { name: "📋 Videos Corregidos", value: "```json\n" + JSON.stringify(videosOrdenados, null, 2) + "\n```", inline: false }
        )
        .setTimestamp();
      
      await safeReply(interaction, { embeds: [embed] });
      console.log("✅ Formato JSON corregido exitosamente");
    } catch (error) {
      console.error("Error corrigiendo formato:", error);
      await safeReply(interaction, "❌ Error corrigiendo el formato de los archivos JSON.");
    }
  }

  // Comando para debug de videos anunciados
  if (interaction.isChatInputCommand() && interaction.commandName === "debugvideos") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await safeReply(interaction, "❌ No tienes permisos para usar este comando.");
      return;
    }
    
    try {
      console.log("🔍 Debug de videos anunciados...");
      
      const embed = new EmbedBuilder()
        .setTitle("🎥 Debug de Videos Anunciados")
        .setColor("#00ff00")
        .addFields(
          { name: "📊 Total en Set", value: videosAnunciados.size.toString(), inline: true },
          { name: "📋 IDs en Set", value: Array.from(videosAnunciados).slice(0, 10).join(', '), inline: false },
          { name: "📄 Estado", value: "Set cargado correctamente", inline: true }
        )
        .setTimestamp();
      
      await safeReply(interaction, { embeds: [embed] });
    } catch (error) {
      console.error("Error en debug de videos:", error);
      await safeReply(interaction, "❌ Error obteniendo información de videos anunciados.");
    }
  }

  // Comando para recargar videos anunciados
  if (interaction.isChatInputCommand() && interaction.commandName === "recargarvideos") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await safeReply(interaction, "❌ No tienes permisos para usar este comando.");
      return;
    }
    
    try {
      console.log("🔄 Recargando videos anunciados...");
      
      if (isGitHubConfigured()) {
        const videosData = await getJsonFromGitHub('data/videosAnunciados.json');
        if (Array.isArray(videosData)) {
          videosAnunciados = new Set(videosData);
          console.log(`✅ Videos anunciados recargados: ${videosAnunciados.size} videos`);
        }
      }
      
      const embed = new EmbedBuilder()
        .setTitle("🔄 Videos Anunciados Recargados")
        .setColor("#00ff00")
        .addFields(
          { name: "📊 Total Recargado", value: videosAnunciados.size.toString(), inline: true },
          { name: "📋 IDs", value: Array.from(videosAnunciados).slice(0, 10).join(', '), inline: false }
        )
        .setTimestamp();
      
      await safeReply(interaction, { embeds: [embed] });
    } catch (error) {
      console.error("Error recargando videos:", error);
      await safeReply(interaction, "❌ Error recargando videos anunciados.");
    }
  }

  // Comando para resetear videos anunciados
  if (interaction.isChatInputCommand() && interaction.commandName === "resetearvideos") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await safeReply(interaction, "❌ No tienes permisos para usar este comando.");
      return;
    }
    
    try {
      console.log("🔄 Reseteando videos anunciados...");
      
      videosAnunciados.clear();
      await guardarVideosEnGitHub(videosAnunciados);
      
      const embed = new EmbedBuilder()
        .setTitle("🔄 Videos Anunciados Reseteados")
        .setColor("#ff0000")
        .addFields(
          { name: "📊 Estado", value: "Set vaciado y guardado", inline: true },
          { name: "📋 Total", value: "0 videos", inline: true }
        )
        .setTimestamp();
      
      await safeReply(interaction, { embeds: [embed] });
    } catch (error) {
      console.error("Error reseteando videos:", error);
      await safeReply(interaction, "❌ Error reseteando videos anunciados.");
    }
  }
});

// ---------------------
// 3. SISTEMA DE ASIGNACIÓN AUTOMÁTICA DE ROLES - NUEVO
// ---------------------
client.on("guildMemberAdd", async (member) => {
  try {
    console.log(`👋 Nuevo miembro: ${member.user.tag}`);
    
    // Asignar rol de miembro automátiggggggh  ccccamente
    if (DISCORD_ROLE_MIEMBRO) {
      const memberRole = member.guild.roles.cache.get(DISCORD_ROLE_MIEMBRO);
      if (memberRole) {
        await member.roles.add(memberRole);
        console.log(`✅ Rol de miembro asignado a ${member.user.tag}`);
        
        // Enviar mensaje de bienvenida
        const welcomeChannel = client.channels.cache.get(DISCORD_CHANNEL_WELCOME);
        if (welcomeChannel) {
          const embed = new EmbedBuilder()
            .setTitle("🎉 ¡Bienvenido al servidor!")
            .setDescription(`**¡Hola ${member}!**\n\n👋 Esperamos que disfrutes tu estadía en nuestro servidor.\n📖 Revisa las reglas y canales disponibles.\n🎮 ¡Diviértete!`)
            .setColor("#00ff00")
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();
          
          await welcomeChannel.send({ embeds: [embed] });
        }
      } else {
        console.log(`❌ Rol de miembro no encontrado: ${DISCORD_ROLE_MIEMBRO}`);
      }
    }
  } catch (error) {
    console.error("❌ Error asignando rol de miembro:", error);
  }
});

// ---------------------
// 4. MANEJADOR DE REACCIONES PARA SORTEOS - MEJORADO
// ---------------------
client.on("messageReactionAdd", async (reaction, user) => {
  try {
    if (user.bot) return;
    
    if (reaction.emoji.name === "🎉" && sorteoActual) {
      const message = reaction.message;
      if (message.channel.id === sorteoActual.canalParticipacion) {
        console.log(`🎉 Usuario ${user.tag} participando en sorteo ${sorteoActual.tipo}`);
        sorteoActual.participantes.add(user.id);
        
        // Guardar en GitHub de forma asíncrona con manejo de errores
        sorteoGitHubQueue.add(async () => {
          try {
            const sorteoData = {
              ...sorteoActual,
              participantes: Array.from(sorteoActual.participantes)
            };
            await guardarSorteoEnGitHub(sorteoData);
            console.log(`✅ Participante ${user.tag} guardado en GitHub`);
          } catch (error) {
            console.error("❌ Error guardando participantes en GitHub:", error);
          }
        });
      }
    }
  } catch (error) {
    console.error("❌ Error procesando reacción:", error);
  }
});

// ---------------------
// 4. FUNCIONES AUXILIARES
// ---------------------

// Función para cargar VIPs desde GitHub
async function cargarVipsDesdeGitHub() {
  try {
    if (!isGitHubConfigured()) {
      console.log("⚠️ GitHub no configurado, usando archivo local");
      const VIPS_PATH = path.join(__dirname, 'data', 'vips.json');
      if (fs.existsSync(VIPS_PATH)) {
        const data = fs.readFileSync(VIPS_PATH, 'utf8');
        return JSON.parse(data);
      }
      return [];
    }
    const vips = await getJsonFromGitHub('data/vips.json');
    return Array.isArray(vips) ? vips : [];
  } catch (error) {
    console.error('❌ Error obteniendo VIPs desde GitHub:', error);
    console.log('🔄 Intentando usar archivo local como fallback...');
    const VIPS_PATH = path.join(__dirname, 'data', 'vips.json');
    if (fs.existsSync(VIPS_PATH)) {
      try {
        const data = fs.readFileSync(VIPS_PATH, 'utf8');
        return JSON.parse(data);
      } catch (localError) {
        console.error('❌ Error leyendo archivo local:', localError);
        return [];
      }
    }
    return [];
  }
}

// Función para guardar VIPs en GitHub
async function guardarVipsEnGitHub(vips) {
  try {
    if (!isGitHubConfigured()) {
      console.log('⚠️ GitHub no configurado, guardando en archivo local');
      const VIPS_PATH = path.join(__dirname, 'data', 'vips.json');
      const dir = path.dirname(VIPS_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(VIPS_PATH, JSON.stringify(vips, null, 2));
      return { success: true, message: 'Guardado en archivo local' };
    }
    
    const octokit = new Octokit({
      auth: GITHUB_TOKEN,
    });
    
    const content = JSON.stringify(vips, null, 2);
    const sha = await getFileSha('data/vips.json');
    
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: 'data/vips.json',
      message: 'Actualización automática de VIPs',
      content: Buffer.from(content).toString('base64'),
      sha: sha,
      branch: GITHUB_BRANCH,
    });
    
    console.log('✅ VIPs guardados en GitHub');
    return { success: true, message: 'Guardado en GitHub' };
  } catch (error) {
    console.error('❌ Error guardando VIPs en GitHub:', error);
    // Fallback a archivo local
    try {
      const VIPS_PATH = path.join(__dirname, 'data', 'vips.json');
      const dir = path.dirname(VIPS_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(VIPS_PATH, JSON.stringify(vips, null, 2));
      console.log('✅ VIPs guardados en archivo local como fallback');
      return { success: true, message: 'Guardado en archivo local como fallback' };
    } catch (localError) {
      console.error('❌ Error guardando en archivo local:', localError);
      return { success: false, error: 'Error guardando datos' };
    }
  }
}

// Función para agregar XP a un usuario
function addXP(userId) {
  // Implementación básica de XP
  const xpGain = Math.floor(Math.random() * 10) + 1;
  console.log(`🎯 Usuario ${userId} ganó ${xpGain} XP`);
  return xpGain;
}

// Función para guardar novelas anunciadas en el repo externo
async function guardarNovelasEnGitHub(novelas) {
  try {
    console.log("💾 Guardando novelas anunciadas en repo externo...");
    console.log(`📊 Total de novelas a guardar: ${novelas.size}`);
    const octokit = new Octokit({ auth: GITHUB_TOKEN });
    let sha = undefined;
    try {
      // Obtener SHA si el archivo existe en el nuevo repo
      const { data } = await octokit.repos.getContent({
        owner: ANUNCIADAS_GITHUB_OWNER,
        repo: ANUNCIADAS_GITHUB_REPO,
        path: ANUNCIADAS_JSON_GITHUB_PATH,
        ref: ANUNCIADAS_GITHUB_BRANCH
      });
      sha = data.sha;
    } catch (e) {
      // Si no existe, lo creamos
    }
    await octokit.repos.createOrUpdateFileContents({
      owner: ANUNCIADAS_GITHUB_OWNER,
      repo: ANUNCIADAS_GITHUB_REPO,
      path: ANUNCIADAS_JSON_GITHUB_PATH,
      message: 'Actualizar novelas anunciadas en Discord',
      content: Buffer.from(JSON.stringify(Array.from(novelas), null, 2)).toString('base64'),
      branch: ANUNCIADAS_GITHUB_BRANCH,
      sha
    });
    console.log('✅ Novelas guardadas en el repo externo (formato limpio, ordenadas)');
    return { success: true, message: 'Guardado en repo externo' };
  } catch (error) {
    console.error('❌ Error guardando novelas en el repo externo:', error);
    return { success: false, error: 'Error guardando datos en repo externo' };
  }
}

async function guardarVideosEnGitHub(videos) {
  try {
    console.log("💾 Guardando videos anunciados...");
    console.log(`📊 Total de videos a guardar: ${videos.size}`);
    
    if (!isGitHubConfigured()) {
      console.log("⚠️ GitHub no configurado, guardando en archivo local");
      const VIDEOS_PATH = path.join(__dirname, 'data', 'videosAnunciados.json');
      const dir = path.dirname(VIDEOS_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // LEER IDs EXISTENTES Y AGREGAR NUEVOS (NO ELIMINAR)
      let videosExistentes = [];
      if (fs.existsSync(VIDEOS_PATH)) {
        try {
          const contenidoExistente = fs.readFileSync(VIDEOS_PATH, "utf-8");
          videosExistentes = JSON.parse(contenidoExistente);
          console.log(`📖 IDs de videos existentes cargados: ${videosExistentes.length}`);
        } catch (error) {
          console.log("⚠️ Error leyendo archivo existente, empezando desde cero");
          videosExistentes = [];
        }
      }
      
      // COMBINAR IDs EXISTENTES CON NUEVOS
      const todosLosIds = [...new Set([...videosExistentes, ...Array.from(videos)])];
      const videosOrdenados = todosLosIds.sort();
      
      // GUARDAR EN FORMATO JSON LIMPIO - ASEGURAR FORMATO CORRECTO
      const jsonData = JSON.stringify(videosOrdenados, null, 2);
      fs.writeFileSync(VIDEOS_PATH, jsonData);
      console.log(`✅ Videos guardados en archivo local (${videosOrdenados.length} total, ordenados)`);
      console.log("📋 Formato JSON guardado:", jsonData.substring(0, 200) + "...");
      return { success: true, message: 'Guardado en archivo local' };
    }

    // LEER IDs EXISTENTES DESDE GITHUB
    let videosExistentes = [];
    try {
      const contenidoExistente = await getJsonFromGitHub('data/videosAnunciados.json');
      if (Array.isArray(contenidoExistente)) {
        videosExistentes = contenidoExistente;
        console.log(`📖 IDs de videos existentes cargados desde GitHub: ${videosExistentes.length}`);
      }
    } catch (error) {
      console.log("⚠️ No se pudieron cargar IDs existentes, empezando desde cero");
      videosExistentes = [];
    }
    
    // COMBINAR IDs EXISTENTES CON NUEVOS
    const todosLosIds = [...new Set([...videosExistentes, ...Array.from(videos)])];
    const videosOrdenados = todosLosIds.sort();
    
    // GUARDAR EN FORMATO JSON LIMPIO - ASEGURAR FORMATO CORRECTO
    const jsonData = JSON.stringify(videosOrdenados, null, 2);
    console.log("📤 Enviando datos ordenados a GitHub...");
    console.log(`📋 Total de IDs (${videosOrdenados.length}):`, videosOrdenados);
    console.log("📋 Formato JSON a guardar:", jsonData.substring(0, 200) + "...");
    
    // USAR updateFileOnGitHub CON EL JSON STRINGIFICADO
    const result = await updateFileOnGitHub('data/videosAnunciados.json', videosOrdenados);
    console.log('✅ Videos guardados en GitHub (formato limpio, ordenados)');
    return { success: true, message: 'Guardado en GitHub' };
  } catch (error) {
    console.error('❌ Error guardando videos en GitHub:', error);
    // Fallback a archivo local
    try {
      const VIDEOS_PATH = path.join(__dirname, 'data', 'videosAnunciados.json');
      const dir = path.dirname(VIDEOS_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // LEER IDs EXISTENTES Y AGREGAR NUEVOS
      let videosExistentes = [];
      if (fs.existsSync(VIDEOS_PATH)) {
        try {
          const contenidoExistente = fs.readFileSync(VIDEOS_PATH, "utf-8");
          videosExistentes = JSON.parse(contenidoExistente);
        } catch (error) {
          videosExistentes = [];
        }
      }
      
      // COMBINAR IDs EXISTENTES CON NUEVOS
      const todosLosIds = [...new Set([...videosExistentes, ...Array.from(videos)])];
      const videosOrdenados = todosLosIds.sort();
      
      // GUARDAR EN FORMATO JSON LIMPIO
      const jsonData = JSON.stringify(videosOrdenados, null, 2);
      fs.writeFileSync(VIDEOS_PATH, jsonData);
      console.log(`✅ Videos guardados en archivo local como fallback (${videosOrdenados.length} total, ordenados)`);
      return { success: true, message: 'Guardado en archivo local como fallback' };
    } catch (localError) {
      console.error('❌ Error guardando videos en archivo local:', localError);
      return { success: false, error: 'Error guardando datos de videos' };
    }
  }
}

// Función para verificar nuevas novelas - CON RATE LIMITING Y MEJOR MANEJO DE ERRORES
async function checkNovelas() {
  try {
    // VERIFICAR SI LAS VERIFICACIONES AUTOMÁTICAS ESTÁN ACTIVAS
    if (!verificacionesAutomaticasActivas) {
      console.log("⏸️ Verificaciones automáticas de novelas desactivadas, saltando...");
      return;
    }
    
    console.log("🔍 Verificando nuevas novelas...");
    
    // RECARGAR NOVELAS ANUNCIADAS DESDE GITHUB ANTES DE VERIFICAR
    if (isGitHubConfigured()) {
      try {
        console.log("🔄 Recargando novelas anunciadas desde GitHub...");
  const novelasAnunciadasData = await getJsonFromGitHub(ANUNCIADAS_JSON_GITHUB_PATH, ANUNCIADAS_GITHUB_OWNER, ANUNCIADAS_GITHUB_REPO, ANUNCIADAS_GITHUB_BRANCH);
        if (Array.isArray(novelasAnunciadasData)) {
          novelasAnunciadas = new Set(novelasAnunciadasData);
          console.log(`✅ Novelas anunciadas recargadas: ${novelasAnunciadas.size} novelas`);
        }
      } catch (error) {
        console.log("⚠️ Error recargando novelas anunciadas:", error.message);
      }
    }
    
    console.log(`📊 Novelas ya anunciadas: ${novelasAnunciadas.size}`);
    console.log(`📋 IDs de novelas anunciadas:`, Array.from(novelasAnunciadas).slice(0, 5));
    console.log(`🔍 Estado actual del Set novelasAnunciadas:`, novelasAnunciadas);
    
    // Verificar rate limiting para GitHub API
    if (!rateLimiter.canMakeRequest('github_api', 10, 60000)) {
      console.log("⚠️ Rate limit alcanzado para GitHub API, esperando...");
      return;
    }
    
    if (!isGitHubConfigured()) {
      console.log("⚠️ GitHub no configurado, saltando verificación de novelas");
      return;
    }
    
    // Intentar cargar desde novelas-1.json primero
    let novelas = await getJsonFromGitHub('data/novelas-1.json');
    if (!Array.isArray(novelas)) {
      // Fallback a novelas.json
      novelas = await getJsonFromGitHub('data/novelas.json');
      if (!Array.isArray(novelas)) {
        console.log("❌ No se pudieron cargar las novelas desde ningún archivo");
        return;
      }
    }
    
    console.log(`📚 Total de novelas cargadas: ${novelas.length}`);
    
    // Verificar que los canales de anuncios existan
    const canalesAnuncios = [];
    for (const canalId of CANALES_ANUNCIOS_NOVELAS) {
      const canal = client.channels.cache.get(canalId);
      if (canal) {
        canalesAnuncios.push(canal);
      } else {
        console.log(`❌ Canal de anuncios no encontrado: ${canalId}`);
      }
    }
    
    if (canalesAnuncios.length === 0) {
      console.log("❌ No se encontraron canales de anuncios válidos");
      return;
    }
    
    let nuevasNovelas = 0;
    
    for (const novela of novelas) {
      try {
        console.log(`🔍 Verificando novela: ${novela.titulo} (ID: ${novela.id})`);
        console.log(`   - Ya anunciada: ${novelasAnunciadas.has(novela.id)}`);
        
        if (!novelasAnunciadas.has(novela.id)) {
          console.log(`✅ Anunciando novela nueva: ${novela.titulo}`);
          
          // Crear un embed más atractivo y completo
          const embed = new EmbedBuilder()
            .setTitle(`📖 ${novela.titulo}`)
            .setDescription(novela.desc || "Sin descripción disponible")
            .setColor("#ff6b6b")
            .setTimestamp();
          
          // Agregar imagen de portada grande si existe
          if (novela.portada) {
            embed.setImage(novela.portada); // Usar setImage para imagen grande
            console.log(`   📸 Imagen grande agregada: ${novela.portada}`);
          }
          
          // Agregar campos con información importante
          const fields = [];
          
          // Peso (siempre visible)
          if (novela.peso) {
            fields.push({ name: "💾 Peso", value: novela.peso, inline: true });
            console.log(`   💾 Peso agregado: ${novela.peso}`);
          }
          
          // Estado (siempre visible)
          if (novela.estado) {
            fields.push({ name: "📊 Estado", value: novela.estado, inline: true });
            console.log(`   📊 Estado agregado: ${novela.estado}`);
          }
          
          // Géneros (si existe)
          if (novela.generos && novela.generos.length > 0) {
            fields.push({ name: "🎭 Géneros", value: novela.generos.slice(0, 3).join(", "), inline: true });
            console.log(`   🎭 Géneros agregados: ${novela.generos.slice(0, 3).join(", ")}`);
          }
          
          // Enlace público de Eroverse
          const enlaceEroverse = `https://mundoeroverse.onrender.com/novela.html?id=${novela.id}`;
          embed.setURL(enlaceEroverse);
          fields.push({ name: "🔗 Enlace Público", value: `[Enlace de Descarga](${enlaceEroverse})`, inline: false });
          console.log(`   🔗 Enlace MundoEroverse agregado: ${enlaceEroverse}`);
          
          // Agregar todos los campos al embed
          if (fields.length > 0) {
            embed.addFields(fields);
          }
          
          // Anunciar en todos los canales configurados
          for (const canal of canalesAnuncios) {
            try {
              await canal.send({ embeds: [embed] });
              console.log(`✅ Novela "${novela.titulo}" anunciada en ${canal.name}`);
            } catch (canalError) {
              console.error(`❌ Error anunciando en canal ${canal.name}:`, canalError);
            }
          }
          
          // AGREGAR INMEDIATAMENTE AL SET Y GUARDAR EN GITHUB
          novelasAnunciadas.add(novela.id);
          nuevasNovelas++;
          
          // GUARDAR INMEDIATAMENTE EN GITHUB PARA EVITAR PÉRDIDA DE DATOS
          console.log(`💾 Guardando novela "${novela.id}" en GitHub inmediatamente...`);
          await guardarNovelasEnGitHub(novelasAnunciadas);
          console.log(`✅ Novela "${novela.id}" guardada exitosamente`);
          
          // Esperar un poco entre anuncios para evitar rate limits
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.log(`⏭️ Novela ya anunciada, saltando: ${novela.titulo}`);
        }
      } catch (novelaError) {
        console.error(`❌ Error procesando novela ${novela.id}:`, novelaError);
      }
    }
    
    if (nuevasNovelas > 0) {
      console.log(`✅ ${nuevasNovelas} nuevas novelas anunciadas y guardadas individualmente`);
    } else {
      console.log("ℹ️ No hay nuevas novelas para anunciar");
    }
    
  } catch (error) {
    console.error("❌ Error verificando novelas:", error);
  }
}

// Función para verificar videos de YouTube - CON RATE LIMITING
async function checkYouTube() {
  try {
    console.log("🎥 Verificando videos de YouTube...");
    console.log(`📊 Videos ya anunciados: ${videosAnunciados.size}`);
    
    // Verificar rate limiting
    if (!rateLimiter.canMakeRequest('youtube_api', 5, 60000)) {
      console.log("⚠️ Rate limit alcanzado para YouTube API, esperando...");
      return;
    }
    
    // Verificar que el canal de videos de YouTube exista
    const canalVideos = client.channels.cache.get(CANAL_VIDEOS_YOUTUBE);
    if (!canalVideos) {
      console.log(`❌ Canal de videos de YouTube no encontrado: ${CANAL_VIDEOS_YOUTUBE}`);
      return;
    }
    
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YOUTUBE_CHANNEL_ID}&order=date&maxResults=5&key=${YOUTUBE_API_KEY}`
    );
    
    if (!response.ok) {
      console.log(`❌ Error obteniendo videos de YouTube: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      console.log("ℹ️ No se encontraron nuevos videos de YouTube");
      return;
    }
    
    console.log(`📺 Total de videos obtenidos: ${data.items.length}`);
    let nuevosVideos = 0;
    
    for (const item of data.items) {
      try {
        const videoId = item.id.videoId;
        const videoTitle = item.snippet.title;
        const videoDescription = item.snippet.description;
        const publishedAt = item.snippet.publishedAt;
        
        console.log(`🔍 Verificando video: ${videoTitle} (ID: ${videoId})`);
        console.log(`   - Ya anunciado: ${videosAnunciados.has(videoId)}`);
        
        if (!videosAnunciados.has(videoId)) {
          console.log(`✅ Anunciando video nuevo: ${videoTitle}`);
          
          const embed = new EmbedBuilder()
            .setTitle(`🎥 ${videoTitle}`)
            .setDescription(videoDescription.substring(0, 200) + "...")
            .setURL(`https://www.youtube.com/watch?v=${videoId}`)
            .setThumbnail(item.snippet.thumbnails.medium.url)
            .setColor("#ff0000")
            .setTimestamp(new Date(publishedAt));
          
          // Anunciar en el canal específico de videos de YouTube
          try {
            await canalVideos.send({ embeds: [embed] });
            console.log(`✅ Video "${videoTitle}" anunciado en ${canalVideos.name}`);
            
            // Agregar a la lista de videos anunciados
            videosAnunciados.add(videoId);
            nuevosVideos++;
            
          } catch (canalError) {
            console.error(`❌ Error anunciando video en canal ${canalVideos.name}:`, canalError);
          }
          
          // Esperar un poco entre anuncios para evitar rate limits
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          console.log(`⏭️ Video ya anunciado, saltando: ${videoTitle}`);
        }
      } catch (videoError) {
        console.error("❌ Error procesando video:", videoError);
      }
    }
    
    if (nuevosVideos > 0) {
      console.log(`✅ ${nuevosVideos} nuevos videos anunciados`);
      await guardarVideosEnGitHub(videosAnunciados);
    } else {
      console.log("ℹ️ No hay nuevos videos para anunciar");
    }
    
    console.log("✅ Videos de YouTube verificados");
    
  } catch (error) {
    console.error("❌ Error verificando YouTube:", error);
  }
}

// Función para cargar sorteo activo desde GitHub
async function cargarSorteoActivo() {
  try {
    if (!isGitHubConfigured()) {
      console.log("⚠️ GitHub no configurado, usando archivo local");
      const SORTEO_PATH = path.join(__dirname, 'data', 'sorteo.json');
      if (fs.existsSync(SORTEO_PATH)) {
        const data = fs.readFileSync(SORTEO_PATH, 'utf8');
        const sorteo = JSON.parse(data);
        if (sorteo && sorteo.termina > Date.now()) {
          sorteoActual = {
            ...sorteo,
            participantes: new Set(sorteo.participantes || [])
          };
          console.log("✅ Sorteo activo cargado desde archivo local");
        }
      }
      return;
    }
    
    const sorteo = await getJsonFromGitHub('data/sorteo.json');
    if (sorteo && sorteo.termina > Date.now()) {
      sorteoActual = {
        ...sorteo,
        participantes: new Set(sorteo.participantes || [])
      };
      console.log("✅ Sorteo activo cargado desde GitHub");
      
      // Programar finalización si aún no ha terminado
      const tiempoRestante = sorteo.termina - Date.now();
      if (tiempoRestante > 0) {
        setTimeout(() => finalizarSorteo(), tiempoRestante);
      }
    } else {
      console.log("ℹ️ No hay sorteo activo");
    }
  } catch (error) {
    console.error("❌ Error cargando sorteo activo:", error);
  }
}

// Función para guardar sorteo en GitHub
async function guardarSorteoEnGitHub(sorteo, eliminar = false) {
  try {
    if (!isGitHubConfigured()) {
      console.log('⚠️ GitHub no configurado, guardando en archivo local');
      const SORTEO_PATH = path.join(__dirname, 'data', 'sorteo.json');
      const dir = path.dirname(SORTEO_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (eliminar) {
        if (fs.existsSync(SORTEO_PATH)) {
          fs.unlinkSync(SORTEO_PATH);
        }
      } else {
        fs.writeFileSync(SORTEO_PATH, JSON.stringify(sorteo, null, 2));
      }
      return { success: true, message: 'Guardado en archivo local' };
    }
    
    const octokit = new Octokit({
      auth: GITHUB_TOKEN,
    });
    
    if (eliminar) {
      try {
        const sha = await getFileSha('data/sorteo.json');
        await octokit.rest.repos.deleteFile({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          path: 'data/sorteo.json',
          message: 'Eliminación automática de sorteo finalizado',
          sha: sha,
          branch: GITHUB_BRANCH,
        });
      } catch (error) {
        console.log("ℹ️ Archivo de sorteo no existe o ya fue eliminado");
      }
    } else {
      const content = JSON.stringify(sorteo, null, 2);
      const sha = await getFileSha('data/sorteo.json');
      
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: 'data/sorteo.json',
        message: 'Actualización automática de sorteo',
        content: Buffer.from(content).toString('base64'),
        sha: sha,
        branch: GITHUB_BRANCH,
      });
    }
    
    console.log('✅ Sorteo guardado en GitHub');
    return { success: true, message: 'Guardado en GitHub' };
  } catch (error) {
    console.error('❌ Error guardando sorteo en GitHub:', error);
    // Fallback a archivo local
    try {
      const SORTEO_PATH = path.join(__dirname, 'data', 'sorteo.json');
      const dir = path.dirname(SORTEO_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (eliminar) {
        if (fs.existsSync(SORTEO_PATH)) {
          fs.unlinkSync(SORTEO_PATH);
        }
      } else {
        fs.writeFileSync(SORTEO_PATH, JSON.stringify(sorteo, null, 2));
      }
      console.log('✅ Sorteo guardado en archivo local como fallback');
      return { success: true, message: 'Guardado en archivo local como fallback' };
    } catch (localError) {
      console.error('❌ Error guardando en archivo local:', localError);
      return { success: false, error: 'Error guardando datos' };
    }
  }
}

// Función para finalizar sorteo
async function finalizarSorteo() {
  if (!sorteoActual) return;
  
  console.log(`🎉 Finalizando sorteo ${sorteoActual.tipo}`);
  
  const participantes = Array.from(sorteoActual.participantes);
  const ganadores = [];
  
  // Seleccionar ganadores aleatoriamente
  for (let i = 0; i < sorteoActual.ganadores && participantes.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * participantes.length);
    ganadores.push(participantes.splice(randomIndex, 1)[0]);
  }
  
  const canal = client.channels.cache.get(sorteoActual.canalParticipacion);
  if (canal) {
    const embed = new EmbedBuilder()
      .setTitle(`🎉 SORTEO ${sorteoActual.tipo} FINALIZADO`)
      .setDescription(`**¡El sorteo ha terminado!**\n\n🎁 **Premio:** ${sorteoActual.premio}\n👥 **Participantes:** ${sorteoActual.participantes.size}\n👑 **Ganadores:** ${ganadores.map(id => `<@${id}>`).join(', ') || 'Ninguno'}`)
      .setColor("#00ff00")
      .setTimestamp();
    
    await canal.send({ embeds: [embed] });
  }
  
  // Limpiar sorteo
  sorteoActual = null;
  await guardarSorteoEnGitHub({}, true);
  
  console.log("✅ Sorteo finalizado");
}

// Función para revisar y cancelar VIPs expirados - MEJORADA
async function revisarYCancelarVipExpirado() {
  try {
    console.log("🔍 Verificando VIPs expirados...");
    
    const usuarios = await getJsonFromGitHub('data/usuario.json');
    if (!Array.isArray(usuarios)) {
      console.log("❌ No se pudieron cargar los usuarios");
      return;
    }
    
    let usuariosActualizados = false;
    let rolesActualizados = 0;
    
    // Obtener el servidor y roles
    const guild = client.guilds.cache.first();
    if (!guild) {
      console.log("❌ No se encontró el servidor");
      return;
    }
    
    for (const usuario of usuarios) {
      if (usuario.premium && usuario.premium_expira) {
        const fechaExpiracion = new Date(usuario.premium_expira);
        const ahora = new Date();
        
        if (fechaExpiracion < ahora) {
          console.log(`❌ VIP expirado para ${usuario.usuario}`);
          usuario.premium = false;
          usuario.premium_expira = null;
          usuariosActualizados = true;
          
          // Buscar y remover rol VIP en Discord si existe
          try {
            const discordUser = await guild.members.fetch(usuario.discord_id || usuario.id);
            if (discordUser) {
              // Buscar roles VIP (puedes ajustar los IDs según tu servidor)
              const vipRoles = guild.roles.cache.filter(role => 
                role.name.toLowerCase().includes('vip') || 
                role.name.toLowerCase().includes('premium')
              );
              
              for (const [roleId, role] of vipRoles) {
                if (discordUser.roles.cache.has(roleId)) {
                  await discordUser.roles.remove(role);
                  console.log(`🔴 Rol VIP removido de ${usuario.usuario}: ${role.name}`);
                  rolesActualizados++;
                }
              }
            }
          } catch (discordError) {
            console.log(`⚠️ No se pudo actualizar roles de Discord para ${usuario.usuario}:`, discordError.message);
          }
        }
      }
    }
    
    if (usuariosActualizados) {
      await updateFileOnGitHub('data/usuario.json', usuarios);
      console.log(`✅ VIPs expirados cancelados: ${usuarios.filter(u => !u.premium).length} usuarios`);
      if (rolesActualizados > 0) {
        console.log(`🔴 Roles VIP removidos en Discord: ${rolesActualizados}`);
      }
    } else {
      console.log("ℹ️ No hay VIPs expirados");
    }
    
  } catch (error) {
    console.error("❌ Error verificando VIPs expirados:", error);
  }
}

// Función para limpiar tickets huérfanos - MEJORADA
async function limpiarTicketsHuerfanos() {
  try {
    console.log("🧹 Limpiando tickets huérfanos...");
    
    const guild = client.guilds.cache.first();
    if (!guild) {
      console.log("❌ No se encontró el servidor");
      return;
    }
    
    const categoria = guild.channels.cache.get(CATEGORIA_TICKETS_ID);
    if (!categoria) {
      console.log("❌ Categoría de tickets no encontrada");
      return;
    }
    
    const tickets = categoria.children.cache.filter(channel => 
      channel.name.startsWith('ticket-') && 
      channel.type === ChannelType.GuildText
    );
    
    if (tickets.size === 0) {
      console.log("ℹ️ No se encontraron tickets para limpiar");
      return;
    }
    
    let ticketsEliminados = 0;
    let ticketsRevisados = 0;
    
    for (const [id, canal] of tickets) {
      try {
        ticketsRevisados++;
        
        // Verificar si el canal está vacío o muy antiguo (más de 12 horas sin actividad) - REDUCIDO
        const mensajes = await canal.messages.fetch({ limit: 1 });
        const ultimoMensaje = mensajes.first();
        
        if (!ultimoMensaje || 
            (Date.now() - ultimoMensaje.createdTimestamp) > 12 * 60 * 60 * 1000) {
          await canal.delete();
          ticketsEliminados++;
          console.log(`🗑️ Ticket huérfano eliminado: ${canal.name}`);
        }
      } catch (error) {
        console.error(`❌ Error procesando ticket ${canal.name}:`, error);
      }
    }
    
    if (ticketsEliminados > 0) {
      console.log(`✅ ${ticketsEliminados} tickets huérfanos eliminados de ${ticketsRevisados} revisados`);
    } else {
      console.log(`ℹ️ No se encontraron tickets huérfanos (${ticketsRevisados} revisados)`);
    }
  } catch (error) {
    console.error("❌ Error limpiando tickets huérfanos:", error);
  }
}

// Función para verificar si GitHub está configurado
function isGitHubConfigured() {
  return GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO;
}

// Función para obtener JSON desde GitHub
async function getJsonFromGitHub(githubPath) {
  try {
    if (!isGitHubConfigured()) {
      console.log('⚠️ GitHub no configurado, usando archivo local');
      const localPath = path.join(__dirname, githubPath);
      if (fs.existsSync(localPath)) {
        const data = fs.readFileSync(localPath, 'utf8');
        return JSON.parse(data);
      }
      return null;
    }
    
    const octokit = new Octokit({
      auth: GITHUB_TOKEN,
    });
    
    const response = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: githubPath,
      ref: GITHUB_BRANCH,
    });
    
    if (response.data.type === 'file') {
      const content = Buffer.from(response.data.content, 'base64').toString('utf8');
      return JSON.parse(content);
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Error obteniendo ${githubPath} desde GitHub:`, error);
    // Fallback a archivo local
    try {
      const localPath = path.join(__dirname, githubPath);
      if (fs.existsSync(localPath)) {
        const data = fs.readFileSync(localPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (localError) {
      console.error(`❌ Error leyendo archivo local ${githubPath}:`, localError);
    }
    return null;
  }
}

// Función para obtener SHA de un archivo en GitHub
async function getFileSha(githubPath) {
  try {
    if (!isGitHubConfigured()) {
      console.log('⚠️ GitHub no configurado, usando SHA dummy');
      return 'dummy-sha';
    }
    
    const octokit = new Octokit({
      auth: GITHUB_TOKEN,
    });
    
    const response = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: githubPath,
      ref: GITHUB_BRANCH,
    });
    
    return response.data.sha;
  } catch (error) {
    console.error(`❌ Error obteniendo SHA de ${githubPath}:`, error);
    return 'dummy-sha';
  }
}

// Función para actualizar un archivo en GitHub
async function updateFileOnGitHub(githubPath, data) {
  try {
    // Si es novelasAnunciadas, usar el repo externo
    let owner = GITHUB_OWNER;
    let repo = GITHUB_REPO;
    let branch = GITHUB_BRANCH;
    let pathToUse = githubPath;
    if (githubPath === 'data/novelasAnunciadas.json' || githubPath === './data/novelasAnunciadas.json') {
      owner = ANUNCIADAS_GITHUB_OWNER;
      repo = ANUNCIADAS_GITHUB_REPO;
      branch = ANUNCIADAS_GITHUB_BRANCH;
      pathToUse = ANUNCIADAS_JSON_GITHUB_PATH;
    }
    if (!isGitHubConfigured()) {
      console.log('⚠️ GitHub no configurado, guardando en archivo local');
      const localPath = path.join(__dirname, pathToUse);
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(localPath, JSON.stringify(data, null, 2));
      return { success: true, message: 'Guardado en archivo local' };
    }

    const octokit = new Octokit({
      auth: GITHUB_TOKEN,
    });

    const content = JSON.stringify(data, null, 2);
    const sha = await getFileSha(pathToUse);

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: pathToUse,
      message: 'Actualización automática de datos',
      content: Buffer.from(content).toString('base64'),
      sha: sha,
      branch,
    });

    console.log(`✅ Archivo ${pathToUse} actualizado en GitHub`);
    return { success: true, message: 'Actualizado en GitHub' };
  } catch (error) {
    console.error(`❌ Error actualizando ${githubPath} en GitHub:`, error);
    // Fallback a archivo local
    try {
      const localPath = path.join(__dirname, githubPath);
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(localPath, JSON.stringify(data, null, 2));
      console.log(`✅ Archivo ${githubPath} guardado en archivo local como fallback`);
      return { success: true, message: 'Guardado en archivo local como fallback' };
    } catch (localError) {
      console.error(`❌ Error guardando en archivo local ${githubPath}:`, localError);
      return { success: false, error: 'Error guardando datos' };
    }
  }
}

// Sistema de logging mejorado - NUEVO
class Logger {
  static info(message, data = {}) {
    console.log(`ℹ️ ${message}`, data);
  }
  
  static success(message, data = {}) {
    console.log(`✅ ${message}`, data);
  }
  
  static warning(message, data = {}) {
    console.log(`⚠️ ${message}`, data);
  }
  
  static error(message, data = {}) {
    console.error(`❌ ${message}`, data);
  }
  
  static debug(message, data = {}) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 ${message}`, data);
    }
  }
}

// Función de limpieza al cerrar el bot - NUEVO
process.on('SIGINT', async () => {
  Logger.info('Cerrando bot de Discord...');
  
  try {
    // Limpiar sorteo activo si existe
    if (sorteoActual) {
      await guardarSorteoEnGitHub({}, true);
      Logger.success('Sorteo activo limpiado');
    }
    
    // Cerrar conexión del cliente
    await client.destroy();
    Logger.success('Bot cerrado correctamente');
    process.exit(0);
  } catch (error) {
    Logger.error('Error cerrando bot:', error);
    process.exit(1);
  }
});

// Iniciar el bot con manejo de errores mejorado
client.login(DISCORD_TOKEN).catch(error => {
  Logger.error('Error iniciando bot:', error);
  process.exit(1);
});

// Función para revisar roles de miembro faltantes - NUEVA
async function revisarRolesMiembroFaltantes() {
  try {
    console.log("👥 Verificando roles de miembro faltantes...");
    
    const guild = client.guilds.cache.first();
    if (!guild) {
      console.log("❌ No se encontró el servidor");
      return;
    }
    
    const memberRole = guild.roles.cache.get(DISCORD_ROLE_MIEMBRO);
    if (!memberRole) {
      console.log(`❌ Rol de miembro no encontrado: ${DISCORD_ROLE_MIEMBRO}`);
      return;
    }
    
    let rolesAsignados = 0;
    let errores = 0;
    
    // Revisar todos los miembros del servidor
    const miembros = await guild.members.fetch();
    
    for (const [memberId, member] of miembros) {
      try {
        // Verificar si el miembro no es un bot y no tiene el rol de miembro
        if (!member.user.bot && !member.roles.cache.has(DISCORD_ROLE_MIEMBRO)) {
          await member.roles.add(memberRole);
          console.log(`✅ Rol de miembro asignado a ${member.user.tag}`);
          rolesAsignados++;
          
          // Esperar un poco para evitar rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`❌ Error asignando rol a ${member.user.tag}:`, error.message);
        errores++;
      }
    }
    
    if (rolesAsignados > 0) {
      console.log(`✅ ${rolesAsignados} roles de miembro asignados`);
    } else {
      console.log("ℹ️ Todos los miembros ya tienen el rol de miembro");
    }
    
    if (errores > 0) {
      console.log(`⚠️ ${errores} errores al asignar roles`);
    }
    
  } catch (error) {
    console.error("❌ Error verificando roles de miembro:", error);
  }
}
