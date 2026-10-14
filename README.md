# Hábitos Saludables

App personal para Android (Samsung) con alimentación, ejercicio por fases, hábitos y seguimiento de la báscula Xiaomi.

## Qué incluye

- **Inicio**: peso del día con aviso de variación diaria, camino a la meta con hitos (skate 100 kg, fuera de obesidad, surf 90 kg, meta), composición corporal y resumen del día y de la semana.
- **Comida**: menú de 5 comidas (≈ 1.900 kcal y 160 g de proteína, ajustable), 41 recetas con cantidades, cambio de plato, comida libre semanal, lista de la compra y botón SOS antipicoteo.
- **Ejercicio**: 10 h semanales con intensidad progresiva, tabla de ejercicios con el material de casa, tests de forma y desbloqueos de skate y surf.
- **Hábitos**: estudio (10 h/semana con cronómetro), lectura (20 páginas/día), sueño, pausas activas, agua, pasos, picoteo, fruta y verdura, alcohol, pantallas y pesaje, con rachas.
- **Progreso**: gráficas de peso, grasa, músculo y grasa visceral, ficha de la báscula, logros e historial.
- **Datos de la báscula**: automáticos desde Health Connect (peso, grasa, metabolismo basal y pasos) y lectura de la captura de Zepp Life dentro del móvil (sin internet).
- **Asesor semanal**: informe con propuesta de ajuste de calorías; resumen para Claude y carga del menú que prepare.

## Instalar

Cada cambio en `main` compila la APK en GitHub Actions y la publica en **Releases**. Descarga `habitos-saludables.apk` desde el móvil e instálala. Las nuevas versiones se instalan encima sin perder datos.

## Datos

Todo se guarda en el móvil. Haz copias desde Ajustes → Tus datos. La clave de firma (`signing/`) está en el repositorio para poder compilar en GitHub; al ser una app de uso personal que se instala a mano, no tiene riesgo práctico.

## Estructura

- `www/`: la app (HTML, CSS y JavaScript sin dependencias).
- `tools/build_data.py`: genera `www/js/data.js` (alimentos, recetas con macros, ejercicios, hábitos).
- `tools/prepare-web.mjs`, `tools/patch-android.mjs`, `tools/ci-build.sh`: compilación de la APK con Capacitor 6.
- `buzon/Code.gs`: buzón opcional en Google Apps Script para el menú semanal de Claude.

Tipografías Lora e Inter con licencia SIL Open Font License.
