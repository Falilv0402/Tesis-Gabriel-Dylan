/**
 * Donut «Distribución de riesgo»: las etiquetas («Alto 52%», «Medio 6%») salían cortadas por el borde del gráfico
 * (arriba, a la izquierda o a la derecha según dónde cayera cada porción). Se fija la regla de fondo: sea cual sea el
 * ancho de la tarjeta, la etiqueta de cualquier porción cabe dentro del gráfico.
 */
import { posicionEtiqueta, radioParaAncho } from "@/components/charts/DonutRiesgo";

const ANCHO_TEXTO = 56;   // «Medio 45%» a 12 px
const ALTO_GRAFICO = 230;

describe("Donut de riesgo: tamaño del aro", () => {
  test("en una tarjeta ancha (o aún sin medir) usa el tamaño máximo", () => {
    expect(radioParaAncho(null)).toBe(76);
    expect(radioParaAncho(460)).toBe(76);
  });

  test("en una tarjeta de 3 columnas el aro se achica para dejar sitio a las etiquetas", () => {
    const r = radioParaAncho(254);
    expect(r).toBeLessThan(76);
    expect(r).toBeGreaterThanOrEqual(36);
  });

  test("nunca baja del mínimo y crece con el ancho", () => {
    expect(radioParaAncho(120)).toBe(36);
    const radios = [150, 200, 250, 300, 350, 400].map(radioParaAncho);
    expect([...radios].sort((a, b) => a - b)).toEqual(radios);
  });
});

describe("Donut de riesgo: posición de las etiquetas", () => {
  const cx = 150, cy = ALTO_GRAFICO / 2, r = 76;

  test("arriba y abajo van centradas; a los lados, alineadas hacia afuera", () => {
    expect(posicionEtiqueta(cx, cy, 90, r).anchor).toBe("middle");    // arriba
    expect(posicionEtiqueta(cx, cy, 270, r).anchor).toBe("middle");   // abajo
    expect(posicionEtiqueta(cx, cy, 0, r).anchor).toBe("start");      // derecha: el texto crece a la derecha
    expect(posicionEtiqueta(cx, cy, 180, r).anchor).toBe("end");      // izquierda: el texto crece a la izquierda
  });

  test("la etiqueta de arriba queda sobre el aro y la de abajo bajo él", () => {
    expect(posicionEtiqueta(cx, cy, 90, r).y).toBeLessThan(cy - r);
    expect(posicionEtiqueta(cx, cy, 270, r).y).toBeGreaterThan(cy + r);
  });

  test("con cualquier ángulo y cualquier ancho de tarjeta la etiqueta cabe dentro del gráfico", () => {
    // 204 px es el ancho mínimo en que el aro llega a su tamaño mínimo (36) y todavía caben las etiquetas laterales.
    for (let ancho = 204; ancho <= 700; ancho += 8) {
      const radio = radioParaAncho(ancho);
      for (let angulo = 0; angulo < 360; angulo += 5) {
        const { x, y, anchor } = posicionEtiqueta(ancho / 2, ALTO_GRAFICO / 2, angulo, radio);
        const izquierda = anchor === "start" ? x : anchor === "end" ? x - ANCHO_TEXTO : x - ANCHO_TEXTO / 2;
        const derecha = anchor === "start" ? x + ANCHO_TEXTO : anchor === "end" ? x : x + ANCHO_TEXTO / 2;
        expect(izquierda).toBeGreaterThanOrEqual(0);
        expect(derecha).toBeLessThanOrEqual(ancho);
        expect(y - 7).toBeGreaterThanOrEqual(0);
        expect(y + 7).toBeLessThanOrEqual(ALTO_GRAFICO);
      }
    }
  });

  test("el tamaño de antes (radio 80, etiqueta 20 px más lejos, siempre hacia afuera) sí se salía del gráfico", () => {
    // Documenta el fallo original con una tarjeta de 3 columnas (~254 px de gráfico): el texto de la izquierda
    // terminaba en cx - 100 y medía ~56 px, es decir, empezaba a 143 - 100 - 56 = -13 px (cortado).
    const ancho = 254;
    const xAntes = ancho / 2 - (80 + 20);
    expect(xAntes - ANCHO_TEXTO).toBeLessThan(0);
  });
});
