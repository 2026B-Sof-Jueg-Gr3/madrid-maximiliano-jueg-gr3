# NEON//ARENA

Arena shooter 2D hecho con HTML5 Canvas y JavaScript, sin imágenes ni recursos externos.

## Archivos

- `index.html`: estructura de la página y elementos de interfaz.
- `styles.css`: estilos del menú, HUD y diseño adaptable.
- `game.js`: toda la lógica del juego, controles, entidades, efectos y dibujo en canvas.

Dentro de `game.js`, el código está organizado por bloques: estado y configuración, audio, interfaz, controles, creación de entidades, actualización de la partida, dibujo y bucle principal. La actualización separa jugador, oleadas, enemigos, proyectiles, mejoras y partículas para que cada mecánica se pueda localizar y modificar con facilidad.

## Cómo jugar

Abre `index.html` en un navegador moderno.

- **WASD** o flechas: mover
- **Ratón**: apuntar
- **Clic izquierdo** o **espacio**: disparar
- **Shift**: esquiva con invulnerabilidad breve, recarga de 2,4 segundos
- **Esc** o **P**: pausar (también se pausa al salir de la ventana)

El menú permite ajustar dificultad, sonido, partículas y sacudida de cámara. El récord se guarda en el navegador.


## Edición 02

- Oleadas finitas con tres segundos de descanso y bonificación al limpiar el sector.
- Jefe Centinela cada cinco oleadas: disparo radial que se intensifica al perder la mitad de su vida. Completar esa oleada recupera una vida, hasta un máximo de tres.
- Rachas: elimina enemigos con menos de tres segundos entre bajas. Cada cinco bajas aumenta el multiplicador hasta ×5. Recibir un impacto rompe la racha.
- Cinco enemigos base con siluetas diferentes; los guardianes protegen a enemigos cercanos. El Centinela no recibe esa protección.
- Esquiva direccional, ondas de explosión, números de puntuación y destello de impacto.
- Indicadores de hostiles pendientes, recarga de esquiva, combo y vida del jefe.
- Resumen con tiempo de supervivencia, eliminaciones y mejor racha.
- Menú con enemigos animados en pantallas amplias. Opciones persistentes en el navegador; el juego funciona aunque el almacenamiento esté bloqueado.

## Estructura y decisiones

Toda la lógica permanece en `game.js`. Sus funciones separan entradas, creación de entidades, actualización, colisiones y dibujo. La colisión de proyectiles usa el segmento recorrido entre fotogramas. Las partículas se limitan a 650; se limita también el presupuesto de enemigos por oleada.

Requiere teclado y ratón; el diseño de menús se adapta a pantallas estrechas, pero no incluye controles táctiles. No necesita instalación, dependencias ni imágenes externas. Para una vista local también se puede ejecutar `python -m http.server 8765` y abrir `http://localhost:8765`.

GitHub Pages sirve los archivos de la raíz de `main`. Los cambios locales aparecen en el sitio público después de subirlos a esa rama y completar el despliegue.
