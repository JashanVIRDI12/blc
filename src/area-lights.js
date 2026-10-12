import * as THREE from 'three';

// The studios' softboxes and ceiling panels are area lights, and three.js
// shades every one of them for every pixel of a car: twice over, three times
// under lacquer. The collection stage has six, and they were two fifths of
// its frame. This is three's own arithmetic (linearly transformed cosines),
// put in a cheaper order. The picture is the same:
// - a light that is off is skipped. The stage's four bay lights are off while
//   the cars wait in the dark, and come up one by one;
// - what every light shares at a pixel (the two table lookups for the view
//   and roughness, and the frame they are measured in) is worked out once,
//   not once for each light and again for each of its lobes;
// - pure metal has no diffuse lobe to integrate.
// It replaces one function of one shader chunk, for every renderer on the
// page. Should a later three.js word that function differently, it is left
// alone.
const chunk = THREE.ShaderChunk.lights_physical_pars_fragment;
const start = chunk.indexOf('\tvoid RE_Direct_RectArea_Physical(');
const lacquer = chunk.indexOf('clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );', start);
const end = chunk.indexOf('\n\t}\n', lacquer);
const stock = start > 0 && lacquer > 0 && end > 0 ? chunk.slice(start, end + 3) : '';
const known = ['LTC_Evaluate( normal, viewDir, position, mInv, rectCoords )', 'LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords )', 'material.diffuseContribution', 'material.specularColorBlended', 'material.clearcoatF90'].every(part => stock.includes(part));

if (known && !chunk.includes('areaIntegral')) {
  THREE.ShaderChunk.lights_physical_pars_fragment = chunk.replace(stock, /* glsl */`
	mat3 areaSpecular; mat3 areaDiffuse; vec3 areaFresnel; bool areaReady = false;
	#ifdef USE_CLEARCOAT
		mat3 areaClearcoat; vec3 areaClearcoatFresnel;
	#endif

	// The frame about N in which the tables are measured.
	mat3 areaFrame( const in vec3 N, const in vec3 V ) {
		vec3 T1 = normalize( V - N * dot( V, N ) );
		vec3 T2 = - cross( N, T1 );
		return transpose( mat3( T1, T2, N ) );
	}

	mat3 areaLobe( const in vec4 t1 ) {
		return mat3( vec3( t1.x, 0, t1.y ), vec3( 0, 1, 0 ), vec3( t1.z, 0, t1.w ) );
	}

	// The light's four corners, from the shaded point, integrated over one lobe.
	float areaIntegral( const in mat3 lobe, const in vec3 corners[ 4 ] ) {
		vec3 c0 = normalize( lobe * corners[ 0 ] );
		vec3 c1 = normalize( lobe * corners[ 1 ] );
		vec3 c2 = normalize( lobe * corners[ 2 ] );
		vec3 c3 = normalize( lobe * corners[ 3 ] );
		vec3 vectorFormFactor = LTC_EdgeVectorFormFactor( c0, c1 ) + LTC_EdgeVectorFormFactor( c1, c2 ) + LTC_EdgeVectorFormFactor( c2, c3 ) + LTC_EdgeVectorFormFactor( c3, c0 );
		return LTC_ClippedSphereFormFactor( vectorFormFactor );
	}

	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {

		vec3 lightColor = rectAreaLight.color;
		if ( lightColor.r + lightColor.g + lightColor.b <= 0.0 ) return;

		vec3 centre = rectAreaLight.position - geometryPosition;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 corners[ 4 ];
		corners[ 0 ] = centre + halfWidth - halfHeight; // counterclockwise; light shines in local neg z direction
		corners[ 1 ] = centre - halfWidth - halfHeight;
		corners[ 2 ] = centre - halfWidth + halfHeight;
		corners[ 3 ] = centre + halfWidth + halfHeight;

		// Nothing from behind the light's plane.
		if ( dot( cross( corners[ 1 ] - corners[ 0 ], corners[ 3 ] - corners[ 0 ] ), corners[ 0 ] ) > 0.0 ) return;

		if ( ! areaReady ) {

			areaReady = true;
			mat3 frame = areaFrame( geometryNormal, geometryViewDir );
			vec2 uv = LTC_Uv( geometryNormal, geometryViewDir, material.roughness );
			vec4 t2 = textureLod( ltc_2, uv, 0.0 );
			areaSpecular = areaLobe( textureLod( ltc_1, uv, 0.0 ) ) * frame;
			areaDiffuse = frame;
			// LTC Fresnel Approximation by Stephen Hill
			// http://blog.selfshadow.com/publications/s2016-advances/s2016_ltc_fresnel.pdf
			areaFresnel = material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y;

			#ifdef USE_CLEARCOAT

				vec2 uvClearcoat = LTC_Uv( geometryClearcoatNormal, geometryViewDir, material.clearcoatRoughness );
				vec4 t2Clearcoat = textureLod( ltc_2, uvClearcoat, 0.0 );
				areaClearcoat = areaLobe( textureLod( ltc_1, uvClearcoat, 0.0 ) ) * areaFrame( geometryClearcoatNormal, geometryViewDir );
				areaClearcoatFresnel = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;

			#endif

		}

		reflectedLight.directSpecular += lightColor * areaFresnel * areaIntegral( areaSpecular, corners );

		vec3 diffuse = material.diffuseContribution;
		if ( diffuse.r + diffuse.g + diffuse.b > 0.0 ) reflectedLight.directDiffuse += lightColor * diffuse * areaIntegral( areaDiffuse, corners );

		#ifdef USE_CLEARCOAT

			clearcoatSpecularDirect += lightColor * areaClearcoatFresnel * areaIntegral( areaClearcoat, corners );

		#endif

	}`);
  // three.js writes the loop over the lights out in full, once for each
  // light: six copies of the arithmetic above, three lobes apiece, in every
  // material's shader. Left as a loop, the shader is a fraction of the size
  // and the GPU's compiler is through it sooner, which is what a first visit
  // waits on.
  THREE.ShaderChunk.lights_fragment_begin = THREE.ShaderChunk.lights_fragment_begin.replace(/#pragma unroll_loop_start\s+(for \( int i = 0; i < NUM_RECT_AREA_LIGHTS; i \+\+ \) \{[^}]+\})\s+#pragma unroll_loop_end/, '$1');
} else if (import.meta.env.DEV && !chunk.includes('areaIntegral')) console.warn('three.js has reworded its area lights: src/area-lights.js left them as they are.');
