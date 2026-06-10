# Usar la imagen oficial de Playwright con Node.js y navegadores preinstalados
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# Directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias e instalar todas (incluyendo devDependencies para Playwright)
COPY package*.json ./
RUN npm install

# Copiar el resto del código de la aplicación
COPY . .

# Exponer el puerto que Railway asigna automáticamente (usando 3000 como fallback)
EXPOSE 3000

# Arrancar la aplicación
CMD ["npm", "start"]
