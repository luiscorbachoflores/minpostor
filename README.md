# Impostor Bot (Minecraft) - Docker para Raspberry Pi

Bot minimalista que se conecta a tu servidor Minecraft y organiza rondas del juego "Impostor":
- Envía a cada jugador una palabra privada (todos reciben la misma palabra).
- Selecciona un impostor aleatorio que recibe "ERES EL IMPOSTOR".
- Admin controla rondas desde el chat con comandos: `!startimpostor` y `!fin`.

## Estructura
- `bot.js` - código del bot (Node.js + mineflayer)
- `package.json`
- `Dockerfile`
- `docker-compose.yml`
- `data/dictionary.txt` - diccionario de ejemplo (una palabra por línea)
- `.env` - donde se encuentran todas las variables de entorno 

## Variables de entorno (configurables)
- `SERVER_HOST` - host del servidor (IP o dominio)
- `SERVER_PORT` - puerto (por defecto 25565)
- `USER_BOT` - nombre de la cuenta del bot
- `USER_ADMIN` - lista separada por comas de usuarios autorizados a lanzar comandos (si está vacío, cualquiera puede usarlos)

## Comandos desde el chat de Minecraft
- `!startimpostor` - iniciar ronda (bot elegirá palabra/impostor)
- `!fin` o `!endimpostor` - termina la ronda y anuncia quién era el impostor
- `!status` - muestra estado actual
- `!reloadwords` - recarga el `dictionary.txt` (desde el contenedor/volumen)

## Cómo desplegar (Raspberry Pi)
1. Clona/copia este repo en tu Raspberry Pi.
2. Crea carpeta `data/` y coloca tu `dictionary.txt` allí.
3. Edita `docker-compose.yml` y ajusta variables de entorno (o usa un `.env`).
4. Construye y levanta:
