import { ShaderChunk } from 'three';

const MARK = '// gaussian-pcf';

/** Tiefenbereich der Sonnen-Schattenkarte in Metern (Abstand nah–fern der Schattenkamera, siehe `Sky`). */
export const SUN_SHADOW_DEPTH = 380;
/** Schattenwerfer bis zu dieser Höhe über der Fläche werfen einen scharfen Kontaktschatten (Meter). */
const CONTACT_HEIGHT = 1.0;
/** Kennung im Radius: ab diesem Wert gilt „weich mit Kontaktschatten“ (nur für die Sonne). */
const CONTACT_FLAG = 100;

/**
 * Schattenkante als Gaußscher Weichzeichner. Three.js filtert Schatten mit fünf zufällig gedrehten Abtastpunkten,
 * das ergibt eine körnige Kante. Hier wird die Abtastung durch einen festen Gauß-Kern ersetzt: jede Abtastung ist
 * bereits ein gefilterter 2×2-Vergleich der Grafikkarte, die Gewichte folgen der Glockenkurve.
 *
 * `shadow.radius` ist die Standardabweichung in Texeln der Schattenkarte:
 * - bis 1,5: 3×3 Abtastungen mit Binomialgewichten (entspricht einem 5×5-Gauß)
 * - darüber: 5×5 Abtastungen bis zur doppelten Standardabweichung
 *
 * Für die Sonne (`sunShadowRadius`) kommt ein Kontaktschatten dazu: weichgezeichnet wird nur der Schatten hoher
 * Objekte (Bäume, Felsen, Gebäude). Was dicht über dem Boden steht (Gras, Blumen, Füße), behält eine scharfe Kante,
 * wie in der Natur: je näher der Schattenwerfer an der Fläche, desto schmaler der Halbschatten. Ohne diese Trennung
 * würde der Weichzeichner die dünnen Schatten der Grashalme auflösen.
 */
const HELPERS = /* glsl */ `${MARK}
		float gaussShadow( sampler2DShadow shadowMap, vec2 uv, float z, vec2 texelSize, float sigma ) {

			float gSum = 0.0;

			if ( sigma <= 1.5 ) {

				vec2 gStep = texelSize * ( 1.2 * sigma );
				for ( int gj = -1; gj <= 1; gj ++ ) {
					for ( int gi = -1; gi <= 1; gi ++ ) {
						float gw = ( gi == 0 ? 0.375 : 0.3125 ) * ( gj == 0 ? 0.375 : 0.3125 );
						gSum += gw * texture( shadowMap, vec3( uv + vec2( float( gi ), float( gj ) ) * gStep, z ) );
					}
				}

			} else {

				vec2 gStep = texelSize * sigma;
				for ( int gj = -2; gj <= 2; gj ++ ) {
					float gwj = gj == 0 ? 0.40264 : ( gj == 1 || gj == -1 ? 0.24421 : 0.05448 );
					for ( int gi = -2; gi <= 2; gi ++ ) {
						float gwi = gi == 0 ? 0.40264 : ( gi == 1 || gi == -1 ? 0.24421 : 0.05448 );
						gSum += gwi * gwj * texture( shadowMap, vec3( uv + vec2( float( gi ), float( gj ) ) * gStep, z ) );
					}
				}

			}

			return gSum;

		}

		// kleine, scharfe Abtastung (vier Punkte um die Mitte)
		float tightShadow( sampler2DShadow shadowMap, vec2 uv, float z, vec2 texelSize ) {

			vec2 o = texelSize * 0.5;
			return 0.25 * (
				texture( shadowMap, vec3( uv + vec2( - o.x, - o.y ), z ) ) +
				texture( shadowMap, vec3( uv + vec2( o.x, - o.y ), z ) ) +
				texture( shadowMap, vec3( uv + vec2( - o.x, o.y ), z ) ) +
				texture( shadowMap, vec3( uv + vec2( o.x, o.y ), z ) )
			);

		}

		`;

const SAMPLE = /* glsl */ `if ( shadowRadius >= ${(CONTACT_FLAG / 2).toFixed(1)} ) {

					// Bezugstiefe um die Kontakthöhe zum Licht verschoben: Schattenwerfer dicht über der Fläche zählen nicht
					float zHigh = shadowCoord.z - ${(CONTACT_HEIGHT / SUN_SHADOW_DEPTH).toPrecision(6)};
					float highSoft = gaussShadow( shadowMap, shadowCoord.xy, zHigh, texelSize, shadowRadius - ${CONTACT_FLAG.toFixed(1)} );
					// Anteil, den nur die niedrigen Schattenwerfer verdecken: bleibt scharf
					float lowOnly = max( 0.0, tightShadow( shadowMap, shadowCoord.xy, zHigh, texelSize ) - tightShadow( shadowMap, shadowCoord.xy, shadowCoord.z, texelSize ) );
					shadow = highSoft * ( 1.0 - lowOnly );

				} else {

					shadow = gaussShadow( shadowMap, shadowCoord.xy, shadowCoord.z, texelSize, shadowRadius );

				}`;

/**
 * Ersetzt die Schattenfilterung von Three.js (einmalig, vor dem ersten Shader). Liefert `false`, wenn die Stelle im
 * Shader nicht gefunden wurde (z. B. nach einem Three.js-Update); dann bleibt die Standardfilterung aktiv.
 */
export function installGaussianShadows(): boolean {
  const src = ShaderChunk.shadowmap_pars_fragment;
  if (src.includes(MARK)) return true;
  const start = src.indexOf('float getShadow( sampler2DShadow');
  const from = start < 0 ? -1 : src.indexOf('shadow = (', start);
  const end = ') * 0.2;';
  const to = from < 0 ? -1 : src.indexOf(end, from);
  if (to < 0) return false;
  ShaderChunk.shadowmap_pars_fragment = src.slice(0, start) + HELPERS + src.slice(start, from) + SAMPLE + src.slice(to + end.length);
  return true;
}

/** Standardabweichung des Weichzeichners in Texeln für eine gewünschte Weichheit in Metern. */
export function shadowBlurRadius(softnessM: number, extentM: number, mapSize: number): number {
  if (mapSize <= 0) return 1;
  const texel = (2 * extentM) / mapSize;
  return Math.min(2, Math.max(0.8, softnessM / texel));
}

/** Wert für `shadow.radius` der Sonne: Weichzeichner wie `shadowBlurRadius`, dazu scharfe Kontaktschatten. */
export function sunShadowRadius(softnessM: number, extentM: number, mapSize: number): number {
  return CONTACT_FLAG + shadowBlurRadius(softnessM, extentM, mapSize);
}
