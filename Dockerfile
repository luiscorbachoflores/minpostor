# Dockerfile para Raspberry Pi / ARM
# Imagen base multiarch compatible con Node.js
FROM node:18-bullseye-slim AS build
# Si construyes en Raspberry Pi puedes quitar --platform o usar linux/arm/v7

WORKDIR /app

# Copiamos package.json para instalar deps
COPY package.json package-lock.json* ./
RUN npm install --production

# Copiamos el código
COPY . .

# Cambiamos a runtime image (misma imagen para simplicidad)
CMD ["node", "bot.js"]
