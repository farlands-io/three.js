import { BackSide, DoubleSide, CubeUVReflectionMapping, ObjectSpaceNormalMap, TangentSpaceNormalMap, NoToneMapping, NormalBlending, LinearSRGBColorSpace, SRGBTransfer } from '../../constants.js';
import { Layers } from '../../core/Layers.js';
import { WebGLProgram } from './WebGLProgram.js';
import { WebGLShaderCache } from './WebGLShaderCache.js';
import { ShaderLib } from '../shaders/ShaderLib.js';
import { UniformsUtils } from '../shaders/UniformsUtils.js';
import { ColorManagement } from '../../math/ColorManagement.js';
import { warn } from '../../utils.js';

function WebGLPrograms( renderer, environments, extensions, capabilities, bindingStates, clipping ) {

	const _programLayers = new Layers();
	const _customShaders = new WebGLShaderCache();
	const _activeChannels = new Set();
	const _cacheKeyArray = [];
	const programs = [];
	const programsMap = new Map();

	const logarithmicDepthBuffer = capabilities.logarithmicDepthBuffer;

	let precision = capabilities.precision;

	const shaderIDs = {
		MeshDepthMaterial: 'depth',
		MeshDistanceMaterial: 'distance',
		MeshNormalMaterial: 'normal',
		MeshBasicMaterial: 'basic',
		MeshLambertMaterial: 'lambert',
		MeshPhongMaterial: 'phong',
		MeshToonMaterial: 'toon',
		MeshStandardMaterial: 'physical',
		MeshPhysicalMaterial: 'physical',
		MeshMatcapMaterial: 'matcap',
		LineBasicMaterial: 'basic',
		LineDashedMaterial: 'dashed',
		PointsMaterial: 'points',
		ShadowMaterial: 'shadow',
		SpriteMaterial: 'sprite'
	};

	function getChannel( value ) {

		_activeChannels.add( value );

		if ( value === 0 ) return 'uv';

		return `uv${ value }`;

	}

	const _parameters = {
		shaderID: null,
		shaderType: null,
		shaderName: null,
		vertexShader: null,
		fragmentShader: null,
		defines: null,
		customVertexShaderID: null,
		customFragmentShaderID: null,
		isRawShaderMaterial: false,
		glslVersion: null,
		precision: null,
		batching: false,
		batchingColor: false,
		instancing: false,
		instancingColor: false,
		instancingMorph: false,
		outputColorSpace: null,
		alphaToCoverage: false,
		map: false,
		matcap: false,
		envMap: false,
		envMapMode: false,
		envMapCubeUVHeight: null,
		aoMap: false,
		lightMap: false,
		bumpMap: false,
		normalMap: false,
		displacementMap: false,
		emissiveMap: false,
		normalMapObjectSpace: false,
		normalMapTangentSpace: false,
		metalnessMap: false,
		roughnessMap: false,
		anisotropy: false,
		anisotropyMap: false,
		clearcoat: false,
		clearcoatMap: false,
		clearcoatNormalMap: false,
		clearcoatRoughnessMap: false,
		dispersion: false,
		iridescence: false,
		iridescenceMap: false,
		iridescenceThicknessMap: false,
		sheen: false,
		sheenColorMap: false,
		sheenRoughnessMap: false,
		specularMap: false,
		specularColorMap: false,
		specularIntensityMap: false,
		transmission: false,
		transmissionMap: false,
		thicknessMap: false,
		gradientMap: false,
		opaque: false,
		alphaMap: false,
		alphaTest: false,
		alphaHash: false,
		combine: null,
		mapUv: false,
		aoMapUv: false,
		lightMapUv: false,
		bumpMapUv: false,
		normalMapUv: false,
		displacementMapUv: false,
		emissiveMapUv: false,
		metalnessMapUv: false,
		roughnessMapUv: false,
		anisotropyMapUv: false,
		clearcoatMapUv: false,
		clearcoatNormalMapUv: false,
		clearcoatRoughnessMapUv: false,
		iridescenceMapUv: false,
		iridescenceThicknessMapUv: false,
		sheenColorMapUv: false,
		sheenRoughnessMapUv: false,
		specularMapUv: false,
		specularColorMapUv: false,
		specularIntensityMapUv: false,
		transmissionMapUv: false,
		thicknessMapUv: false,
		alphaMapUv: false,
		vertexTangents: false,
		vertexColors: false,
		vertexAlphas: false,
		pointsUvs: false,
		fog: false,
		useFog: false,
		fogExp2: false,
		flatShading: false,
		sizeAttenuation: false,
		logarithmicDepthBuffer: false,
		reversedDepthBuffer: false,
		skinning: false,
		morphTargets: false,
		morphNormals: false,
		morphColors: false,
		morphTargetsCount: 0,
		morphTextureStride: 0,
		numDirLights: 0,
		numPointLights: 0,
		numSpotLights: 0,
		numSpotLightMaps: 0,
		numRectAreaLights: 0,
		numHemiLights: 0,
		numDirLightShadows: 0,
		numPointLightShadows: 0,
		numSpotLightShadows: 0,
		numSpotLightShadowsWithMaps: 0,
		numLightProbes: 0,
		numClippingPlanes: 0,
		numClipIntersection: 0,
		dithering: false,
		shadowMapEnabled: false,
		shadowMapType: 0,
		toneMapping: 0,
		decodeVideoTexture: false,
		decodeVideoTextureEmissive: false,
		premultipliedAlpha: false,
		doubleSided: false,
		flipSided: false,
		useDepthPacking: false,
		depthPacking: 0,
		index0AttributeName: null,
		extensionClipCullDistance: false,
		extensionMultiDraw: false,
		rendererExtensionParallelShaderCompile: false,
		customProgramCacheKey: null,
		vertexUv1s: false,
		vertexUv2s: false,
		vertexUv3s: false,
		uniforms: null,
	};

	function getParameters( material, lights, shadows, scene, object ) {

		const fog = scene.fog;
		const geometry = object.geometry;
		const environment = ( material.isMeshStandardMaterial || material.isMeshLambertMaterial || material.isMeshPhongMaterial ) ? scene.environment : null;

		const usePMREM = material.isMeshStandardMaterial || ( material.isMeshLambertMaterial && ! material.envMap ) || ( material.isMeshPhongMaterial && ! material.envMap );
		const envMap = environments.get( material.envMap || environment, usePMREM );
		const envMapCubeUVHeight = ( !! envMap ) && ( envMap.mapping === CubeUVReflectionMapping ) ? envMap.image.height : null;

		const shaderID = shaderIDs[ material.type ];

		// heuristics to create shader parameters according to lights in the scene
		// (not to blow over maxLights budget)

		if ( material.precision !== null ) {

			precision = capabilities.getMaxPrecision( material.precision );

			if ( precision !== material.precision ) {

				warn( 'WebGLProgram.getParameters:', material.precision, 'not supported, using', precision, 'instead.' );

			}

		}

		//

		const morphAttribute = geometry.morphAttributes.position || geometry.morphAttributes.normal || geometry.morphAttributes.color;
		const morphTargetsCount = ( morphAttribute !== undefined ) ? morphAttribute.length : 0;

		let morphTextureStride = 0;

		if ( geometry.morphAttributes.position !== undefined ) morphTextureStride = 1;
		if ( geometry.morphAttributes.normal !== undefined ) morphTextureStride = 2;
		if ( geometry.morphAttributes.color !== undefined ) morphTextureStride = 3;

		//

		let vertexShader, fragmentShader;
		let customVertexShaderID, customFragmentShaderID;

		if ( shaderID ) {

			const shader = ShaderLib[ shaderID ];

			vertexShader = shader.vertexShader;
			fragmentShader = shader.fragmentShader;

		} else {

			vertexShader = material.vertexShader;
			fragmentShader = material.fragmentShader;

			_customShaders.update( material );

			customVertexShaderID = _customShaders.getVertexShaderID( material );
			customFragmentShaderID = _customShaders.getFragmentShaderID( material );

		}

		const currentRenderTarget = renderer.getRenderTarget();
		const reversedDepthBuffer = renderer.state.buffers.depth.getReversed();

		const IS_INSTANCEDMESH = object.isInstancedMesh === true;
		const IS_BATCHEDMESH = object.isBatchedMesh === true;

		const HAS_MAP = !! material.map;
		const HAS_MATCAP = !! material.matcap;
		const HAS_ENVMAP = !! envMap;
		const HAS_AOMAP = !! material.aoMap;
		const HAS_LIGHTMAP = !! material.lightMap;
		const HAS_BUMPMAP = !! material.bumpMap;
		const HAS_NORMALMAP = !! material.normalMap;
		const HAS_DISPLACEMENTMAP = !! material.displacementMap;
		const HAS_EMISSIVEMAP = !! material.emissiveMap;

		const HAS_METALNESSMAP = !! material.metalnessMap;
		const HAS_ROUGHNESSMAP = !! material.roughnessMap;

		const HAS_ANISOTROPY = material.anisotropy > 0;
		const HAS_CLEARCOAT = material.clearcoat > 0;
		const HAS_DISPERSION = material.dispersion > 0;
		const HAS_IRIDESCENCE = material.iridescence > 0;
		const HAS_SHEEN = material.sheen > 0;
		const HAS_TRANSMISSION = material.transmission > 0;

		const HAS_ANISOTROPYMAP = HAS_ANISOTROPY && !! material.anisotropyMap;

		const HAS_CLEARCOATMAP = HAS_CLEARCOAT && !! material.clearcoatMap;
		const HAS_CLEARCOAT_NORMALMAP = HAS_CLEARCOAT && !! material.clearcoatNormalMap;
		const HAS_CLEARCOAT_ROUGHNESSMAP = HAS_CLEARCOAT && !! material.clearcoatRoughnessMap;

		const HAS_IRIDESCENCEMAP = HAS_IRIDESCENCE && !! material.iridescenceMap;
		const HAS_IRIDESCENCE_THICKNESSMAP = HAS_IRIDESCENCE && !! material.iridescenceThicknessMap;

		const HAS_SHEEN_COLORMAP = HAS_SHEEN && !! material.sheenColorMap;
		const HAS_SHEEN_ROUGHNESSMAP = HAS_SHEEN && !! material.sheenRoughnessMap;

		const HAS_SPECULARMAP = !! material.specularMap;
		const HAS_SPECULAR_COLORMAP = !! material.specularColorMap;
		const HAS_SPECULAR_INTENSITYMAP = !! material.specularIntensityMap;

		const HAS_TRANSMISSIONMAP = HAS_TRANSMISSION && !! material.transmissionMap;
		const HAS_THICKNESSMAP = HAS_TRANSMISSION && !! material.thicknessMap;

		const HAS_GRADIENTMAP = !! material.gradientMap;

		const HAS_ALPHAMAP = !! material.alphaMap;

		const HAS_ALPHATEST = material.alphaTest > 0;

		const HAS_ALPHAHASH = !! material.alphaHash;

		const HAS_EXTENSIONS = !! material.extensions;

		let toneMapping = NoToneMapping;

		if ( material.toneMapped ) {

			if ( currentRenderTarget === null || currentRenderTarget.isXRRenderTarget === true ) {

				toneMapping = renderer.toneMapping;

			}

		}

		_parameters.shaderID = shaderID;
		_parameters.shaderType = material.type;
		_parameters.shaderName = material.name;
		_parameters.vertexShader = vertexShader;
		_parameters.fragmentShader = fragmentShader;
		_parameters.defines = material.defines;
		_parameters.customVertexShaderID = customVertexShaderID;
		_parameters.customFragmentShaderID = customFragmentShaderID;
		_parameters.isRawShaderMaterial = material.isRawShaderMaterial === true;
		_parameters.glslVersion = material.glslVersion;
		_parameters.precision = precision;
		_parameters.batching = IS_BATCHEDMESH;
		_parameters.batchingColor = IS_BATCHEDMESH && object._colorsTexture !== null;
		_parameters.instancing = IS_INSTANCEDMESH;
		_parameters.instancingColor = IS_INSTANCEDMESH && object.instanceColor !== null;
		_parameters.instancingMorph = IS_INSTANCEDMESH && object.morphTexture !== null;
		_parameters.outputColorSpace = ( currentRenderTarget === null ) ? renderer.outputColorSpace : ( currentRenderTarget.isXRRenderTarget === true ? currentRenderTarget.texture.colorSpace : LinearSRGBColorSpace );
		_parameters.alphaToCoverage = !! material.alphaToCoverage;
		_parameters.map = HAS_MAP;
		_parameters.matcap = HAS_MATCAP;
		_parameters.envMap = HAS_ENVMAP;
		_parameters.envMapMode = HAS_ENVMAP && envMap.mapping;
		_parameters.envMapCubeUVHeight = envMapCubeUVHeight;
		_parameters.aoMap = HAS_AOMAP;
		_parameters.lightMap = HAS_LIGHTMAP;
		_parameters.bumpMap = HAS_BUMPMAP;
		_parameters.normalMap = HAS_NORMALMAP;
		_parameters.displacementMap = HAS_DISPLACEMENTMAP;
		_parameters.emissiveMap = HAS_EMISSIVEMAP;
		_parameters.normalMapObjectSpace = HAS_NORMALMAP && material.normalMapType === ObjectSpaceNormalMap;
		_parameters.normalMapTangentSpace = HAS_NORMALMAP && material.normalMapType === TangentSpaceNormalMap;
		_parameters.metalnessMap = HAS_METALNESSMAP;
		_parameters.roughnessMap = HAS_ROUGHNESSMAP;
		_parameters.anisotropy = HAS_ANISOTROPY;
		_parameters.anisotropyMap = HAS_ANISOTROPYMAP;
		_parameters.clearcoat = HAS_CLEARCOAT;
		_parameters.clearcoatMap = HAS_CLEARCOATMAP;
		_parameters.clearcoatNormalMap = HAS_CLEARCOAT_NORMALMAP;
		_parameters.clearcoatRoughnessMap = HAS_CLEARCOAT_ROUGHNESSMAP;
		_parameters.dispersion = HAS_DISPERSION;
		_parameters.iridescence = HAS_IRIDESCENCE;
		_parameters.iridescenceMap = HAS_IRIDESCENCEMAP;
		_parameters.iridescenceThicknessMap = HAS_IRIDESCENCE_THICKNESSMAP;
		_parameters.sheen = HAS_SHEEN;
		_parameters.sheenColorMap = HAS_SHEEN_COLORMAP;
		_parameters.sheenRoughnessMap = HAS_SHEEN_ROUGHNESSMAP;
		_parameters.specularMap = HAS_SPECULARMAP;
		_parameters.specularColorMap = HAS_SPECULAR_COLORMAP;
		_parameters.specularIntensityMap = HAS_SPECULAR_INTENSITYMAP;
		_parameters.transmission = HAS_TRANSMISSION;
		_parameters.transmissionMap = HAS_TRANSMISSIONMAP;
		_parameters.thicknessMap = HAS_THICKNESSMAP;
		_parameters.gradientMap = HAS_GRADIENTMAP;
		_parameters.opaque = material.transparent === false && material.blending === NormalBlending && material.alphaToCoverage === false;
		_parameters.alphaMap = HAS_ALPHAMAP;
		_parameters.alphaTest = HAS_ALPHATEST;
		_parameters.alphaHash = HAS_ALPHAHASH;
		_parameters.combine = material.combine;
		_parameters.mapUv = HAS_MAP && getChannel( material.map.channel );
		_parameters.aoMapUv = HAS_AOMAP && getChannel( material.aoMap.channel );
		_parameters.lightMapUv = HAS_LIGHTMAP && getChannel( material.lightMap.channel );
		_parameters.bumpMapUv = HAS_BUMPMAP && getChannel( material.bumpMap.channel );
		_parameters.normalMapUv = HAS_NORMALMAP && getChannel( material.normalMap.channel );
		_parameters.displacementMapUv = HAS_DISPLACEMENTMAP && getChannel( material.displacementMap.channel );
		_parameters.emissiveMapUv = HAS_EMISSIVEMAP && getChannel( material.emissiveMap.channel );
		_parameters.metalnessMapUv = HAS_METALNESSMAP && getChannel( material.metalnessMap.channel );
		_parameters.roughnessMapUv = HAS_ROUGHNESSMAP && getChannel( material.roughnessMap.channel );
		_parameters.anisotropyMapUv = HAS_ANISOTROPYMAP && getChannel( material.anisotropyMap.channel );
		_parameters.clearcoatMapUv = HAS_CLEARCOATMAP && getChannel( material.clearcoatMap.channel );
		_parameters.clearcoatNormalMapUv = HAS_CLEARCOAT_NORMALMAP && getChannel( material.clearcoatNormalMap.channel );
		_parameters.clearcoatRoughnessMapUv = HAS_CLEARCOAT_ROUGHNESSMAP && getChannel( material.clearcoatRoughnessMap.channel );
		_parameters.iridescenceMapUv = HAS_IRIDESCENCEMAP && getChannel( material.iridescenceMap.channel );
		_parameters.iridescenceThicknessMapUv = HAS_IRIDESCENCE_THICKNESSMAP && getChannel( material.iridescenceThicknessMap.channel );
		_parameters.sheenColorMapUv = HAS_SHEEN_COLORMAP && getChannel( material.sheenColorMap.channel );
		_parameters.sheenRoughnessMapUv = HAS_SHEEN_ROUGHNESSMAP && getChannel( material.sheenRoughnessMap.channel );
		_parameters.specularMapUv = HAS_SPECULARMAP && getChannel( material.specularMap.channel );
		_parameters.specularColorMapUv = HAS_SPECULAR_COLORMAP && getChannel( material.specularColorMap.channel );
		_parameters.specularIntensityMapUv = HAS_SPECULAR_INTENSITYMAP && getChannel( material.specularIntensityMap.channel );
		_parameters.transmissionMapUv = HAS_TRANSMISSIONMAP && getChannel( material.transmissionMap.channel );
		_parameters.thicknessMapUv = HAS_THICKNESSMAP && getChannel( material.thicknessMap.channel );
		_parameters.alphaMapUv = HAS_ALPHAMAP && getChannel( material.alphaMap.channel );
		_parameters.vertexTangents = !! geometry.attributes.tangent && ( HAS_NORMALMAP || HAS_ANISOTROPY );
		_parameters.vertexColors = material.vertexColors;
		_parameters.vertexAlphas = material.vertexColors === true && !! geometry.attributes.color && geometry.attributes.color.itemSize === 4;
		_parameters.pointsUvs = object.isPoints === true && !! geometry.attributes.uv && ( HAS_MAP || HAS_ALPHAMAP );
		_parameters.fog = !! fog;
		_parameters.useFog = material.fog === true;
		_parameters.fogExp2 = ( !! fog && fog.isFogExp2 );
		_parameters.flatShading = material.wireframe === false && (
			material.flatShading === true ||
			( geometry.attributes.normal === undefined && HAS_NORMALMAP === false &&
				( material.isMeshLambertMaterial || material.isMeshPhongMaterial || material.isMeshStandardMaterial || material.isMeshPhysicalMaterial )
			)
		);
		_parameters.sizeAttenuation = material.sizeAttenuation === true;
		_parameters.logarithmicDepthBuffer = logarithmicDepthBuffer;
		_parameters.reversedDepthBuffer = reversedDepthBuffer;
		_parameters.skinning = object.isSkinnedMesh === true;
		_parameters.morphTargets = geometry.morphAttributes.position !== undefined;
		_parameters.morphNormals = geometry.morphAttributes.normal !== undefined;
		_parameters.morphColors = geometry.morphAttributes.color !== undefined;
		_parameters.morphTargetsCount = morphTargetsCount;
		_parameters.morphTextureStride = morphTextureStride;
		_parameters.numDirLights = lights.directional.length;
		_parameters.numPointLights = lights.point.length;
		_parameters.numSpotLights = lights.spot.length;
		_parameters.numSpotLightMaps = lights.spotLightMap.length;
		_parameters.numRectAreaLights = lights.rectArea.length;
		_parameters.numHemiLights = lights.hemi.length;
		_parameters.numDirLightShadows = lights.directionalShadowMap.length;
		_parameters.numPointLightShadows = lights.pointShadowMap.length;
		_parameters.numSpotLightShadows = lights.spotShadowMap.length;
		_parameters.numSpotLightShadowsWithMaps = lights.numSpotLightShadowsWithMaps;
		_parameters.numLightProbes = lights.numLightProbes;
		_parameters.numClippingPlanes = clipping.numPlanes;
		_parameters.numClipIntersection = clipping.numIntersection;
		_parameters.dithering = material.dithering;
		_parameters.shadowMapEnabled = renderer.shadowMap.enabled && shadows.length > 0;
		_parameters.shadowMapType = renderer.shadowMap.type;
		_parameters.toneMapping = toneMapping;
		_parameters.decodeVideoTexture = HAS_MAP && ( material.map.isVideoTexture === true ) && ( ColorManagement.getTransfer( material.map.colorSpace ) === SRGBTransfer );
		_parameters.decodeVideoTextureEmissive = HAS_EMISSIVEMAP && ( material.emissiveMap.isVideoTexture === true ) && ( ColorManagement.getTransfer( material.emissiveMap.colorSpace ) === SRGBTransfer );
		_parameters.premultipliedAlpha = material.premultipliedAlpha;
		_parameters.doubleSided = material.side === DoubleSide;
		_parameters.flipSided = material.side === BackSide;
		_parameters.useDepthPacking = material.depthPacking >= 0;
		_parameters.depthPacking = material.depthPacking || 0;
		_parameters.index0AttributeName = material.index0AttributeName;
		_parameters.extensionClipCullDistance = HAS_EXTENSIONS && material.extensions.clipCullDistance === true && extensions.has( 'WEBGL_clip_cull_distance' );
		_parameters.extensionMultiDraw = ( HAS_EXTENSIONS && material.extensions.multiDraw === true || IS_BATCHEDMESH ) && extensions.has( 'WEBGL_multi_draw' );
		_parameters.rendererExtensionParallelShaderCompile = extensions.has( 'KHR_parallel_shader_compile' );
		_parameters.customProgramCacheKey = material.customProgramCacheKey();

		// the usage of getChannel() determines the active texture channels for this shader

		_parameters.vertexUv1s = _activeChannels.has( 1 );
		_parameters.vertexUv2s = _activeChannels.has( 2 );
		_parameters.vertexUv3s = _activeChannels.has( 3 );

		_activeChannels.clear();

		return _parameters;

	}

	function getProgramCacheKey( parameters ) {

		_cacheKeyArray.length = 0;
		const array = _cacheKeyArray;

		if ( parameters.shaderID ) {

			array.push( parameters.shaderID );

		} else {

			array.push( parameters.customVertexShaderID );
			array.push( parameters.customFragmentShaderID );

		}

		if ( parameters.defines !== undefined ) {

			for ( const name in parameters.defines ) {

				array.push( name );
				array.push( parameters.defines[ name ] );

			}

		}

		if ( parameters.isRawShaderMaterial === false ) {

			getProgramCacheKeyParameters( array, parameters );
			getProgramCacheKeyBooleans( array, parameters );
			array.push( renderer.outputColorSpace );

		}

		array.push( parameters.customProgramCacheKey );

		return array.join();

	}

	function getProgramCacheKeyParameters( array, parameters ) {

		array.push( parameters.precision );
		array.push( parameters.outputColorSpace );
		array.push( parameters.envMapMode );
		array.push( parameters.envMapCubeUVHeight );
		array.push( parameters.mapUv );
		array.push( parameters.alphaMapUv );
		array.push( parameters.lightMapUv );
		array.push( parameters.aoMapUv );
		array.push( parameters.bumpMapUv );
		array.push( parameters.normalMapUv );
		array.push( parameters.displacementMapUv );
		array.push( parameters.emissiveMapUv );
		array.push( parameters.metalnessMapUv );
		array.push( parameters.roughnessMapUv );
		array.push( parameters.anisotropyMapUv );
		array.push( parameters.clearcoatMapUv );
		array.push( parameters.clearcoatNormalMapUv );
		array.push( parameters.clearcoatRoughnessMapUv );
		array.push( parameters.iridescenceMapUv );
		array.push( parameters.iridescenceThicknessMapUv );
		array.push( parameters.sheenColorMapUv );
		array.push( parameters.sheenRoughnessMapUv );
		array.push( parameters.specularMapUv );
		array.push( parameters.specularColorMapUv );
		array.push( parameters.specularIntensityMapUv );
		array.push( parameters.transmissionMapUv );
		array.push( parameters.thicknessMapUv );
		array.push( parameters.combine );
		array.push( parameters.fogExp2 );
		array.push( parameters.sizeAttenuation );
		array.push( parameters.morphTargetsCount );
		array.push( parameters.morphAttributeCount );
		array.push( parameters.numDirLights );
		array.push( parameters.numPointLights );
		array.push( parameters.numSpotLights );
		array.push( parameters.numSpotLightMaps );
		array.push( parameters.numHemiLights );
		array.push( parameters.numRectAreaLights );
		array.push( parameters.numDirLightShadows );
		array.push( parameters.numPointLightShadows );
		array.push( parameters.numSpotLightShadows );
		array.push( parameters.numSpotLightShadowsWithMaps );
		array.push( parameters.numLightProbes );
		array.push( parameters.shadowMapType );
		array.push( parameters.toneMapping );
		array.push( parameters.numClippingPlanes );
		array.push( parameters.numClipIntersection );
		array.push( parameters.depthPacking );

	}

	function getProgramCacheKeyBooleans( array, parameters ) {

		_programLayers.disableAll();

		if ( parameters.instancing )
			_programLayers.enable( 0 );
		if ( parameters.instancingColor )
			_programLayers.enable( 1 );
		if ( parameters.instancingMorph )
			_programLayers.enable( 2 );
		if ( parameters.matcap )
			_programLayers.enable( 3 );
		if ( parameters.envMap )
			_programLayers.enable( 4 );
		if ( parameters.normalMapObjectSpace )
			_programLayers.enable( 5 );
		if ( parameters.normalMapTangentSpace )
			_programLayers.enable( 6 );
		if ( parameters.clearcoat )
			_programLayers.enable( 7 );
		if ( parameters.iridescence )
			_programLayers.enable( 8 );
		if ( parameters.alphaTest )
			_programLayers.enable( 9 );
		if ( parameters.vertexColors )
			_programLayers.enable( 10 );
		if ( parameters.vertexAlphas )
			_programLayers.enable( 11 );
		if ( parameters.vertexUv1s )
			_programLayers.enable( 12 );
		if ( parameters.vertexUv2s )
			_programLayers.enable( 13 );
		if ( parameters.vertexUv3s )
			_programLayers.enable( 14 );
		if ( parameters.vertexTangents )
			_programLayers.enable( 15 );
		if ( parameters.anisotropy )
			_programLayers.enable( 16 );
		if ( parameters.alphaHash )
			_programLayers.enable( 17 );
		if ( parameters.batching )
			_programLayers.enable( 18 );
		if ( parameters.dispersion )
			_programLayers.enable( 19 );
		if ( parameters.batchingColor )
			_programLayers.enable( 20 );
		if ( parameters.gradientMap )
			_programLayers.enable( 21 );

		array.push( _programLayers.mask );
		_programLayers.disableAll();

		if ( parameters.fog )
			_programLayers.enable( 0 );
		if ( parameters.useFog )
			_programLayers.enable( 1 );
		if ( parameters.flatShading )
			_programLayers.enable( 2 );
		if ( parameters.logarithmicDepthBuffer )
			_programLayers.enable( 3 );
		if ( parameters.reversedDepthBuffer )
			_programLayers.enable( 4 );
		if ( parameters.skinning )
			_programLayers.enable( 5 );
		if ( parameters.morphTargets )
			_programLayers.enable( 6 );
		if ( parameters.morphNormals )
			_programLayers.enable( 7 );
		if ( parameters.morphColors )
			_programLayers.enable( 8 );
		if ( parameters.premultipliedAlpha )
			_programLayers.enable( 9 );
		if ( parameters.shadowMapEnabled )
			_programLayers.enable( 10 );
		if ( parameters.doubleSided )
			_programLayers.enable( 11 );
		if ( parameters.flipSided )
			_programLayers.enable( 12 );
		if ( parameters.useDepthPacking )
			_programLayers.enable( 13 );
		if ( parameters.dithering )
			_programLayers.enable( 14 );
		if ( parameters.transmission )
			_programLayers.enable( 15 );
		if ( parameters.sheen )
			_programLayers.enable( 16 );
		if ( parameters.opaque )
			_programLayers.enable( 17 );
		if ( parameters.pointsUvs )
			_programLayers.enable( 18 );
		if ( parameters.decodeVideoTexture )
			_programLayers.enable( 19 );
		if ( parameters.decodeVideoTextureEmissive )
			_programLayers.enable( 20 );
		if ( parameters.alphaToCoverage )
			_programLayers.enable( 21 );

		array.push( _programLayers.mask );

	}

	function getUniforms( material ) {

		const shaderID = shaderIDs[ material.type ];
		let uniforms;

		if ( shaderID ) {

			const shader = ShaderLib[ shaderID ];
			uniforms = UniformsUtils.clone( shader.uniforms );

		} else {

			uniforms = material.uniforms;

		}

		return uniforms;

	}

	function acquireProgram( parameters, cacheKey ) {

		let program = programsMap.get( cacheKey );

		if ( program !== undefined ) {

			++ program.usedTimes;

		} else {

			program = new WebGLProgram( renderer, cacheKey, parameters, bindingStates );
			programs.push( program );

			programsMap.set( cacheKey, program );

		}

		return program;

	}

	function releaseProgram( program ) {

		if ( -- program.usedTimes === 0 ) {

			// Remove from unordered set
			const i = programs.indexOf( program );
			programs[ i ] = programs[ programs.length - 1 ];
			programs.pop();

			// Remove from map
			programsMap.delete( program.cacheKey );

			// Free WebGL resources
			program.destroy();

		}

	}

	function releaseShaderCache( material ) {

		_customShaders.remove( material );

	}

	function dispose() {

		_customShaders.dispose();

	}

	return {
		getParameters: getParameters,
		getProgramCacheKey: getProgramCacheKey,
		getUniforms: getUniforms,
		acquireProgram: acquireProgram,
		releaseProgram: releaseProgram,
		releaseShaderCache: releaseShaderCache,
		// Exposed for resource monitoring & error feedback via renderer.info:
		programs: programs,
		dispose: dispose
	};

}

export { WebGLPrograms };
